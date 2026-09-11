import { db, tendersTable, documentsTable, aiAnalysisTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { TenderPreparationPipeline } from "./tenderPipeline";

export class AutonomousTenderProcessor {
  private static isRunning = false;

  /**
   * Pokreće autonomnu obradu svih otvorenih tendera koji još nemaju preuzetu dokumentaciju ili AI analizu.
   */
  public static async processPendingTenders(): Promise<number> {
    if (this.isRunning) {
      logger.info("Autonomni procesor dokumentacije je već aktivan, preskačem krug.");
      return 0;
    }

    this.isRunning = true;
    let processedCount = 0;

    try {
      // Pronađi otvorene tendere
      const candidates = await db
        .select({
          id: tendersTable.id,
          title: tendersTable.title,
          category: tendersTable.category,
          cpvCodes: tendersTable.cpvCodes,
          description: tendersTable.description,
        })
        .from(tendersTable)
        .where(eq(tendersTable.status, "open"))
        .limit(20);

      const pipeline = new TenderPreparationPipeline();

      for (const tender of candidates) {
        // Provjeri da li već ima preuzete prave datoteke
        const existingRealDocs = await db
          .select({ id: documentsTable.id })
          .from(documentsTable)
          .where(
            and(
              eq(documentsTable.tenderId, tender.id),
              sql`${documentsTable.fileType} != 'EJN_PORTAL_LINK'`,
              sql`(${documentsTable.fileSize} > 0 OR ${documentsTable.localPath} IS NOT NULL OR ${documentsTable.parsedText} IS NOT NULL)`
            )
          )
          .limit(1);

        // Provjeri da li ima AI analizu
        const [existingAnalysis] = await db
          .select({ id: aiAnalysisTable.id })
          .from(aiAnalysisTable)
          .where(eq(aiAnalysisTable.tenderId, tender.id))
          .limit(1);

        // Ako nema preuzetih pravih dokumenata ili nema AI analizu, pokreni autonomnu obradu
        if (existingRealDocs.length === 0 || !existingAnalysis) {
          logger.info(
            { tenderId: tender.id, title: tender.title },
            "Autonomni agent: Automatski preuzimam i obrađujem TD sa EJN portala..."
          );

          try {
            const result = await pipeline.runForTender(tender.id, { notify: true });
            if (result.success) {
              processedCount++;
              logger.info(
                { tenderId: tender.id, durationMs: result.duration },
                "Autonomni agent: Dokumentacija uspješno preuzeta i obrađena."
              );
            }
          } catch (err: any) {
            logger.warn({ tenderId: tender.id, err: err.message }, "Greška tokom autonomne obrade tendera");
          }
        }
      }

      return processedCount;
    } catch (err: any) {
      logger.error({ err }, "Greška u autonomnom procesoru tendera");
      return processedCount;
    } finally {
      this.isRunning = false;
    }
  }
}
