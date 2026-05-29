import { Router } from "express";
import { db } from "@workspace/db";
import { scraperLogsTable, tendersTable, aiAnalysisTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { scraperLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
import { analyzeTender } from "../services/aiAnalyzer";
import { EventEmitter } from "events";
import { runEjnScraper } from "../services/ejnScraper";

export const scraperRouter = Router();
scraperRouter.use(authMiddleware);

export const scraperEvents = new EventEmitter();
scraperEvents.setMaxListeners(100);

export let isRunning = false;

const CRON_SCHEDULES = {
  ejn: "0 */2 * * *",
  reference: "0 */4 * * *",
  un: "0 6 * * *",
};

async function runRealScraper(source: string, logId: string, triggeredBy = "manual"): Promise<void> {
  if (isRunning) {
    logger.info("Scraper already running, skipping");
    return;
  }
  isRunning = true;

  scraperEvents.emit("progress", {
    source,
    status: "running",
    message: `Pokrenuto preuzimanje podataka s EJN portala...`,
  });

  try {
    let newCount = 0;

    if (source === "ejn" || source === "all") {
      scraperEvents.emit("progress", { source, status: "running", message: "Preuzimam tender obavještenja s open.ejn.gov.ba..." });
      newCount = await runEjnScraper(logId);
      scraperEvents.emit("progress", { source, status: "running", message: `Pronađeno ${newCount} novih EJN tendera` });
    }

    if (source === "reference" || source === "all") {
      scraperEvents.emit("progress", { source, status: "running", message: "Reference.ba: simulacija (API nije javno dostupan)..." });
      await new Promise((r) => setTimeout(r, 800));
    }

    if (source === "un" || source === "all") {
      scraperEvents.emit("progress", { source, status: "running", message: "UNDP: simulacija (API nije javno dostupan)..." });
      await new Promise((r) => setTimeout(r, 500));
    }

    await db
      .update(scraperLogsTable)
      .set({
        completedAt: new Date(),
        status: "completed",
        tendersFound: newCount,
        tendersNew: newCount,
        tendersUpdated: 0,
      })
      .where(eq(scraperLogsTable.id, logId));

    scraperEvents.emit("progress", {
      source,
      status: "completed",
      message: `Završeno: ${newCount} novih tendera uvezeno`,
      tendersNew: newCount,
      tendersUpdated: 0,
    });
  } catch (err) {
    logger.error({ err }, "Scraper error");
    await db
      .update(scraperLogsTable)
      .set({ completedAt: new Date(), status: "failed", errors: String(err) })
      .where(eq(scraperLogsTable.id, logId));

    scraperEvents.emit("progress", { source, status: "failed", message: "Greška pri preuzimanju podataka" });
  } finally {
    isRunning = false;
  }
}

export { runRealScraper as runMockScraper };

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

scraperRouter.post("/trigger", scraperLimiter, async (req, res) => {
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
    runRealScraper(s, log.id, "manual").catch((err) =>
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
