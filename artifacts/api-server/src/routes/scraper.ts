import { Router } from "express";
import { db } from "@workspace/db";
import { scraperLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { scraperLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
import { analyzeTender } from "../services/aiAnalyzer";
import { runEjnScraper } from "../services/ejnScraper";
import { startSync, isTenderSyncRunning, SyncAlreadyRunningError, readSyncDetails } from "../services/tenderSync";
import { scraperEvents } from "../lib/scraperEvents";
import jwt from "jsonwebtoken";

export { scraperEvents };

export const scraperRouter = Router();

const isDev = process.env.NODE_ENV === "development";
const JWT_SECRET = process.env.JWT_SECRET ?? (isDev ? "asa_tender_jwt_secret_2026" : null);



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

scraperRouter.get("/status", async (_req, res) => {
  const [last] = await db.select().from(scraperLogsTable)
    .where(inArray(scraperLogsTable.source, ["ejn", "EJN OpenAPI", "ejn_openapi"]))
    .orderBy(desc(scraperLogsTable.startedAt)).limit(1);
  const details = readSyncDetails(last?.errors);
  res.json({
    isRunning: isTenderSyncRunning(),
    sources: [
      { source: "ejn", supported: true, lastRun: last?.completedAt ?? null, nextRun: null,
        status: isTenderSyncRunning() ? "running" : last?.status ?? "never", tendersFound: last?.tendersFound ?? 0,
        tendersNew: last?.tendersNew ?? 0, tendersUpdated: last?.tendersUpdated ?? 0,
        lastError: last?.status === "failed" ? last.errors : null, warnings: details.warnings ?? [],
        hasMore: Boolean(details.continuation), schedule: "Svakih 15 minuta", },
      { source: "reference", supported: false, lastRun: null, nextRun: null, status: "unsupported", tendersFound: 0,
        detail: "Integracija s Reference.ba još nije povezana." },
      { source: "un", supported: false, lastRun: null, nextRun: null, status: "unsupported", tendersFound: 0,
        detail: "Integracija s UN/UNDP izvorom još nije povezana." },
    ],
  });
});

scraperRouter.post("/trigger", scraperLimiter, async (req, res) => {
  const { source, maxPages, dryRun, processDocuments } = req.body ?? {};
  if (typeof source !== "string") return res.status(400).json({ error: "Izvor je obavezan." });
  if (!["ejn", "all"].includes(source)) return res.status(422).json({ error: "Ovaj izvor još nije povezan. Dostupan je EJN OpenAPI.", supportedSources: ["ejn"] });
  if (maxPages !== undefined && (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 20)) return res.status(400).json({ error: "maxPages mora biti cijeli broj između 1 i 20." });
  if ([dryRun, processDocuments].some(value => value !== undefined && typeof value !== "boolean")) return res.status(400).json({ error: "dryRun i processDocuments moraju biti boolean vrijednosti." });
  try {
    const run = await startSync({ triggeredBy: "manual", maxPages, dryRun, processDocuments });
    if (dryRun) return res.json(await run.completion);
    run.completion.catch(err => logger.error({ err }, "EJN preuzimanje nije završeno"));
    return res.status(202).json(run.log);
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) return res.status(409).json({ error: error.message });
    logger.error({ err: error }, "EJN preuzimanje nije pokrenuto");
    return res.status(502).json({ error: error instanceof Error ? error.message : "EJN izvor trenutno nije dostupan." });
  }
});
scraperRouter.get("/logs", async (req, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));

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




