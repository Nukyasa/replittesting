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

const EJN_BASE = "https://open.ejn.gov.ba";

interface EjnAnnouncement {
  Id: number;
  Subject?: string;
  PublicationDate?: string;
  DeadlineDate?: string;
  QuestionsDeadline?: string;
  EstimatedValue?: number;
  CurrencyCode?: string;
  ContractingAuthorityName?: string;
  ContractingAuthorityCityName?: string;
  ContractingAuthorityCountryCode?: string;
  ProcurementType?: string;
  ProcurementTypeName?: string;
  StatusId?: number;
  StatusName?: string;
  CpvCode?: string;
  CpvName?: string;
  HasEAuction?: boolean;
  AnnouncementUrl?: string;
  AwardCriteria?: string;
  AwardCriteriaDetails?: string;
  TenderPreparationCost?: number;
  RequiredGuaranteeAmount?: number;
  RequiredGuaranteeType?: string;
  IsLatestVersion?: boolean;
}

function mapStatus(statusId?: number): string {
  switch (statusId) {
    case 1: return "open";
    case 2: return "closed";
    case 3: return "cancelled";
    default: return "open";
  }
}

function mapStatusName(statusId?: number, statusName?: string): string {
  if (statusName) return statusName;
  switch (statusId) {
    case 1: return "Aktivan";
    case 2: return "Zatvoren";
    case 3: return "Poništen";
    default: return "Nepoznat";
  }
}

function mapEntity(cityName?: string, countryCode?: string): string {
  const city = (cityName || "").toLowerCase();
  const country = (countryCode || "").toLowerCase();

  if (country && country !== "ba") return "International";
  if (city.includes("banja luka") || city.includes("prijedor") || city.includes("bijeljina") || city.includes("trebinje")) return "RS";
  if (city.includes("mostar") || city.includes("sarajevo") || city.includes("tuzla") || city.includes("zenica")) return "FBiH";
  if (city.includes("brčko") || city.includes("brcko")) return "BD";
  return "FBiH";
}

function mapCategory(procurementType?: string, cpvName?: string): string {
  const cat = (cpvName || "").toLowerCase();
  const type = (procurementType || "").toLowerCase();

  if (cat.includes("osigur") || cat.includes("insurance")) return "Osiguranje";
  if (cat.includes("it") || cat.includes("informatič") || cat.includes("softver") || cat.includes("telekomunikac") || cat.includes("računar")) return "IT usluge";
  if (cat.includes("građevin") || cat.includes("radovi") || type.includes("works")) return "Građevinski radovi";
  if (cat.includes("medicin") || cat.includes("farmaceutsk") || cat.includes("zdravstv")) return "Medicinska oprema";
  if (cat.includes("uredsk") || cat.includes("kancelarij") || cat.includes("papir")) return "Uredski materijal";
  if (cat.includes("konsalt") || cat.includes("savjet") || cat.includes("legal") || cat.includes("pravni")) return "Konsalting";
  if (cat.includes("vozil") || cat.includes("transport") || cat.includes("prijevoz")) return "Vozila i transport";
  if (cat.includes("čišćenj") || cat.includes("higijen")) return "Komunalne usluge";
  if (cat.includes("marketing") || cat.includes("reklam") || cat.includes("oglašav")) return "Marketing";
  if (type.includes("services")) return "Usluge";
  if (type.includes("works")) return "Radovi";
  if (type.includes("supplies")) return "Nabavka opreme";
  return "Ostalo";
}

function mapSource(procurementType?: string): string {
  const t = (procurementType || "").toLowerCase();
  if (t.includes("open") || t.includes("otvor")) return "EJN-Otvoreni";
  if (t.includes("restrict") || t.includes("ogranič")) return "EJN-Ograničeni";
  if (t.includes("direct") || t.includes("direktn")) return "EJN-Direktni";
  return "EJN";
}

function fallbackDeadline(publicationDate?: string): Date {
  const base = publicationDate ? new Date(publicationDate) : new Date();
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
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
  live: EjnAnnouncement
): Promise<void> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  const newDeadline = live.DeadlineDate ? new Date(live.DeadlineDate) : null;
  if (newDeadline && existingTender.deadline.getTime() !== newDeadline.getTime()) {
    changes.push({
      field: "deadline",
      oldValue: existingTender.deadline.toISOString(),
      newValue: newDeadline.toISOString(),
    });
  }

  const newQuestionsDeadline = live.QuestionsDeadline ? new Date(live.QuestionsDeadline) : null;
  const existingQD = existingTender.questionsDeadline;
  if (
    (newQuestionsDeadline && !existingQD) ||
    (!newQuestionsDeadline && existingQD) ||
    (newQuestionsDeadline && existingQD && newQuestionsDeadline.getTime() !== existingQD.getTime())
  ) {
    changes.push({
      field: "questionsDeadline",
      oldValue: existingQD ? existingQD.toISOString() : "N/A",
      newValue: newQuestionsDeadline ? newQuestionsDeadline.toISOString() : "N/A",
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

  const newStatus = mapStatus(live.StatusId);
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
  let updated = 0;
  let skip = 0;
  const top = 100;
  let hasMore = true;
  const insertedIds: string[] = [];

  while (hasMore) {
    if (signal?.aborted) break;

    const params = new URLSearchParams({
      "$top": String(top),
      "$skip": String(skip),
      "$orderby": "PublicationDate desc",
      "$filter": "IsLatestVersion eq true",
      "$format": "json",
    });

    const url = `${EJN_BASE}/Announcements?${params}`;
    let items: EjnAnnouncement[] = [];

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "EJN Announcements API non-OK response");
        break;
      }

      const data = await response.json() as { value?: EjnAnnouncement[] };
      items = data.value || [];
    } catch (err) {
      logger.error({ err }, "EJN Announcements fetch failed");
      break;
    }

    if (items.length === 0) break;

    for (const item of items) {
      if (signal?.aborted) break;

      const externalId = `EJN-${item.Id}`;

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

      const category = mapCategory(item.ProcurementType, item.CpvName);
      const entity = mapEntity(item.ContractingAuthorityCityName, item.ContractingAuthorityCountryCode);
      const source = mapSource(item.ProcurementType);
      const status = mapStatus(item.StatusId);
      const statusName = mapStatusName(item.StatusId, item.StatusName);

      const deadline = item.DeadlineDate
        ? new Date(item.DeadlineDate)
        : fallbackDeadline(item.PublicationDate);

      const questionsDeadline = item.QuestionsDeadline ? new Date(item.QuestionsDeadline) : null;

      const ejnLink = item.AnnouncementUrl ||
        (item.Id ? `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/${item.Id}` : "");

      const tenderId = nanoid();
      await db.insert(tendersTable).values({
        id: tenderId,
        externalId,
        title: item.Subject || `Tender ${item.Id}`,
        contractingAuth: item.ContractingAuthorityName || "N/A",
        entity,
        category,
        source,
        tenderType: item.ProcurementType || "Services",
        status,
        statusName,
        publicationDate: item.PublicationDate ? new Date(item.PublicationDate) : new Date(),
        deadline,
        questionsDeadline,
        estimatedValue: item.EstimatedValue ?? null,
        currency: item.CurrencyCode || "KM",
        cpvCodes: [item.CpvCode, item.CpvName].filter(Boolean) as string[],
        description: item.CpvName ? `${item.ProcurementTypeName || ""} — ${item.CpvName}`.trim() : null,
        sourceUrl: ejnLink,
        hasEAuction: item.HasEAuction ?? false,
        awardCriteria: item.AwardCriteria || null,
        awardCriteriaDetails: item.AwardCriteriaDetails || null,
        guaranteeAmount: item.RequiredGuaranteeAmount ?? null,
        guaranteeType: item.RequiredGuaranteeType || null,
        tenderPreparationCost: item.TenderPreparationCost ?? null,
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

  logger.info({ inserted, updated, logId }, "EJN scraper finished");

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
    const ejnNumId = tender.externalId.replace("EJN-", "");
    if (!ejnNumId || isNaN(Number(ejnNumId))) continue;

    try {
      const url = `${EJN_BASE}/Announcements(${ejnNumId})?$format=json`;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const live = await response.json() as EjnAnnouncement;
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
    .select({
      id: tendersTable.id,
      title: tendersTable.title,
      deadline: tendersTable.deadline,
    })
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
