import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed";
import cron from "node-cron";
import { db } from "@workspace/db";
import { scraperLogsTable, tendersTable, documentsTable, tenderNotificationsTable, userTendersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { nanoid } from "./lib/nanoid";
import { SyncTenders, isTenderSyncRunning } from "./services/tenderSync";
import { syncActiveEjnTenders } from "./services/ejnScraper";
import { sendDeadlineReminders } from "./services/tenderNotifications";
import { scraperEvents } from "./lib/scraperEvents";
import monitoringRouter from "./routes/monitoring";
import { syncHistoryBatch } from "./services/awardHistory";

const rawPort = process.env["PORT"] ?? (process.env.NODE_ENV !== "production" ? "5000" : undefined);

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Odgodi seed i cron da server odmah bude dostupan.
  const startDelayMs = Number(process.env.DB_START_DELAY_MS ?? "15000");

  setTimeout(async () => {
    try {
      await seedDatabase();
      if (!isTenderSyncRunning()) {
        logger.info("Starting initial EJN OpenAPI sync on server startup...");
        await SyncTenders({ triggeredBy: "cron", maxPages: 2, processDocuments: true, maxDocumentTenders: 2 });
        logger.info("Initial EJN OpenAPI sync on server startup completed successfully.");
      }
    } catch (seedErr) {
      logger.error({ err: seedErr }, "Startup seed/sync failed");
    }
  }, startDelayMs);

  // Cron registrujemo tek nakon kratkog delay-a (i dalje se ne gasi funkcionalnost).
  setTimeout(() => {
    void syncHistoryBatch().catch(err => logger.error({ err }, "Initial history sync failed"));
    cron.schedule("*/10 * * * *", () => { void syncHistoryBatch().catch(err => logger.error({ err }, "History sync failed")); });
    cron.schedule("*/15 * * * *", async () => {
      if (isTenderSyncRunning()) return;
      try { await SyncTenders({ triggeredBy: "cron", maxPages: 1, processDocuments: true, maxDocumentTenders: 2 }); }
      catch (err) { logger.error({ err }, "EJN scheduled sync failed"); }
    });

    cron.schedule("5,35 * * * *", async () => {
      try {
        const { processPendingEjnDocuments } = await import("./services/tenderPipeline");
        await processPendingEjnDocuments(2);
      } catch (err) {
        logger.error({ err }, "Automatic EJN document processing failed");
      }
    });

    cron.schedule("0 8 * * *", async () => {
      logger.info("Cron: Sending deadline reminders");
      try {
        await sendDeadlineReminders();
      } catch (err) {
        logger.error({ err }, "Cron: Deadline reminders failed");
      }
    });

    cron.schedule("0 */2 * * *", async () => {
      const { TenderPreparationPipeline } = await import("./services/tenderPipeline");
      logger.info("Cron: Checking for tenders without AI analysis");
      try {
        const { eq, and, isNull } = await import("drizzle-orm");
        const { aiAnalysisTable, tendersTable } = await import("@workspace/db");
        
        const unanalyzed = await db.select({ id: tendersTable.id, title: tendersTable.title })
          .from(tendersTable)
          .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
          .where(and(eq(tendersTable.status, "open"), isNull(aiAnalysisTable.id)))
          .limit(10);

        if (unanalyzed.length > 0) {
          logger.info(`Pipeline: Processing ${unanalyzed.length} tenders without analysis`);
          await TenderPreparationPipeline.runBatch(unanalyzed.map((t: any) => t.id), 2, { triggeredBy: "cron" });
        }
      } catch (err) {
        logger.error({ err }, "Cron: Pipeline automation failed");
      }
    });

    cron.schedule("0 */6 * * *", async () => {
      const { MonitoringService } = await import("./services/monitoringService");
      logger.info("Cron: Running system health monitoring");
      try {
        const systemStats = await MonitoringService.getSystemStats();
        if (systemStats.failedPipeline > 0 || systemStats.activeAlerts > 10) {
          logger.warn({ health: systemStats }, "System health issues detected");
        }
      } catch (err) {
        logger.error({ err }, "Cron: System health check failed");
      }
    });

    logger.info(
      "Cron schedulers registered: EJN sync every 15min, document queue every 30min, deadlines daily at 8:00, analysis every 2h, health every 6h",
    );
  }, startDelayMs);

});
