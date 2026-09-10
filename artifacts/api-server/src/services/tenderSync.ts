import { db, tendersTable, scraperLogsTable, usersTable, userTendersTable, documentsTable, tenderChangesTable, contractingAuthorityProfilesTable } from "@workspace/db";
import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { EjnApiService } from "./ejnApiService";
import { scraperEvents } from "../lib/scraperEvents";
import { compareAnnouncements, noticeStatus, parseEjnDate, procedureIdentity, summarizeLots, SyncGate, type EjnRow } from "./ejnIngestion";
import { notifyMatchedTender } from "./tenderNotifications";
import { sendTenderAlertEmail, sendTenderChangeEmail } from "./emailNotificationService";
export { SyncAlreadyRunningError } from "./ejnIngestion";

const gate = new SyncGate();
export const isTenderSyncRunning = () => gate.isRunning;

export interface SyncOptions {
  triggeredBy?: "manual" | "cron" | "validation";
  maxPages?: number;
  dryRun?: boolean;
  processDocuments?: boolean;
}
export interface SyncResult {
  logId: string;
  tendersFound: number;
  tendersNew: number;
  tendersUpdated: number;
  tendersSkipped: number;
  pagesFetched: number;
  truncated: boolean;
  warnings: string[];
  dryRun: boolean;
}
interface Cursor { skip: number; since?: string; snapshot: string }
export function readSyncDetails(errors: string | null | undefined): { warnings?: string[]; continuation?: Cursor; checkpoint?: string } {
  if (!errors) return {};
  try { return JSON.parse(errors); } catch { return {}; }
}

async function syncPortalLink(tenderId: string) {
  const existing = await db.query.documentsTable.findFirst({ where: and(eq(documentsTable.tenderId, tenderId), eq(documentsTable.fileType, "EJN_PORTAL_LINK")) });
  if (!existing) await db.insert(documentsTable).values({
    id: randomUUID(), tenderId, name: "Tenderska dokumentacija (EJN portal)",
    originalUrl: "https://www.ejn.gov.ba/Announcement/Search", fileType: "EJN_PORTAL_LINK",
  });
}

/** Reserves the same gate for cron, HTTP and scripts before the first DB await. */
export async function startSync(options: SyncOptions = {}) {
  const release = gate.acquire();
  const log = { id: randomUUID(), source: "ejn", triggeredBy: options.triggeredBy ?? "manual", startedAt: new Date(), status: "running", tendersFound: 0, tendersNew: 0, tendersUpdated: 0 };
  try {
    if (!options.dryRun) await db.insert(scraperLogsTable).values(log);
    const completion = performSync(log.id, log.startedAt, options).finally(release);
    // The HTTP caller attaches a logger immediately; retain rejection for awaited callers.
    completion.catch(() => {});
    return { log, completion };
  } catch (error) {
    release();
    throw error;
  }
}

export async function SyncTenders(options: SyncOptions = {}): Promise<SyncResult> {
  return (await startSync(options)).completion;
}

async function performSync(logId: string, startedAt: Date, options: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = { logId, tendersFound: 0, tendersNew: 0, tendersUpdated: 0, tendersSkipped: 0, pagesFetched: 0, truncated: false, warnings: [], dryRun: options.dryRun === true };
  const warn = (message: string) => { if (result.warnings.length < 30 && !result.warnings.includes(message)) result.warnings.push(message); };
  const progress = (message: string) => { if (!options.dryRun) scraperEvents.emit("progress", { source: "ejn", status: "running", message, ...result }); };
  const maxPages = Math.max(1, Math.min(20, Number.isSafeInteger(options.maxPages) ? options.maxPages! : 5));
  const pageSize = 50;
  const processed = new Set<string>();
  const processingIds: string[] = [];
  let cursor: Cursor = { skip: 0, snapshot: startedAt.toISOString() };
  try {
    const previous = await db.query.scraperLogsTable.findFirst({
      where: and(eq(scraperLogsTable.source, "ejn"), inArray(scraperLogsTable.status, ["completed", "partial"])),
      orderBy: [desc(scraperLogsTable.startedAt)],
    });
    const prior = readSyncDetails(previous?.errors);
    if (prior.continuation) cursor = prior.continuation;
    else if (prior.checkpoint) cursor.since = new Date(new Date(prior.checkpoint).getTime() - 2 * 86400_000).toISOString();
    const users: { id: string }[] = options.dryRun ? [] : await db.select({ id: usersTable.id }).from(usersTable);
    for (let page = 0; page < maxPages; page++) {
      progress(`Preuzimanje EJN obavještenja, stranica ${page + 1}/${maxPages}...`);
      const data = await EjnApiService.fetchAnnouncements(cursor.skip, pageSize, cursor.since, cursor.snapshot);
      result.pagesFetched++;
      const announcements = data.value.sort((a, b) => compareAnnouncements(b, a));
      for (const item of announcements) {
        if (!String(item.ProcedureName ?? "").trim()) { result.tendersSkipped++; continue; }
        let key: string;
        try { key = procedureIdentity(item); } catch (error) { warn(String(error)); result.tendersSkipped++; continue; }
        if (processed.has(key)) { result.tendersSkipped++; continue; }
        processed.add(key);
        result.tendersFound++;
        const publicationDate = parseEjnDate(item.Announced);
        if (!publicationDate || !String(item.ProcedureName ?? "").trim()) {
          warn(`Obavještenje ${item.Number ?? item.Id}: nedostaje ispravan datum objave ili naziv.`);
          result.tendersSkipped++;
          continue;
        }
        // Reuse legacy notice rows by ProcedureId; never delete a user's existing board/documents.
        const existing = await db.query.tendersTable.findFirst({
          where: and(inArray(tendersTable.source, ["ejn", "ejn_openapi"]), or(
            eq(tendersTable.externalId, key),
            eq(tendersTable.externalId, String(item.ProcedureNumber ?? item.Number ?? key)),
            eq(tendersTable.externalId, String(item.Number ?? key)),
            sql`${tendersTable.rawData}->'announcement'->>'ProcedureId' = ${String(item.ProcedureId)}`,
          )), orderBy: [desc(tendersTable.publicationDate)],
        });
        const oldRaw = (existing?.rawData ?? {}) as EjnRow;
        if (oldRaw.announcement && compareAnnouncements(item, oldRaw.announcement) < 0) { result.tendersSkipped++; continue; }
        // A failed lot request fails the run; incomplete data must never overwrite known values.
        const lots = (await EjnApiService.fetchProcedureLots(item.ProcedureId)).value;
        const summary = summarizeLots(lots);
        const state = noticeStatus(item, lots, summary.deadline);
        const description = [...new Set(lots.map(lot => lot.ShortDescription).filter(value => typeof value === "string" && value.trim()))].join("; ") || item.ProcedureName;
        const cpvCodes = [...new Set(lots.flatMap(lot => [String((lot as any).CPVCode ?? (lot as any).CpvCode ?? "")]).filter(Boolean))];
        const record = {
          externalId: existing?.externalId ?? String(item.ProcedureNumber ?? key), source: "ejn_openapi",
          title: item.ProcedureName, description, contractingAuth: item.ContractingAuthorityName || "Nije objavljen ugovorni organ",
          category: String(item.ContractCategoryName || item.ContractType || "Drugo"), cpvCodes, estimatedValue: summary.estimatedValue, publicationDate, deadline: summary.deadline,
          tenderType: item.ProcedureType || "Unknown", entity: "EJN", ...state,
          hasEAuction: item.IsAuctionOnline === true || lots.some(lot => lot.IsAuctionOnline === true),
          awardCriteria: item.AwardCriterion ?? null, sourceUrl: "https://www.ejn.gov.ba/Announcement/Search",
          rawData: { ...oldRaw, announcement: item, lots, ingestion: { procedureKey: key, deadlineSource: summary.deadlineSource, lotDeadlines: summary.lotDeadlines } },
        };
        const changed = !existing || JSON.stringify(oldRaw.announcement) !== JSON.stringify(item)
          || JSON.stringify(oldRaw.lots) !== JSON.stringify(lots)
          || existing.status !== record.status || existing.statusName !== record.statusName
          || (existing.deadline?.toISOString() ?? null) !== (record.deadline?.toISOString() ?? null)
          || JSON.stringify(existing.cpvCodes) !== JSON.stringify(record.cpvCodes)
          || existing.estimatedValue !== record.estimatedValue;
        if (!changed) { result.tendersSkipped++; continue; }
        if (options.dryRun) { if (existing) result.tendersUpdated++; else result.tendersNew++; continue; }
        const tenderId = existing?.id ?? randomUUID();

        const combinedText = `${record.title} ${record.description || ""} ${record.category || ""}`.toLowerCase();
        const isInsurance = combinedText.includes("osiguran")
          || combinedText.includes("kasko")
          || combinedText.includes("autoodgovornost")
          || combinedText.includes("auto-odgovornost")
          || combinedText.includes("nezgod")
          || combinedText.includes("dzo")
          || combinedText.includes("životn")
          || combinedText.includes("zivotn")
          || record.cpvCodes.some(c => c.startsWith("6651") || c.startsWith("6600") || c.startsWith("6650"));

        const isInspection = combinedText.includes("tehničk")
          || combinedText.includes("tehnick")
          || combinedText.includes("pregled vozila")
          || combinedText.includes("ispitivanje vozila")
          || combinedText.includes("homologacij")
          || combinedText.includes("tahograf")
          || combinedText.includes("registracij")
          || record.cpvCodes.some(c => c.startsWith("716312") || c.startsWith("716300") || c.startsWith("716310") || c.startsWith("7163"));

        const isAsaCore = isInsurance || isInspection;

        // Strictly ingest only insurance and technical inspection tenders as requested
        if (!isAsaCore) {
          result.tendersSkipped++;
          continue;
        }

        await db.transaction(async (tx: any) => {
          const authorityId = Number.isSafeInteger(item.ContractingAuthorityId) && item.ContractingAuthorityId > 0
            ? String(item.ContractingAuthorityId) : `name:${record.contractingAuth.toLocaleLowerCase("bs")}`;
          await tx.insert(contractingAuthorityProfilesTable).values({ id: randomUUID(), ejnId: authorityId, name: record.contractingAuth, lastUpdated: new Date() })
            .onConflictDoUpdate({ target: contractingAuthorityProfilesTable.ejnId, set: { name: record.contractingAuth, lastUpdated: new Date() } });
          const recordedChanges: Array<{ field: string; oldValue?: string; newValue?: string }> = [];
          if (existing) {
            await tx.update(tendersTable).set({ ...record, updatedAt: new Date() }).where(eq(tendersTable.id, existing.id));
            for (const field of ["deadline", "status", "estimatedValue"] as const) {
              const before = existing[field] instanceof Date ? existing[field].toISOString() : String(existing[field] ?? "");
              const after = record[field] instanceof Date ? (record[field] as Date).toISOString() : String(record[field] ?? "");
              if (before !== after) {
                await tx.insert(tenderChangesTable).values({ id: randomUUID(), tenderId, field, oldValue: before, newValue: after, notified: false });
                recordedChanges.push({ field, oldValue: before, newValue: after });
              }
            }
          } else {
            await tx.insert(tendersTable).values({ id: tenderId, ...record });
          }

          // Add only active opportunities matching ASA core business (insurance / inspection) to the work board
          if (record.status === "open" && isAsaCore) for (const user of users) {
            const linked = await tx.query.userTendersTable.findFirst({ where: and(eq(userTendersTable.userId, user.id), eq(userTendersTable.tenderId, tenderId)) });
            if (!linked) await tx.insert(userTendersTable).values({ id: randomUUID(), userId: user.id, tenderId, status: "watching", priority: isInsurance ? "high" : "medium" });
          }
        });
        if (existing) result.tendersUpdated++; else result.tendersNew++;
        try { await syncPortalLink(tenderId); } catch (error) { warn(`Portal poveznica ${item.Number}: ${String(error)}`); }
        if (!existing && isAsaCore) {
          scraperEvents.emit("new_tender", { tender: { id: tenderId, ...record }, isInsurance, isInspection });
          await notifyMatchedTender({ id: tenderId, title: record.title, description: record.description, cpvCodes, contractingAuth: record.contractingAuth, estimatedValue: record.estimatedValue, status: record.status }).catch(() => {});
          
          // Instant email notification to nurdin.smajic@asacentral.ba
          void sendTenderAlertEmail({
            id: tenderId,
            title: record.title,
            contractingAuth: record.contractingAuth,
            estimatedValue: record.estimatedValue,
            deadline: record.deadline,
            hasEAuction: record.hasEAuction,
            category: record.category,
            sourceUrl: record.sourceUrl,
          }).catch(() => {});
        }
        if (record.status === "open" && isAsaCore) processingIds.push(tenderId);
      }
      cursor.skip += data.value.length;
      if (data.value.length < pageSize) break;
      if (page === maxPages - 1) {
        // One lightweight lookahead distinguishes a full last page from a truncated run.
        const next = await EjnApiService.fetchAnnouncements(cursor.skip, 1, cursor.since, cursor.snapshot);
        result.truncated = next.value.length > 0;
      }
    }
    if (result.truncated) warn("Dosegnut je limit ovog preuzimanja. Sljedeće preuzimanje nastavlja od naredne stranice.");
    // Processing uses the same pipeline as the tender detail action, with no external notifications.
    if (!options.dryRun && options.processDocuments !== false && processingIds.length) {
      const { TenderPreparationPipeline } = await import("./tenderPipeline");
      const pipeline = new TenderPreparationPipeline();
      for (const tenderId of processingIds) {
        progress(`Obrada dokumentacije: ${processingIds.indexOf(tenderId) + 1}/${processingIds.length}...`);
        try {
          const pipelineResult = await pipeline.runForTender(tenderId, { notify: false });
          for (const step of pipelineResult.steps) {
            const warnings = step.metadata?.warnings;
            if (Array.isArray(warnings) && warnings.length) warn(`Dokumentacija ${tenderId}: ${warnings.join(" ")}`);
          }
          if (!pipelineResult.success) warn(`Obrada tendera ${tenderId}: ${pipelineResult.errors.join("; ") || "nije potpuna"}. Pregledajte izvještaj obrade.`);
        } catch (error) { warn(`Obrada tendera ${tenderId}: ${String(error)}`); }
      }
    }
    if (!options.dryRun) {
      const status = result.truncated ? "partial" : "completed";
      const details = { warnings: result.warnings, ...(result.truncated ? { continuation: cursor } : { checkpoint: cursor.snapshot }) };
      await db.update(scraperLogsTable).set({
        completedAt: new Date(), status, tendersFound: result.tendersFound, tendersNew: result.tendersNew,
        tendersUpdated: result.tendersUpdated, errors: JSON.stringify(details),
      }).where(eq(scraperLogsTable.id, logId));
      scraperEvents.emit("progress", { source: "ejn", status, message: `Preuzeto: ${result.tendersNew} novih, ${result.tendersUpdated} ažuriranih tendera.`, ...result });
    }
    return result;
  } catch (error) {
    if (!options.dryRun) {
      const message = error instanceof Error ? error.message : String(error);
      await db.update(scraperLogsTable).set({ completedAt: new Date(), status: "failed", errors: message, tendersFound: result.tendersFound, tendersNew: result.tendersNew, tendersUpdated: result.tendersUpdated }).where(eq(scraperLogsTable.id, logId));
      scraperEvents.emit("progress", { source: "ejn", status: "failed", message, ...result });
    }
    throw error;
  }
}
