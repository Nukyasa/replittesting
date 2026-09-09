import { db, tendersTable, aiAnalysisTable, documentsTable, userTendersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export type PipelineStep = "sync" | "scrape_docs" | "parse_docs" | "ai_analysis" | "calc_win_prob" | "notify" | "error";
export interface PipelineRun {
  tenderId: string;
  step: PipelineStep;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}
interface PipelineResult {
  success: boolean;
  steps: PipelineRun[];
  errors: string[];
  duration: number;
}
export class TenderPreparationPipeline {
  async runForTender(tenderId: string, options: { skipScrape?: boolean; skipAnalysis?: boolean; notify?: boolean } = {}): Promise<PipelineResult> {
    const startTime = Date.now();
    // Per-call state: simultaneous manual and scheduled processing cannot mix steps.
    const steps: PipelineRun[] = [];
    const errors: string[] = [];
    const add = (step: PipelineStep, status: PipelineRun["status"], metadata?: Record<string, unknown>, error?: string) => {
      steps.push({ tenderId, step, status, startedAt: new Date(), completedAt: new Date(), metadata, error });
      if (status === "failed" && error) errors.push(`[${step}] ${error}`);
    };
    try {
      const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, tenderId)).limit(1);
      if (!tender) throw new Error("Tender nije pronađen.");
      const docs = await db.select({ id: documentsTable.id }).from(documentsTable).where(eq(documentsTable.tenderId, tenderId));
      add("sync", "completed", { docsFound: docs.length });

      if (options.skipScrape) {
        add("scrape_docs", "skipped", { reason: "Preuzimanje preskočeno po zahtjevu." });
      } else {
        try {
          const { EjnDocumentScraper } = await import("./ejnDocumentScraper");
          const jobId = randomUUID();
          const result = await new EjnDocumentScraper().scrapeAllDocuments(tenderId, jobId, 0);
          const summary = result?.summary || {};
          const count = summary.total_documents ?? result?.documents?.length ?? 0;
          add("scrape_docs", count ? "completed" : "skipped", {
            docsScraped: count, jobId, ...summary, warnings: result?.warnings || [],
            ...(count ? {} : { reason: "Dokumentacija nije dostupna; učitajte priloge za obradu." }),
          });
        } catch (err: any) {
          add("scrape_docs", "failed", undefined, err.message);
        }
      }

      if (options.skipAnalysis) {
        add("parse_docs", "skipped", { reason: "Obrada preskočena po zahtjevu." });
        add("ai_analysis", "skipped", { reason: "Obrada preskočena po zahtjevu." });
      } else {
        try {
          const { triggerParsing } = await import("./tenderParser");
          const parsed = await triggerParsing(tenderId);
          add("parse_docs", parsed.status === "FAILED" ? "failed" : parsed.status === "NEEDS_DOCUMENTS" ? "skipped" : "completed",
            { parsingStatus: parsed.status, message: parsed.message }, parsed.status === "FAILED" ? parsed.message : undefined);
        } catch (err: any) {
          add("parse_docs", "failed", undefined, err.message);
        }
        try {
          const { analyzeTender } = await import("./aiAnalyzer");
          const analysis = await analyzeTender(tender);
          await db.insert(aiAnalysisTable).values({ id: randomUUID(), tenderId, ...analysis })
            .onConflictDoUpdate({
              target: aiAnalysisTable.tenderId,
              set: { ...analysis, analyzedAt: new Date() },
            });
          const metadata = analysis.participationConditions._analysis;
          add("ai_analysis", metadata.status === "metadata_only" ? "skipped" : "completed", {
            ...metadata, analysisVersion: analysis.analysisVersion,
          });
          // Internal completion notifications only when explicitly requested.
          if (options.notify && metadata.readableDocumentCount > 0) {
            const users = await db.select({ userId: userTendersTable.userId }).from(userTendersTable).where(eq(userTendersTable.tenderId, tenderId));
            const userIds = [...new Set<string>(users.map((user: { userId: string }) => user.userId))];
            if (userIds.length) {
              await db.insert(notificationsTable).values(userIds.map(userId => ({
                id: randomUUID(), userId, type: "pipeline_complete", title: "Dokumentacija obrađena",
                message: `Tender "${tender.title}": izvori su izdvojeni za provjeru tima.`, tenderId, read: false,
              })));
            }
            add("notify", "completed", { usersNotified: userIds.length });
          } else {
            add("notify", "skipped", { reason: "Obavještenja nisu zatražena ili dokumentacija nije dostupna." });
          }
        } catch (err: any) {
          add("ai_analysis", "failed", undefined, err.message);
        }
      }
    } catch (err: any) {
      add("error", "failed", undefined, err.message);
    }
    return { success: errors.length === 0, steps, errors, duration: Date.now() - startTime };
  }

  static async runBatch(tenderIds: string[], concurrency = 3): Promise<Map<string, PipelineResult>> {
    const results = new Map<string, PipelineResult>();
    const limit = Number.isFinite(concurrency) ? Math.max(1, Math.min(5, Math.floor(concurrency))) : 3;
    for (let i = 0; i < tenderIds.length; i += limit) {
      await Promise.allSettled(tenderIds.slice(i, i + limit).map(async id => {
        results.set(id, await new TenderPreparationPipeline().runForTender(id));
      }));
    }
    return results;
  }
}
export const pipeline = new TenderPreparationPipeline();

