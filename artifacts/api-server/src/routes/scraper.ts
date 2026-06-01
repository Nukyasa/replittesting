import { Router } from "express";
import { db } from "@workspace/db";
import { scraperLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { scraperLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
import { analyzeTender } from "../services/aiAnalyzer";
import { runEjnScraper } from "../services/ejnScraper";
import { scraperEvents } from "../lib/scraperEvents";
import jwt from "jsonwebtoken";

export { scraperEvents };

export const scraperRouter = Router();

const isDev = process.env.NODE_ENV === "development";
const JWT_SECRET = process.env.JWT_SECRET ?? (isDev ? "asa_tender_jwt_secret_2026" : null);

export let isRunning = false;

scraperRouter.get("/live-feed", (req, res) => {
  const tokenParam = req.query.token as string | undefined;
  if (!tokenParam) {
    res.status(401).end();
    return;
  }
  try {
    jwt.verify(tokenParam, JWT_SECRET!);
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("connected", { ok: true });

  const heartbeat = setInterval(() => {
    res.write("event: heartbeat\ndata: {}\n\n");
  }, 30000);

  const onNewTender = (data: { tender: unknown; isInsurance: boolean }) => {
    if (data.isInsurance) {
      sendEvent("new_insurance_tender", data.tender);
    }
  };

  const onProgress = (data: unknown) => {
    sendEvent("scraper_progress", data);
  };

  scraperEvents.on("new_tender", onNewTender);
  scraperEvents.on("progress", onProgress);

  req.on("close", () => {
    clearInterval(heartbeat);
    scraperEvents.off("new_tender", onNewTender);
    scraperEvents.off("progress", onProgress);
  });
});

scraperRouter.use(authMiddleware);

const CRON_SCHEDULES = {
  ejn: "*/30 * * * *",
  reference: "0 */4 * * *",
  un: "0 6 * * *",
};

async function runRealScraper(source: string, logId: string, _triggeredBy = "manual"): Promise<void> {
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
      scraperEvents.emit("progress", { source, status: "running", message: "Preuzimam insurance tendere s open.ejn.gov.ba..." });
      newCount = await runEjnScraper(logId);
      scraperEvents.emit("progress", { source, status: "running", message: `Pronađeno ${newCount} novih insurance tendera`, tendersNew: newCount });
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

void analyzeTender;
void CRON_SCHEDULES;
