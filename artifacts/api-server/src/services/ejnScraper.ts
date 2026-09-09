import { db } from "@workspace/db";
import puppeteer from 'puppeteer';
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
import { isRealInsuranceTender } from "../lib/tenderFilter";

const EJN_BASE = "https://open.ejn.gov.ba";

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt > options.maxRetries) {
        throw lastError;
      }

      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1),
        options.maxDelayMs
      );

      logger.warn(
        { attempt, maxRetries: options.maxRetries, delay, error: lastError.message },
        `Retryable error, attempt ${attempt}/${options.maxRetries + 1}, waiting ${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

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
  const notifications = allUsers.map((user: any) => ({
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
    const matched = highScoreTenders.filter((t: any) => relevantIds.has(t.id));
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
  const username = process.env.EJN_USER || "almir.zeljkovic";
  const password = process.env.EJN_PASS || "Start.2024";

  logger.info({ username }, "[EJN SECURE] Pokrećem autorizaciju preko Puppeteer-a na https://www.ejn.gov.ba/Home/Index");
  scraperEvents.emit("progress", {
    source: "ejn",
    status: "running",
    message: `[EJN SECURE] Pokrećem prijavu u headless Chrome browseru sa nalogom: ${username}...`,
  });

  let inserted = 0;
  let updated = 0;
  const insertedIds: string[] = [];
  let items: any[] = [];

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://www.ejn.gov.ba/Home/Index', { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => {
      // @ts-ignore
      const loginBtn = document.querySelector('a[href="/Profile/SignIn"]');
      // @ts-ignore
      if (loginBtn) loginBtn.click();
    });
    
    await page.waitForSelector('#UserName', { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.type('#UserName', username);
    await page.type('#Password', password);
    await page.click('button[type="submit"].btn-sign-in');
    
    await new Promise(r => setTimeout(r, 3000));
    
    logger.info("[EJN SECURE] Prijava uspješna! Sesijski kolačići učitani.");
    scraperEvents.emit("progress", {
      source: "ejn",
      status: "running",
      message: `[EJN SECURE] Prijava uspješna! Pretražujem najnovije tendere...`,
    });

    await page.setRequestInterception(true);

    const searchResponsePromise = new Promise<any[]>((resolve) => {
      page.on('request', interceptedRequest => {
        interceptedRequest.continue();
      });

      page.on('response', async (response) => {
        const url = response.url();
        const request = response.request();
        if (request.method() === 'POST' && url.includes('/api/Announcement/Search')) {
          try {
            const body = await response.json();
            if (body && body.records) {
              resolve(body.records);
            }
          } catch(e) {}
        }
      });
      setTimeout(() => resolve([]), 20000);
    });

    await page.goto('https://www.ejn.gov.ba/Announcement/Search', { waitUntil: 'networkidle2' });

    // Wait for the form to be ready
    await page.waitForSelector('#Procedure', { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // Simulate clicking search to get the latest tenders without any keyword filter
    await page.evaluate(() => {
      // @ts-ignore
      const btn = document.querySelector('.btn-search');
      // @ts-ignore
      if (btn) btn.click();
    });

    items = await searchResponsePromise;
    await browser.close();
  } catch(e) {
    logger.error({ error: e }, "Puppeteer scraper failed");
    scraperEvents.emit("progress", {
      source: "ejn",
      status: "error",
      message: `[EJN SECURE] Greška pri pokretanju Puppeteer scrapera.`,
    });
    return 0;
  }

  if (items.length === 0) {
    logger.info("Nije pronađen nijedan tender sa tom ključnom riječi.");
    return 0;
  }

  const filteredItems = items.filter((item: any) => isRealInsuranceTender(item.name || "", ""));

  logger.info({ count: filteredItems.length }, "EJN search items fetched after filtering");

  for (const item of filteredItems) {
    if (signal?.aborted) break;

    const externalId = `EJN-SEARCH-${item.id}`;

    const [existing] = await db
      .select({ id: tendersTable.id })
      .from(tendersTable)
      .where(eq(tendersTable.externalId, externalId))
      .limit(1);

    if (existing) {
      updated++;
      continue;
    }

    const category = mapCategory(item.name, "");
    const entity = mapEntity("", item.legalEntity);
    const source = "EJN-Search";

    let deadline = fallbackDeadline();
    if (item.date) {
      const parts = item.date.split('.');
      if (parts.length >= 3) {
        deadline = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }

    let status = "open";
    let statusName = "Aktivan";
    if (item.announcementType && item.announcementType.toLowerCase().includes("dodjel")) {
      status = "closed";
      statusName = "Dodijeljen";
    } else if (item.announcementType && item.announcementType.toLowerCase().includes("ponište")) {
      status = "cancelled";
      statusName = "Poništen";
    }

    const ejnLink = item.downloadUrl ? item.downloadUrl : `https://www.ejn.gov.ba/Announcement/Search`;
    const tenderId = nanoid();

    await db.insert(tendersTable).values({
      id: tenderId,
      externalId,
      title: item.name || `Tender ${item.id}`,
      contractingAuth: item.legalEntity || "N/A",
      entity,
      category,
      source,
      tenderType: "Usluge",
      status,
      statusName,
      publicationDate: new Date(),
      deadline,
      questionsDeadline: null,
      estimatedValue: null,
      currency: "KM",
      cpvCodes: [],
      description: item.announcementType || null,
      sourceUrl: ejnLink,
      hasEAuction: item.isAuctionOnline ?? false,
      awardCriteria: null,
      awardCriteriaDetails: null,
      guaranteeAmount: null,
      guaranteeType: null,
      tenderPreparationCost: null,
    });

    scraperEvents.emit("new_tender", {
      tender: {
        id: tenderId,
        title: item.name || `Tender ${item.id}`,
        contractingAuth: item.legalEntity || "N/A",
        estimatedValue: null,
        currency: "KM",
        deadline: deadline.toISOString(),
      },
      isInsurance: true,
    });

    insertedIds.push(tenderId);
    inserted++;
  }

  logger.info({ inserted, updated, logId }, "EJN Search scraper finished");

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

  const comingSoon = expiringSoon.filter((t: any) => t.deadline <= threeDays);
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
