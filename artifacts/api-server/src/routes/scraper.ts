import { Router } from "express";
import { db } from "@workspace/db";
import { scraperLogsTable, tendersTable, aiAnalysisTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import { analyzeTender } from "../services/aiAnalyzer";
import { EventEmitter } from "events";

export const scraperRouter = Router();
scraperRouter.use(authMiddleware);

export const scraperEvents = new EventEmitter();
scraperEvents.setMaxListeners(100);

let isRunning = false;

const CRON_SCHEDULES = {
  ejn: "0 */2 * * *",
  reference: "0 */4 * * *",
  un: "0 6 * * *",
};

async function runMockScraper(source: string, triggeredBy = "manual"): Promise<void> {
  if (isRunning) {
    logger.info("Scraper already running, skipping");
    return;
  }
  isRunning = true;

  const logId = nanoid();
  await db.insert(scraperLogsTable).values({
    id: logId,
    source,
    triggeredBy,
    startedAt: new Date(),
    status: "running",
  });

  scraperEvents.emit("progress", {
    source,
    status: "running",
    message: `Pokrenuto skrejpovanje: ${source}`,
  });

  try {
    await new Promise((r) => setTimeout(r, 1500));

    scraperEvents.emit("progress", {
      source,
      status: "running",
      message: "Procesiranje tendera...",
    });

    await new Promise((r) => setTimeout(r, 1000));

    const newCount = Math.floor(Math.random() * 5);
    const updatedCount = Math.floor(Math.random() * 3);

    await db
      .update(scraperLogsTable)
      .set({
        completedAt: new Date(),
        status: "completed",
        tendersFound: newCount + updatedCount,
        tendersNew: newCount,
        tendersUpdated: updatedCount,
      })
      .where(eq(scraperLogsTable.id, logId));

    scraperEvents.emit("progress", {
      source,
      status: "completed",
      message: `Završeno: ${newCount} novih, ${updatedCount} ažuriranih tendera`,
      tendersNew: newCount,
      tendersUpdated: updatedCount,
    });
  } catch (err) {
    logger.error({ err }, "Scraper error");
    await db
      .update(scraperLogsTable)
      .set({
        completedAt: new Date(),
        status: "failed",
        errors: String(err),
      })
      .where(eq(scraperLogsTable.id, logId));

    scraperEvents.emit("progress", {
      source,
      status: "failed",
      message: "Greška pri skrejpovanju",
    });
  } finally {
    isRunning = false;
  }
}

export { runMockScraper };

scraperRouter.get("/status", async (_req, res) => {
  const sources = ["ejn", "reference", "un"];

  const statusData = await Promise.all(
    sources.map(async (source) => {
      const [last] = await db
        .select()
        .from(scraperLogsTable)
        .where(eq(scraperLogsTable.source, source))
        .orderBy(desc(scraperLogsTable.startedAt))
        .limit(1);

      return {
        source,
        lastRun: last?.completedAt ?? null,
        nextRun: null,
        status: last?.status ?? "never",
        tendersFound: last?.tendersFound ?? 0,
      };
    })
  );

  res.json({ sources: statusData, isRunning });
});

scraperRouter.post("/trigger", async (req, res) => {
  const { source } = req.body;
  if (!source) return res.status(400).json({ error: "Source is required" });

  const sources = source === "all" ? ["ejn", "reference", "un"] : [source];

  const [log] = await db
    .insert(scraperLogsTable)
    .values({
      id: nanoid(),
      source: source,
      triggeredBy: "manual",
      startedAt: new Date(),
      status: "running",
    })
    .returning();

  sources.forEach((s) => {
    runMockScraper(s, "manual").catch((err) =>
      logger.error({ err }, "Scraper error")
    );
  });

  res.json(log);
});

scraperRouter.get("/logs", async (req, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const logs = await db
    .select()
    .from(scraperLogsTable)
    .orderBy(desc(scraperLogsTable.startedAt))
    .limit(limitNum)
    .offset((pageNum - 1) * limitNum);

  res.json(logs);
});

scraperRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: "connected" });

  const handler = (data: unknown) => sendEvent({ type: "progress", ...data as object });
  scraperEvents.on("progress", handler);

  req.on("close", () => {
    scraperEvents.off("progress", handler);
  });
});
