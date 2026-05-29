import { db } from "@workspace/db";
import { tendersTable, scraperLogsTable, aiAnalysisTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";

const EJN_BASE = "https://open.ejn.gov.ba";

interface EjnProcedureCall {
  Id: number;
  Number?: string;
  ContractingAuthorityName?: string;
  ContractingAuthorityAdministrativeUnitName?: string;
  ContractingAuthorityCityName?: string;
  ProcedureName?: string;
  ProcedureType?: string;
  ContractType?: string;
  ContractCategoryName?: string;
  ProcedureCallType?: string;
  Announced?: string;
  LastUpdated?: string;
  IsLatestVersion?: boolean;
}

interface EjnProcedureDetail {
  SubmissionDeadline?: string;
  DeadlineForSubmission?: string;
  [key: string]: unknown;
}

function mapEntity(name?: string): string {
  if (!name) return "FBiH";
  const n = name.toLowerCase();
  if (n.includes("federacija") || n.includes("fbih")) return "FBiH";
  if (n.includes("republika srpska") || n.includes("rs")) return "RS";
  if (n.includes("brčko") || n.includes("brcko")) return "BD";
  return "International";
}

function mapCategory(contractType?: string, categoryName?: string): string {
  const cat = categoryName?.toLowerCase() || "";
  const type = contractType?.toLowerCase() || "";

  if (cat.includes("osigur")) return "Osiguranje";
  if (cat.includes("it") || cat.includes("informatič") || cat.includes("softver") || cat.includes("telekomunikac")) return "IT usluge";
  if (cat.includes("građevin") || cat.includes("radovi") || type === "works") return "Građevinski radovi";
  if (cat.includes("medicin") || cat.includes("farmaceutsk") || cat.includes("zdravstv")) return "Medicinska oprema";
  if (cat.includes("uredsk") || cat.includes("kancelarij") || cat.includes("papir")) return "Uredski materijal";
  if (cat.includes("konsalt") || cat.includes("savjet") || cat.includes("legal") || cat.includes("pravni")) return "Konsalting";
  if (cat.includes("vozil") || cat.includes("transport") || cat.includes("prijevoz")) return "Vozila i transport";
  if (cat.includes("čišćenj") || cat.includes("higijen")) return "Komunalne usluge";
  if (type === "services") return "Usluge";
  if (type === "works") return "Radovi";
  if (type === "supplies") return "Nabavka opreme";
  return "Ostalo";
}

function mapSource(procedureCallType?: string): string {
  const t = procedureCallType?.toLowerCase() || "";
  if (t.includes("open")) return "EJN-Otvoreni";
  if (t.includes("restricted")) return "EJN-Ograničeni";
  if (t.includes("direct")) return "EJN-Direktni";
  return "EJN";
}

function fallbackDeadline(announced?: string): Date {
  const base = announced ? new Date(announced) : new Date();
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
}

let _loggedDetailFields = false;

async function fetchDeadline(itemId: number, announced?: string): Promise<Date> {
  try {
    const url = `${EJN_BASE}/AnnouncementProcedureCalls(${itemId})?$format=json`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, itemId }, "EJN detail fetch non-OK, using fallback deadline");
      return fallbackDeadline(announced);
    }

    const detail = await response.json() as EjnProcedureDetail;

    if (!_loggedDetailFields) {
      logger.info({ fields: Object.keys(detail) }, "EJN detail fields (first fetch)");
      _loggedDetailFields = true;
    }

    const deadlineStr = detail.SubmissionDeadline ?? detail.DeadlineForSubmission ?? null;

    if (deadlineStr && typeof deadlineStr === "string") {
      const d = new Date(deadlineStr);
      if (!isNaN(d.getTime())) return d;
    }

    return fallbackDeadline(announced);
  } catch (err) {
    logger.warn({ err, itemId }, "EJN detail fetch failed, using fallback deadline");
    return fallbackDeadline(announced);
  }
}

async function sendHighRelevanceNotifications(insertedIds: string[]): Promise<void> {
  if (insertedIds.length === 0) return;

  try {
    const highScoreTenders = await db
      .select({
        id: tendersTable.id,
        title: tendersTable.title,
        relevanceScore: aiAnalysisTable.relevanceScore,
      })
      .from(tendersTable)
      .innerJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
      .where(gte(aiAnalysisTable.relevanceScore, 75))
      .limit(10);

    const relevantIds = new Set(insertedIds);
    const matched = highScoreTenders.filter((t) => relevantIds.has(t.id));

    if (matched.length === 0) return;

    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);

    const notifications = [];
    for (const tender of matched.slice(0, 10)) {
      for (const user of allUsers) {
        notifications.push({
          id: nanoid(),
          userId: user.id,
          type: "tender",
          title: "Novi relevantni tender",
          message: tender.title,
          tenderId: tender.id,
          read: false,
        });
      }
    }

    if (notifications.length > 0) {
      await db.insert(notificationsTable).values(notifications);
      logger.info({ count: notifications.length }, "High-relevance tender notifications sent");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to send high-relevance notifications");
  }
}

export async function runEjnScraper(logId: string, signal?: AbortSignal): Promise<number> {
  let inserted = 0;
  let skip = 0;
  const top = 100;
  let hasMore = true;
  const insertedIds: string[] = [];

  while (hasMore) {
    if (signal?.aborted) break;

    const params = new URLSearchParams({
      "$top": String(top),
      "$skip": String(skip),
      "$orderby": "Announced desc",
      "$filter": "IsLatestVersion eq true",
      "$format": "json",
    });

    const url = `${EJN_BASE}/AnnouncementProcedureCalls?${params}`;
    let items: EjnProcedureCall[] = [];

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "EJN API non-OK response");
        break;
      }

      const data = await response.json() as { value?: EjnProcedureCall[] };
      items = data.value || [];
    } catch (err) {
      logger.error({ err }, "EJN fetch failed");
      break;
    }

    if (items.length === 0) break;

    for (const item of items) {
      if (signal?.aborted) break;

      const externalId = `EJN-${item.Id}`;

      const existing = await db
        .select({ id: tendersTable.id })
        .from(tendersTable)
        .where(eq(tendersTable.externalId, externalId))
        .limit(1);

      if (existing.length > 0) continue;

      const category = mapCategory(item.ContractType, item.ContractCategoryName);
      const entity = mapEntity(item.ContractingAuthorityAdministrativeUnitName);
      const deadline = await fetchDeadline(item.Id, item.Announced);
      const source = mapSource(item.ProcedureCallType);

      const ejnLink = item.Id
        ? `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/${item.Id}`
        : null;

      const tenderId = nanoid();
      await db.insert(tendersTable).values({
        id: tenderId,
        externalId,
        title: item.ProcedureName || `Tender ${item.Number || item.Id}`,
        contractingAuth: item.ContractingAuthorityName || "N/A",
        entity,
        category,
        source,
        tenderType: item.ContractType || "Services",
        status: "open",
        publicationDate: item.Announced ? new Date(item.Announced) : new Date(),
        deadline,
        estimatedValue: null,
        currency: "KM",
        cpvCodes: item.ContractCategoryName ? [item.ContractCategoryName] : [],
        location: item.ContractingAuthorityCityName || null,
        description: `${item.ProcedureCallType || ""} - ${item.ContractCategoryName || ""}`.trim() || null,
        sourceUrl: ejnLink,
        relevanceScore: null,
        scrapedAt: new Date(),
      });

      insertedIds.push(tenderId);
      inserted++;
    }

    if (items.length < top) {
      hasMore = false;
    } else {
      skip += top;
    }

    if (skip >= 500) break;
  }

  logger.info({ inserted, logId }, "EJN scraper finished");

  if (inserted > 0) {
    await sendHighRelevanceNotifications(insertedIds);
  }

  return inserted;
}
