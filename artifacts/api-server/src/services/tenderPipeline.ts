import { db, tendersTable, aiAnalysisTable, documentsTable, userTendersTable, notificationsTable, pipelineRunsTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

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
  async runForTender(tenderId: string, options: { skipScrape?: boolean; skipAnalysis?: boolean; notify?: boolean; triggeredBy?: "manual" | "cron" | "sync" } = {}): Promise<PipelineResult> {
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
    const result = { success: errors.length === 0, steps, errors, duration: Date.now() - startTime };
    try {
      await db.insert(pipelineRunsTable).values({
        id: randomUUID(), tenderId, status: result.success ? "completed" : "failed",
        steps, errors, durationMs: result.duration, triggeredBy: options.triggeredBy ?? "manual",
        completedAt: new Date(),
      });
    } catch (error) {
      logger.warn({ error, tenderId }, "Pipeline run could not be recorded");
    }
    return result;
  }

  static async runBatch(tenderIds: string[], concurrency = 3, options: { notify?: boolean; triggeredBy?: "manual" | "cron" | "sync" } = {}): Promise<Map<string, PipelineResult>> {
    const results = new Map<string, PipelineResult>();
    const limit = Number.isFinite(concurrency) ? Math.max(1, Math.min(5, Math.floor(concurrency))) : 3;
    for (let i = 0; i < tenderIds.length; i += limit) {
      await Promise.allSettled(tenderIds.slice(i, i + limit).map(async id => {
        results.set(id, await new TenderPreparationPipeline().runForTender(id, options));
      }));
    }
    return results;
  }
}
export const pipeline = new TenderPreparationPipeline();

/**
 * Gradually processes open EJN tenders that still have no downloaded file.
 * Recent attempts are skipped so an unavailable portal document cannot starve
 * the rest of the queue or overload a small Render instance.
 */
export async function processPendingEjnDocuments(limit = 3) {
  const batchSize = Math.max(1, Math.min(10, Math.floor(limit)));
  const candidates = await db.select({ id: tendersTable.id })
    .from(tendersTable)
    .where(and(
      eq(tendersTable.status, "open"),
      inArray(tendersTable.source, ["ejn", "ejn_openapi"]),
      sql`NOT EXISTS (
        SELECT 1 FROM ${documentsTable} d
        WHERE d.tender_id = ${tendersTable.id}
          AND d.superseded_by IS NULL
          AND d.file_type <> 'EJN_PORTAL_LINK'
          AND d.local_path IS NOT NULL
          AND COALESCE(d.file_size, 0) > 0
      )`,
      sql`NOT EXISTS (
        SELECT 1 FROM ${pipelineRunsTable} p
        WHERE p.tender_id = ${tendersTable.id}
          AND p.created_at > CURRENT_TIMESTAMP - INTERVAL '6 hours'
      )`,
    ))
    .orderBy(asc(tendersTable.deadline), desc(tendersTable.updatedAt))
    .limit(batchSize);

  if (!candidates.length) return new Map<string, PipelineResult>();
  logger.info({ count: candidates.length }, "Automatic EJN document processing started");
  return TenderPreparationPipeline.runBatch(candidates.map((tender: { id: string }) => tender.id), 1, { triggeredBy: "cron", notify: true });
}

