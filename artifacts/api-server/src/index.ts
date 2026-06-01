import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed";
import cron from "node-cron";
import { db } from "@workspace/db";
import { scraperLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "./lib/nanoid";
import { runEjnScraper, syncActiveEjnTenders, sendDeadlineReminders } from "./services/ejnScraper";
import { scraperEvents } from "./routes/scraper";

const rawPort = process.env["PORT"];

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

  seedDatabase().catch((seedErr) => logger.error({ err: seedErr }, "Seed failed"));

  let cronRunning = false;

  cron.schedule("0 */2 * * *", async () => {
    if (cronRunning) {
      logger.info("Cron: EJN scraper already running, skipping");
      return;
    }
    cronRunning = true;
    logger.info("Cron: Starting scheduled EJN scrape");

    const [log] = await db
      .insert(scraperLogsTable)
      .values({
        id: nanoid(),
        source: "ejn",
        triggeredBy: "cron",
        startedAt: new Date(),
        status: "running",
      })
      .returning();

    try {
      const newCount = await runEjnScraper(log.id);

      await db
        .update(scraperLogsTable)
        .set({
          completedAt: new Date(),
          status: "completed",
          tendersFound: newCount,
          tendersNew: newCount,
          tendersUpdated: 0,
        })
        .where(eq(scraperLogsTable.id, log.id));

      scraperEvents.emit("progress", {
        source: "ejn",
        status: "completed",
        message: `Cron: ${newCount} novih tendera uvezeno`,
        tendersNew: newCount,
      });

      logger.info({ newCount }, "Cron: EJN scrape completed");
    } catch (cronErr) {
      logger.error({ err: cronErr }, "Cron: EJN scrape failed");
      await db
        .update(scraperLogsTable)
        .set({ completedAt: new Date(), status: "failed", errors: String(cronErr) })
        .where(eq(scraperLogsTable.id, log.id));
    } finally {
      cronRunning = false;
    }
  });

  cron.schedule("0 * * * *", async () => {
    logger.info("Cron: Syncing active tenders for changes");
    try {
      await syncActiveEjnTenders();
    } catch (err) {
      logger.error({ err }, "Cron: Active tender sync failed");
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

  logger.info("Cron schedulers registered: EJN every 2h, sync every 1h, deadlines daily at 8:00");
});
