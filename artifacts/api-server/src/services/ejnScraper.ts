import { db } from "@workspace/db";
import {
  tendersTable,
  scraperLogsTable,
  aiAnalysisTable,
  notificationsTable,
  usersTable,
  tenderChangesTable,
} from "@workspace/db";
import { eq, gte, and } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import { scraperEvents } from "../lib/scraperEvents";

const EJN_BASE = "https://open.ejn.gov.ba";

const INSURANCE_FILTER =
  "contains(tolower(ProcedureName),'osiguranj') or " +
  "contains(tolower(ProcedureName),'kasko') or " +
  "contains(tolower(ProcedureName),'insurance') or " +
  "contains(tolower(ContractCategoryName),'osiguranj')";

const LOT_SELECT = [
  "Id", "ProcedureId", "ProcedureName",
  "ContractingAuthorityName", "ContractingAuthorityCityName",
  "ContractingAuthorityAdministrativeUnitName",
  "EstimatedValue", "Status",
  "ProcurementPhaseOfferSubmissionDeadline",
  "ApplicationDeadlineDateTime",
  "IsAuctionOnline", "AwardCriterion",
  "ContractCategoryName", "ContractType",
  "ShortDescription", "LastUpdated",
].join(",");

interface EjnLot {
  Id: number;
  ProcedureId?: number;
  ProcedureName?: string;
  ContractingAuthorityName?: string;
  ContractingAuthorityCityName?: string;
  ContractingAuthorityAdministrativeUnitName?: string;
  EstimatedValue?: number;
  Status?: string;
  ProcurementPhaseOfferSubmissionDeadline?: string;
  ApplicationDeadlineDateTime?: string;
  IsAuctionOnline?: boolean;
  AwardCriterion?: string;
  ContractCategoryName?: string;
  ContractType?: string;
  ShortDescription?: string;
  LastUpdated?: string;
}

function qs(s: string): string {
  return s.replace(/ /g, "%20").replace(/'/g, "%27");
}

function buildLotsUrl(top: number, skip: number, extraFilter?: string): string {
  const filter = extraFilter
    ? `(${INSURANCE_FILTER}) and (${extraFilter})`
    : `(${INSURANCE_FILTER})`;
  return (
    `${EJN_BASE}/Lots` +
    `?$top=${top}` +
    `&$skip=${skip}` +
    `&$format=json` +
    `&$select=${LOT_SELECT}` +
    `&$filter=${qs(filter)}`
  );
}

function mapStatus(status?: string): string {
  switch ((status || "").toLowerCase()) {
    case "announced": return "open";
    case "awarded": return "closed";
    case "cancelled":
    case "terminated": return "cancelled";
    default: return "open";
  }
}

function mapStatusName(status?: string): string {
  switch ((status || "").toLowerCase()) {
    case "announced": return "Aktivan";
    case "awarded": return "Dodijeljen";
    case "cancelled": return "Poništen";
    case "terminated": return "Prekinut";
    default: return "Nepoznat";
  }
}

function mapEntity(unitName?: string, cityName?: string): string {
  const unit = (unitName || "").toLowerCase();
  const city = (cityName || "").toLowerCase();

  if (unit.includes("federacija") || unit.includes("kanton")) return "FBiH";
  if (unit.includes("republika srpska")) return "RS";
  if (unit.includes("brčko") || unit.includes("brcko") || city.includes("brčko") || city.includes("brcko")) return "BD";
  if (city.includes("banja luka") || city.includes("trebinje") || city.includes("bijeljina") || city.includes("prijedor")) return "RS";
  if (city.includes("mostar") || city.includes("sarajevo") || city.includes("tuzla") || city.includes("zenica")) return "FBiH";
  return "FBiH";
}

function mapCategory(categoryName?: string, contractType?: string): string {
  const cat = (categoryName || "").toLowerCase();
  const type = (contractType || "").toLowerCase();

  if (cat.includes("osiguranj") || cat.includes("insurance")) return "Osiguranje";
  if (cat.includes("informatič") || cat.includes("softver") || cat.includes("telekomunikac") || cat.includes("it usluge")) return "IT usluge";
  if (cat.includes("građevin") || type === "works") return "Građevinski radovi";
  if (cat.includes("medicin") || cat.includes("farmaceutsk") || cat.includes("zdravstv")) return "Medicinska oprema";
  if (cat.includes("uredsk") || cat.includes("kancelarij")) return "Uredski materijal";
  if (cat.includes("konsalt") || cat.includes("savjet") || cat.includes("pravni")) return "Konsalting";
  if (cat.includes("vozil") || cat.includes("transport") || cat.includes("prijevoz")) return "Vozila i transport";
  if (cat.includes("čišćenj") || cat.includes("higijen")) return "Komunalne usluge";
  if (cat.includes("marketing") || cat.includes("reklam")) return "Marketing";
  if (type === "services" || cat.includes("usluge")) return "Usluge";
  if (type === "works") return "Radovi";
  if (type === "goods" || cat.includes("kupovina")) return "Nabavka opreme";
  return "Ostalo";
}

function mapSource(contractType?: string): string {
  switch ((contractType || "").toLowerCase()) {
    case "services": return "EJN-Usluge";
    case "goods": return "EJN-Roba";
    case "works": return "EJN-Radovi";
    default: return "EJN";
  }
}

function fallbackDeadline(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

async function detectAndSaveChanges(
  tenderId: string,
  existingTender: {
    deadline: Date;
    questionsDeadline: Date | null;
    estimatedValue: number | null;
    status: string;
    title: string;
  },
  live: EjnLot
): Promise<void> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  const newDeadline = live.ProcurementPhaseOfferSubmissionDeadline
    ? new Date(live.ProcurementPhaseOfferSubmissionDeadline) : null;
  if (newDeadline && existingTender.deadline.getTime() !== newDeadline.getTime()) {
    changes.push({
      field: "deadline",
      oldValue: existingTender.deadline.toISOString(),
      newValue: newDeadline.toISOString(),
    });
  }

  const newQD = live.ApplicationDeadlineDateTime ? new Date(live.ApplicationDeadlineDateTime) : null;
  const existingQD = existingTender.questionsDeadline;
  if (
    (newQD && !existingQD) || (!newQD && existingQD) ||
    (newQD && existingQD && newQD.getTime() !== existingQD.getTime())
  ) {
    changes.push({
      field: "questionsDeadline",
      oldValue: existingQD ? existingQD.toISOString() : "N/A",
      newValue: newQD ? newQD.toISOString() : "N/A",
    });
  }

  const newValue = live.EstimatedValue ?? null;
  if (String(existingTender.estimatedValue) !== String(newValue)) {
    changes.push({
      field: "estimatedValue",
      oldValue: String(existingTender.estimatedValue ?? "N/A"),
      newValue: String(newValue ?? "N/A"),
    });
  }

  const newStatus = mapStatus(live.Status);
  if (existingTender.status !== newStatus) {
    changes.push({
      field: "status",
      oldValue: existingTender.status,
      newValue: newStatus,
    });
  }

  if (changes.length === 0) return;

  await db.insert(tenderChangesTable).values(
    changes.map((c) => ({
      id: nanoid(),
      tenderId,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
    }))
  );

  const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
  const fieldLabels: Record<string, string> = {
    deadline: "rok za prijem ponuda",
    questionsDeadline: "rok za pitanja",
    estimatedValue: "procijenjena vrijednost",
    status: "status tendera",
  };

  const changedFields = changes.map((c) => fieldLabels[c.field] || c.field).join(", ");
  const notifications = allUsers.map((user) => ({
    id: nanoid(),
    userId: user.id,
    type: "change",
    title: "Izmjena na tenderu",
    message: `${existingTender.title} — izmijenjeno: ${changedFields}`,
    tenderId,
    read: false,
  }));

  if (notifications.length > 0) {
    await db.insert(notificationsTable).values(notifications);
    logger.info({ tenderId, count: changes.length }, "Tender changes detected and saved");
  }
}

async function sendHighRelevanceNotifications(insertedIds: string[]): Promise<void> {
  if (insertedIds.length === 0) return;
  try {
    const highScoreTenders = await db
      .select({ id: tendersTable.id, title: tendersTable.title, relevanceScore: aiAnalysisTable.relevanceScore })
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
  let updated = 0;
  let skip = 0;
  const top = 100;
  let hasMore = true;
  const insertedIds: string[] = [];

  while (hasMore) {
    if (signal?.aborted) break;

    const url = buildLotsUrl(top, skip);

    let items: EjnLot[] = [];
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        logger.warn({ status: response.status, url }, "EJN Lots API non-OK response");
        break;
      }

      const data = await response.json() as { value?: EjnLot[] };
      items = data.value || [];
    } catch (err) {
      logger.error({ err }, "EJN Lots fetch failed");
      break;
    }

    if (items.length === 0) break;

    logger.info({ count: items.length, skip }, "EJN insurance lots fetched");

    for (const item of items) {
      if (signal?.aborted) break;

      const externalId = `EJN-LOT-${item.Id}`;

      const [existing] = await db
        .select({
          id: tendersTable.id,
          deadline: tendersTable.deadline,
          questionsDeadline: tendersTable.questionsDeadline,
          estimatedValue: tendersTable.estimatedValue,
          status: tendersTable.status,
          title: tendersTable.title,
        })
        .from(tendersTable)
        .where(eq(tendersTable.externalId, externalId))
        .limit(1);

      if (existing) {
        await detectAndSaveChanges(existing.id, existing, item);
        updated++;
        continue;
      }

      const category = mapCategory(item.ContractCategoryName, item.ContractType);
      const entity = mapEntity(item.ContractingAuthorityAdministrativeUnitName, item.ContractingAuthorityCityName);
      const source = mapSource(item.ContractType);
      const status = mapStatus(item.Status);
      const statusName = mapStatusName(item.Status);

      const deadline = item.ProcurementPhaseOfferSubmissionDeadline
        ? new Date(item.ProcurementPhaseOfferSubmissionDeadline)
        : fallbackDeadline();

      const questionsDeadline = item.ApplicationDeadlineDateTime
        ? new Date(item.ApplicationDeadlineDateTime) : null;

      const ejnLink = `https://next.ejn.gov.ba/bs-latn-ba/procurements/procedure-call/${item.ProcedureId ?? item.Id}`;

      const tenderId = nanoid();
      await db.insert(tendersTable).values({
        id: tenderId,
        externalId,
        title: item.ProcedureName || `Lot ${item.Id}`,
        contractingAuth: item.ContractingAuthorityName || "N/A",
        entity,
        category,
        source,
        tenderType: item.ContractType || "Services",
        status,
        statusName,
        publicationDate: item.LastUpdated ? new Date(item.LastUpdated) : new Date(),
        deadline,
        questionsDeadline,
        estimatedValue: item.EstimatedValue ?? null,
        currency: "KM",
        cpvCodes: [],
        description: item.ShortDescription || item.ContractCategoryName || null,
        sourceUrl: ejnLink,
        hasEAuction: item.IsAuctionOnline ?? false,
        awardCriteria: item.AwardCriterion || null,
        awardCriteriaDetails: null,
        guaranteeAmount: null,
        guaranteeType: null,
        tenderPreparationCost: null,
      });

      scraperEvents.emit("new_tender", {
        tender: {
          id: tenderId,
          title: item.ProcedureName || `Lot ${item.Id}`,
          contractingAuth: item.ContractingAuthorityName || "N/A",
          estimatedValue: item.EstimatedValue ?? null,
          currency: "KM",
          deadline: deadline.toISOString(),
        },
        isInsurance: true,
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

  logger.info({ inserted, updated, logId }, "EJN insurance scraper finished");

  if (inserted > 0) {
    await sendHighRelevanceNotifications(insertedIds);
  }

  return inserted;
}

export async function syncActiveEjnTenders(): Promise<void> {
  const activeTenders = await db
    .select({
      id: tendersTable.id,
      externalId: tendersTable.externalId,
      deadline: tendersTable.deadline,
      questionsDeadline: tendersTable.questionsDeadline,
      estimatedValue: tendersTable.estimatedValue,
      status: tendersTable.status,
      title: tendersTable.title,
    })
    .from(tendersTable)
    .where(eq(tendersTable.status, "open"))
    .limit(200);

  let checked = 0;
  let changed = 0;

  for (const tender of activeTenders) {
    const ejnNumId = tender.externalId.replace("EJN-LOT-", "").replace("EJN-", "");
    if (!ejnNumId || isNaN(Number(ejnNumId))) continue;

    try {
      const url = `${EJN_BASE}/Lots(${ejnNumId})?$format=json&$select=${LOT_SELECT}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const live = await response.json() as EjnLot;
      const before = changed;
      await detectAndSaveChanges(tender.id, tender, live);
      if (changed > before) changed++;
      checked++;
    } catch (err) {
      logger.warn({ err, tenderId: tender.id }, "Sync check failed for tender");
    }
  }

  logger.info({ checked, changed }, "Active tender sync completed");
}

export async function sendDeadlineReminders(): Promise<void> {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringSoon = await db
    .select({ id: tendersTable.id, title: tendersTable.title, deadline: tendersTable.deadline })
    .from(tendersTable)
    .where(and(eq(tendersTable.status, "open"), gte(tendersTable.deadline, now)))
    .limit(50);

  const comingSoon = expiringSoon.filter((t) => t.deadline <= threeDays);
  if (comingSoon.length === 0) return;

  const allUsers = await db.select({ id: usersTable.id }).from(usersTable);

  const notifications = [];
  for (const tender of comingSoon) {
    const daysLeft = Math.ceil((tender.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    for (const user of allUsers) {
      notifications.push({
        id: nanoid(),
        userId: user.id,
        type: "deadline",
        title: "Rok za predaju uskoro ističe",
        message: `${tender.title} — rok za predaju za ${daysLeft} ${daysLeft === 1 ? "dan" : "dana"}!`,
        tenderId: tender.id,
        read: false,
      });
    }
  }

  if (notifications.length > 0) {
    await db.insert(notificationsTable).values(notifications);
    logger.info({ count: notifications.length }, "Deadline reminder notifications sent");
  }
}
