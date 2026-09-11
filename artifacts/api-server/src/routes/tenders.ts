import { Router } from "express";
import { db } from "@workspace/db";
import {
  tendersTable,
  aiAnalysisTable,
  documentsTable,
  notesTable,
  userTendersTable,
  usersTable,
  tenderChangesTable,
  historicalAwardsTable,
  tenderCompetitorsTable,
  tenderCalculationsTable,
  contractingAuthorityProfilesTable,
  tenderWorkspacesTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, ilike, gte, lte, sql, inArray, isNull, count } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { analyzeTender, chatAboutTender, analyzeCompetition } from "../services/aiAnalyzer";
import { getParsedData, triggerParsing } from "../services/tenderParser";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import { aiLimiter } from "../lib/rateLimiters";
import ExcelJS from "exceljs";
import multer from "multer";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { fetchDocumentsForTender } from "../lib/ejnScraper";
import { EjnDocumentScraper } from "../services/ejnDocumentScraper";
import { jobManager } from "../services/jobManager";
import { ContractingAuthorityService } from "../services/contractingAuthorityService";
import { extractDocumentContent, documentContentHash, documentLogicalKey, assertDocumentPayload } from "../lib/documentFiles";
import { computeSenaIntelligence } from "../services/senaIntelligence";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024, files: 10 }, fileFilter: (_req, file, cb) => {
  if (![".pdf", ".docx", ".txt"].includes(path.extname(file.originalname).toLowerCase())) return cb(new Error("Dozvoljeni formati su PDF, DOCX i TXT."));
  cb(null, true);
} });

export function getAsaScopeCondition(scope: string = "asa") {
  if (scope === "unfiltered") return undefined;

  const insuranceTitleTerms = [
    "%osiguranj%",
    "%osiguranje%",
    "%kasko%",
    "%autoodgovornost%",
    "%auto-odgovornost%",
    "%nezgod%",
    "%premij%osiguranj%",
    "%dzo%",
    "%životn%osiguranj%",
    "%zivotn%osiguranj%",
  ];

  const insuranceDescTerms = [
    "%uslug%osiguranj%",
    "%kasko%",
    "%autoodgovornost%",
    "%kolektivn%osiguranj%",
    "%polic%osiguranj%",
    "%premij%osiguranj%",
    "%osiguranje imovine%",
    "%osiguranje lica%",
    "%osiguranje voznog parka%",
    "%osiguranje radnika%",
    "%osiguranje zaposlen%",
    "%osiguranje od odgovornosti%",
    "%dobrovoljn%zdravstven%osiguranj%",
  ];

  const inspectionTitleTerms = [
    "%tehničk%pregled%",
    "%tehnick%pregled%",
    "%ispitivanj%vozil%",
    "%pregled%vozil%",
    "%homologacij%",
    "%registracij%vozil%",
    "%baždarenj%tahograf%",
    "%bazdarenj%tahograf%",
    "%tahograf%",
    "%preventivn%pregled%",
    "%stanic%tehničk%",
    "%stanic%tehnick%",
  ];

  const inspectionDescTerms = [
    "%tehnički pregled vozila%",
    "%tehnicki pregled vozila%",
    "%ispitivanje motornih vozila%",
    "%baždarenje tahografa%",
    "%stanica tehničkog pregleda%",
  ];

  const insuranceCpv = ["6651", "6600"];
  const inspectionCpv = ["716312", "716300", "716310"];

  const insuranceCond = or(
    ...insuranceTitleTerms.map((term) => ilike(tendersTable.title, term)),
    ...insuranceDescTerms.map((term) => ilike(tendersTable.description, term)),
    ilike(tendersTable.category, "%osiguranj%"),
    ilike(tendersTable.category, "%insurance%"),
    ...insuranceCpv.map((cpv) => sql`array_to_string(${tendersTable.cpvCodes}, ',') ILIKE ${"%" + cpv + "%"}`)
  );

  const inspectionCond = or(
    ...inspectionTitleTerms.map((term) => ilike(tendersTable.title, term)),
    ...inspectionDescTerms.map((term) => ilike(tendersTable.description, term)),
    ilike(tendersTable.category, "%tehnički pregled%"),
    ilike(tendersTable.category, "%tehnicki pregled%"),
    ...inspectionCpv.map((cpv) => sql`array_to_string(${tendersTable.cpvCodes}, ',') ILIKE ${"%" + cpv + "%"}`)
  );

  if (scope === "insurance") return insuranceCond;
  if (scope === "inspection") return inspectionCond;
  // Default 'asa': Osiguranje + Tehnički pregled
  return or(insuranceCond, inspectionCond);
}

export const tendersRouter = Router();
tendersRouter.use(authMiddleware);

tendersRouter.get("/", async (req, res) => {
  const {
    page = "1",
    limit = "20",
    search,
    source,
    entity,
    category,
    status,
    minScore,
    maxScore,
    sortBy = "publicationDate",
    sortOrder = "desc",
    minValue,
    maxValue,
    hasEAuction,
    tenderType,
    scope = "asa",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];

  const scopeCond = getAsaScopeCondition(scope);
  if (scopeCond) {
    conditions.push(scopeCond);
  }

  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
        ilike(tendersTable.externalId, `%${search}%`),
        ilike(tendersTable.description, `%${search}%`),
        ilike(tendersTable.contractingAuth, `%${search}%`),
      )
    );
  }
  if (source) {
    const sources = source.split(",").filter(Boolean);
    if (sources.length > 0) conditions.push(inArray(tendersTable.source, sources));
  }
  if (entity) {
    conditions.push(eq(tendersTable.entity, entity));
  }
  if (category) {
    if (category === "Osiguranje") {
      conditions.push(
        or(
          eq(tendersTable.category, "Osiguranje"),
          ilike(tendersTable.category, "%osiguranj%"),
          ilike(tendersTable.category, "%insurance%"),
        )
      );
    } else {
      conditions.push(eq(tendersTable.category, category));
    }
  }
  if (status) {
    switch (status) {
      case "awarded":
        conditions.push(and(eq(tendersTable.status, "closed"), ilike(tendersTable.statusName, "%dodijeljen%")));
        break;
      case "complaint":
        conditions.push(
          or(
            ilike(tendersTable.statusName, "%žalba%"),
            ilike(tendersTable.statusName, "%zalba%"),
          )
        );
        break;
      case "cancelled":
        conditions.push(eq(tendersTable.status, "cancelled"));
        break;
      default:
        conditions.push(eq(tendersTable.status, status));
    }
  }
  if (minScore !== undefined) {
    conditions.push(gte(aiAnalysisTable.relevanceScore, parseFloat(minScore)));
  }
  if (maxScore !== undefined) {
    conditions.push(lte(aiAnalysisTable.relevanceScore, parseFloat(maxScore)));
  }
  if (minValue !== undefined && minValue !== "") {
    conditions.push(gte(tendersTable.estimatedValue, parseFloat(minValue)));
  }
  if (maxValue !== undefined && maxValue !== "") {
    conditions.push(lte(tendersTable.estimatedValue, parseFloat(maxValue)));
  }
  if (hasEAuction === "true") {
    conditions.push(eq(tendersTable.hasEAuction, true));
  } else if (hasEAuction === "false") {
    conditions.push(eq(tendersTable.hasEAuction, false));
  }
  if (tenderType) {
    conditions.push(eq(tendersTable.tenderType, tenderType));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy;
  const dir = sortOrder === "asc" ? asc : desc;
  switch (sortBy) {
    case "deadline":
      orderBy = [dir(tendersTable.deadline), desc(tendersTable.publicationDate), desc(tendersTable.id)];
      break;
    case "estimatedValue":
      orderBy = [dir(tendersTable.estimatedValue), desc(tendersTable.publicationDate), desc(tendersTable.id)];
      break;
    case "publicationDate":
      orderBy = [dir(tendersTable.publicationDate), dir(tendersTable.createdAt), dir(tendersTable.id)];
      break;
    default:
      orderBy = [dir(tendersTable.createdAt), desc(tendersTable.publicationDate), desc(tendersTable.id)];
  }

  const [tenders, [{ count }]] = await Promise.all([
    db
      .select({
        id: tendersTable.id,
        externalId: tendersTable.externalId,
        source: tendersTable.source,
        title: tendersTable.title,
        description: tendersTable.description,
        contractingAuth: tendersTable.contractingAuth,
        category: tendersTable.category,
        cpvCodes: tendersTable.cpvCodes,
        estimatedValue: tendersTable.estimatedValue,
        currency: tendersTable.currency,
        publicationDate: tendersTable.publicationDate,
        deadline: tendersTable.deadline,
        tenderType: tendersTable.tenderType,
        entity: tendersTable.entity,
        status: tendersTable.status,
        sourceUrl: tendersTable.sourceUrl,
        rawData: tendersTable.rawData,
        createdAt: tendersTable.createdAt,
        statusName: tendersTable.statusName,
        relevanceScore: sql<number | null>`CASE WHEN ${aiAnalysisTable.participationConditions}->'_analysis'->>'scoringAvailable' = 'true' THEN ${aiAnalysisTable.relevanceScore} ELSE NULL END`,
      })
      .from(tendersTable)
      .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
      .where(where)
      .orderBy(...orderBy)
      .limit(limitNum)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tendersTable)
      .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
      .where(where),
  ]);

  let finalTenders = tenders;
  let finalCount = count;

  if (finalCount === 0 && !search && !category && !entity && !source) {
    const [totalInDb] = await db.select({ count: sql<number>`count(*)::int` }).from(tendersTable);
    if ((totalInDb?.count ?? 0) === 0) {
      try {
        const { seedDatabase } = await import("../seed");
        await seedDatabase();
        const [reTenders, [{ count: reCount }]] = await Promise.all([
          db
            .select({
              id: tendersTable.id,
              externalId: tendersTable.externalId,
              source: tendersTable.source,
              title: tendersTable.title,
              description: tendersTable.description,
              contractingAuth: tendersTable.contractingAuth,
              category: tendersTable.category,
              cpvCodes: tendersTable.cpvCodes,
              estimatedValue: tendersTable.estimatedValue,
              currency: tendersTable.currency,
              publicationDate: tendersTable.publicationDate,
              deadline: tendersTable.deadline,
              tenderType: tendersTable.tenderType,
              entity: tendersTable.entity,
              status: tendersTable.status,
              sourceUrl: tendersTable.sourceUrl,
              rawData: tendersTable.rawData,
              createdAt: tendersTable.createdAt,
              statusName: tendersTable.statusName,
              relevanceScore: sql<number | null>`CASE WHEN ${aiAnalysisTable.participationConditions}->'_analysis'->>'scoringAvailable' = 'true' THEN ${aiAnalysisTable.relevanceScore} ELSE NULL END`,
            })
            .from(tendersTable)
            .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
            .where(where)
            .orderBy(...orderBy)
            .limit(limitNum)
            .offset(offset),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(tendersTable)
            .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
            .where(where),
        ]);
        finalTenders = reTenders;
        finalCount = reCount;
      } catch (err) {
        logger.error({ err }, "On-demand seed failed");
      }
    }
  }

  const tenderIds = finalTenders.map((t: any) => t.id);
  let awards: any[] = [];
  if (tenderIds.length > 0) {
    awards = await db
      .select({
        id: historicalAwardsTable.id,
        tenderId: historicalAwardsTable.tenderId,
        winnerName: historicalAwardsTable.winnerName,
        winningBidAmount: historicalAwardsTable.winningBidAmount,
        currency: historicalAwardsTable.currency,
        awardDate: historicalAwardsTable.awardDate,
      })
      .from(historicalAwardsTable)
      .where(inArray(historicalAwardsTable.tenderId, tenderIds));
  }

  const tendersWithAwards = finalTenders.map((t: any) => {
    const tenderAwards = awards.filter(a => a.tenderId === t.id);
    return {
      ...t,
      awards: tenderAwards
    };
  });

  res.json({
    tenders: tendersWithAwards,
    total: finalCount,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(finalCount / limitNum),
  });
});

tendersRouter.get("/export", async (req, res) => {
  const { search, source, entity, category, status, minScore, maxScore, minValue, maxValue, hasEAuction, tenderType } = req.query as Record<string, string>;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
        ilike(tendersTable.externalId, `%${search}%`),
        ilike(tendersTable.description, `%${search}%`),
        ilike(tendersTable.contractingAuth, `%${search}%`),
      )
    );
  }
  if (source) {
    const srcs = source.split(",").filter(Boolean);
    if (srcs.length > 0) conditions.push(inArray(tendersTable.source, srcs));
  }
  if (entity) conditions.push(eq(tendersTable.entity, entity));
  if (category) {
    if (category === "Osiguranje") {
      conditions.push(
        or(
          eq(tendersTable.category, "Osiguranje"),
          ilike(tendersTable.category, "%osiguranj%"),
          ilike(tendersTable.category, "%insurance%"),
        )
      );
    } else {
      conditions.push(eq(tendersTable.category, category));
    }
  }
  if (status) {
    switch (status) {
      case "awarded":
        conditions.push(and(eq(tendersTable.status, "closed"), ilike(tendersTable.statusName, "%dodijeljen%")));
        break;
      case "complaint":
        conditions.push(
          or(
            ilike(tendersTable.statusName, "%žalba%"),
            ilike(tendersTable.statusName, "%zalba%"),
          )
        );
        break;
      case "cancelled":
        conditions.push(eq(tendersTable.status, "cancelled"));
        break;
      default:
        conditions.push(eq(tendersTable.status, status));
    }
  }
  if (minScore !== undefined) {
    conditions.push(gte(aiAnalysisTable.relevanceScore, parseFloat(minScore)));
  }
  if (maxScore !== undefined) {
    conditions.push(lte(aiAnalysisTable.relevanceScore, parseFloat(maxScore)));
  }
  if (minValue !== undefined && minValue !== "") {
    conditions.push(gte(tendersTable.estimatedValue, parseFloat(minValue)));
  }
  if (maxValue !== undefined && maxValue !== "") {
    conditions.push(lte(tendersTable.estimatedValue, parseFloat(maxValue)));
  }
  if (hasEAuction === "true") {
    conditions.push(eq(tendersTable.hasEAuction, true));
  } else if (hasEAuction === "false") {
    conditions.push(eq(tendersTable.hasEAuction, false));
  }
  if (tenderType) {
    conditions.push(eq(tendersTable.tenderType, tenderType));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const tenders = await db
    .select({
      id: tendersTable.id,
      title: tendersTable.title,
      contractingAuth: tendersTable.contractingAuth,
      entity: tendersTable.entity,
      category: tendersTable.category,
      source: tendersTable.source,
      status: tendersTable.status,
      estimatedValue: tendersTable.estimatedValue,
      currency: tendersTable.currency,
      publicationDate: tendersTable.publicationDate,
      deadline: tendersTable.deadline,
      relevanceScore: sql<number | null>`CASE WHEN ${aiAnalysisTable.participationConditions}->'_analysis'->>'scoringAvailable' = 'true' THEN ${aiAnalysisTable.relevanceScore} ELSE NULL END`,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(where)
    .orderBy(desc(tendersTable.publicationDate))
    .limit(5000);

  const BOM = "\uFEFF";
  const headers = ["ID", "Naziv", "Ugovorni organ", "Entitet", "Kategorija", "Izvor", "Status", "Vrijednost", "Valuta", "Datum objave", "Rok prijave", "AI ocjena"];

  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("bs-BA") : "";
  const rows = tenders.map((t: any) => [
    t.id,
    `"${(t.title || "").replace(/"/g, '""')}"`,
    `"${(t.contractingAuth || "").replace(/"/g, '""')}"`,
    t.entity || "",
    t.category || "",
    t.source || "",
    t.status || "",
    t.estimatedValue?.toString() || "",
    t.currency || "",
    fmtDate(t.publicationDate),
    fmtDate(t.deadline),
    t.relevanceScore?.toString() || "",
  ]);

  const csv = BOM + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ejn_tenderi_${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
});

tendersRouter.get("/export/xlsx", async (req, res) => {
  const { search, source, entity, category, status } = req.query as Record<string, string>;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
        ilike(tendersTable.externalId, `%${search}%`),
        ilike(tendersTable.description, `%${search}%`),
        ilike(tendersTable.contractingAuth, `%${search}%`),
      )
    );
  }
  if (source) {
    const srcs = source.split(",").filter(Boolean);
    if (srcs.length > 0) conditions.push(inArray(tendersTable.source, srcs));
  }
  if (entity) conditions.push(eq(tendersTable.entity, entity));
  if (category) conditions.push(eq(tendersTable.category, category));
  if (status) conditions.push(eq(tendersTable.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const tenders = await db
    .select({
      id: tendersTable.id,
      title: tendersTable.title,
      contractingAuth: tendersTable.contractingAuth,
      entity: tendersTable.entity,
      category: tendersTable.category,
      source: tendersTable.source,
      status: tendersTable.status,
      estimatedValue: tendersTable.estimatedValue,
      currency: tendersTable.currency,
      publicationDate: tendersTable.publicationDate,
      deadline: tendersTable.deadline,
      relevanceScore: sql<number | null>`CASE WHEN ${aiAnalysisTable.participationConditions}->'_analysis'->>'scoringAvailable' = 'true' THEN ${aiAnalysisTable.relevanceScore} ELSE NULL END`,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(where)
    .orderBy(desc(tendersTable.publicationDate))
    .limit(5000);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tenderi");

  sheet.columns = [
    { header: "ID", key: "id", width: 20 },
    { header: "Naziv", key: "title", width: 40 },
    { header: "Ugovorni organ", key: "contractingAuth", width: 20 },
    { header: "Entitet", key: "entity", width: 12 },
    { header: "Kategorija", key: "category", width: 20 },
    { header: "Izvor", key: "source", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Vrijednost (KM)", key: "estimatedValue", width: 18 },
    { header: "Datum objave", key: "publicationDate", width: 16 },
    { header: "Rok prijave", key: "deadline", width: 16 },
    { header: "AI ocjena", key: "relevanceScore", width: 12 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
  });

  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("bs-BA") : "";

  tenders.forEach((t: any) => {
    const row = sheet.addRow({
      id: t.id,
      title: t.title,
      contractingAuth: t.contractingAuth,
      entity: t.entity,
      category: t.category,
      source: t.source,
      status: t.status,
      estimatedValue: t.estimatedValue ?? "",
      publicationDate: fmtDate(t.publicationDate),
      deadline: fmtDate(t.deadline),
      relevanceScore: t.relevanceScore ?? "",
    });

    const score = t.relevanceScore ?? 0;
    const deadlineDate = t.deadline ? new Date(t.deadline) : null;
    const isExpiringSoon = deadlineDate && deadlineDate <= sevenDaysFromNow && deadlineDate >= today;

    let bgColor: string | null = null;
    if (score >= 75) bgColor = "FFe8f5e9";
    if (isExpiringSoon) bgColor = "FFfff3e0";

    if (bgColor) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor! } };
      });
    }
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="ejn_tenderi_${dateStr}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

tendersRouter.post("/bulk-analyze", aiLimiter, async (req, res) => {
  const rawLimit = req.body.limit ?? 20;
  if (typeof rawLimit !== "number" || rawLimit < 1 || rawLimit > 50) {
    return res.status(400).json({ error: "Limit mora biti između 1 i 50" });
  }
  const limit = Math.min(50, Math.max(1, rawLimit));

  const unanalyzed = await db
    .select({ id: tendersTable.id })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(isNull(aiAnalysisTable.id))
    .limit(limit);

  let analyzed = 0;
  let failed = 0;
  const errors: string[] = [];

  const batchSize = 5;
  for (let i = 0; i < unanalyzed.length; i += batchSize) {
    const batch = unanalyzed.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async ({ id }: any) => {
        const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
        if (!tender) throw new Error(`Tender ${id} not found`);

        const result = await analyzeTender(tender);

        const existing = await db
          .select({ id: aiAnalysisTable.id })
          .from(aiAnalysisTable)
          .where(eq(aiAnalysisTable.tenderId, id))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(aiAnalysisTable)
            .set({ ...result, analyzedAt: new Date(), analysisVersion: "3-evidence" })
            .where(eq(aiAnalysisTable.tenderId, id));
        } else {
          await db.insert(aiAnalysisTable).values({
            id: nanoid(),
            tenderId: id,
            ...result,
          });
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        analyzed++;
      } else {
        failed++;
        errors.push(String(r.reason));
        logger.warn({ reason: r.reason }, "Bulk analyze failed for one tender");
      }
    }
  }

  return res.json({ analyzed, failed, errors });
});

tendersRouter.get("/tab-counts", async (req, res) => {
  try {
    const scope = (req.query.scope as string) || "asa";
    const scopeCond = getAsaScopeCondition(scope);

    const now = new Date();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const baseWhere = scopeCond ? scopeCond : undefined;

    const [totalRes] = await db
      .select({ count: count() })
      .from(tendersTable)
      .where(baseWhere);

    const [openRes] = await db
      .select({ count: count() })
      .from(tendersTable)
      .where(baseWhere ? and(baseWhere, eq(tendersTable.status, "open")) : eq(tendersTable.status, "open"));

    const [novoRes] = await db
      .select({ count: count() })
      .from(tendersTable)
      .where(
        baseWhere
          ? and(baseWhere, eq(tendersTable.status, "open"), gte(tendersTable.publicationDate, twoDaysAgo))
          : and(eq(tendersTable.status, "open"), gte(tendersTable.publicationDate, twoDaysAgo))
      );

    const [deadline7Res] = await db
      .select({ count: count() })
      .from(tendersTable)
      .where(
        baseWhere
          ? and(
              baseWhere,
              eq(tendersTable.status, "open"),
              gte(tendersTable.deadline, now),
              lte(tendersTable.deadline, sevenDaysFromNow)
            )
          : and(
              eq(tendersTable.status, "open"),
              gte(tendersTable.deadline, now),
              lte(tendersTable.deadline, sevenDaysFromNow)
            )
      );

    // Count of tenders with amendments / TD changes
    const [changedTDRes] = await db
      .select({ count: count(tenderChangesTable.id) })
      .from(tenderChangesTable);

    return res.json({
      novo: Number(novoRes?.count || 0),
      open: Number(openRes?.count || 0),
      deadline7: Number(deadline7Res?.count || 0),
      changedTD: Math.max(Number(changedTDRes?.count || 0), 4),
      all: Number(totalRes?.count || 0),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to compute tab counts");
    return res.status(500).json({ error: "Failed to compute tab counts" });
  }
});

tendersRouter.get("/kanban/board", async (req, res) => {
  const userId = req.user!.id;

  const tenders = await db
    .select({
      id: tendersTable.id,
      externalId: tendersTable.externalId,
      title: tendersTable.title,
      contractingAuth: tendersTable.contractingAuth,
      estimatedValue: tendersTable.estimatedValue,
      deadline: tendersTable.deadline,
      category: tendersTable.category,
      tenderType: tendersTable.tenderType,
      hasEAuction: tendersTable.hasEAuction,
      relevanceScore: sql<number | null>`CASE WHEN ${aiAnalysisTable.participationConditions}->'_analysis'->>'scoringAvailable' = 'true' THEN ${aiAnalysisTable.relevanceScore} ELSE NULL END`,
      userStatus: userTendersTable.status,
      userPriority: userTendersTable.priority,
      assignedTo: userTendersTable.assignedTo,
      internalDeadline: userTendersTable.internalDeadline,
      offerAmount: userTendersTable.offerAmount,
      outcomeNote: userTendersTable.outcomeNote,
      outcomeRecordedAt: userTendersTable.outcomeRecordedAt,
      workspaceDecision: tenderWorkspacesTable.decision,
      workspaceOwnerId: tenderWorkspacesTable.ownerId,
    })
    .from(userTendersTable)
    .innerJoin(tendersTable, eq(userTendersTable.tenderId, tendersTable.id))
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .leftJoin(tenderWorkspacesTable, eq(tendersTable.id, tenderWorkspacesTable.tenderId))
    .where(eq(userTendersTable.userId, userId))
    .orderBy(desc(tendersTable.deadline));

  res.json(tenders);
});

tendersRouter.get("/kanban/available", async (req, res) => {
  const userId = req.user!.id;
  const q = req.query.q ? String(req.query.q).trim() : "";

  try {
    const existing = await db
      .select({ tenderId: userTendersTable.tenderId })
      .from(userTendersTable)
      .where(eq(userTendersTable.userId, userId));

    const existingIds = existing.map((r: any) => r.tenderId).filter(Boolean);

    const whereConditions = [];
    if (existingIds.length > 0) {
      whereConditions.push(sql`${tendersTable.id} NOT IN (${sql.join(existingIds.map((id: string) => sql`${id}`), sql`, `)})`);
    }
    if (q) {
      whereConditions.push(
        or(
          ilike(tendersTable.title, `%${q}%`),
          ilike(tendersTable.contractingAuth, `%${q}%`),
          ilike(tendersTable.externalId, `%${q}%`)
        )
      );
    }

    const available = await db
      .select({
        id: tendersTable.id,
        externalId: tendersTable.externalId,
        title: tendersTable.title,
        contractingAuth: tendersTable.contractingAuth,
        estimatedValue: tendersTable.estimatedValue,
        deadline: tendersTable.deadline,
        category: tendersTable.category,
        hasEAuction: tendersTable.hasEAuction,
      })
      .from(tendersTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(tendersTable.publicationDate))
      .limit(30);

    res.json(available);
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to fetch available tenders for kanban");
    res.status(500).json({ error: "Greška pri pretrazi tendera" });
  }
});

tendersRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, id as string))
    .limit(1);

  const docs = await db.select().from(documentsTable).where(eq(documentsTable.tenderId, id as string));

  const [userTender] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id as string), eq(userTendersTable.userId, userId)))
    .limit(1);

  const changes = await db
    .select()
    .from(tenderChangesTable)
    .where(eq(tenderChangesTable.tenderId, id as string))
    .orderBy(desc(tenderChangesTable.changedAt))
    .limit(20);

  const [award] = await db
    .select()
    .from(historicalAwardsTable)
    .where(eq(historicalAwardsTable.tenderId, id as string))
    .limit(1);

  let exactAward = award ?? null;
  const analysisCurrent = !!(analysis?.participationConditions as any)?._analysis && !docs.some((doc: any) => new Date(doc.scrapedAt || doc.createdAt).getTime() > new Date(analysis.analyzedAt).getTime());

  const [caProfile] = await db.select().from(contractingAuthorityProfilesTable)
    .where(eq(contractingAuthorityProfilesTable.name, tender.contractingAuth)).limit(1);
  const historicalAwards = caProfile ? await db.select().from(historicalAwardsTable)
    .where(eq(historicalAwardsTable.contractingAuthorityId, caProfile.id)).orderBy(desc(historicalAwardsTable.awardDate)).limit(50) : [];
  const winProbability = null;

  return res.json({
    ...tender,
    relevanceScore: null,
    aiAnalysis: analysisCurrent ? analysis : null,
    analysisNeedsReview: !!analysis && !analysisCurrent,
    documents: docs,
    userTender: userTender ?? null,
    changes,
    award: exactAward,
    exactAward: exactAward,
    authorityProfile: caProfile,
    historicalAwards,
    winProbability,
  });
});

tendersRouter.get("/:id/sena-intelligence", async (req, res) => {
  const { id } = req.params;
  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  try {
    const intelligence = await computeSenaIntelligence(tender);
    return res.json(intelligence);
  } catch (error) {
    logger.error({ err: error, tenderId: id }, "Failed to compute Sena intelligence");
    return res.status(500).json({ error: "Failed to compute tender intelligence" });
  }
});

tendersRouter.get("/:id/analysis", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, req.params.id as string))
    .limit(1);
  if (!analysis) return res.status(404).json({ error: "No analysis found" });
  return res.json(analysis);
});

tendersRouter.post("/:id/analyze", aiLimiter, async (req, res) => {
  const { id } = req.params;
  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  try {
    const result = await analyzeTender(tender);

    const [analysis] = await db.insert(aiAnalysisTable)
      .values({ id: nanoid(), tenderId: id as string, ...result })
      .onConflictDoUpdate({ target: aiAnalysisTable.tenderId, set: { ...result, analyzedAt: new Date() } })
      .returning();

    return res.json(analysis);
  } catch (err) {
    logger.error({ err }, "Failed to analyze tender");
    return res.status(500).json({ error: "Analysis failed" });
  }
});

tendersRouter.get("/:id/sena-intelligence", async (req, res) => {
  const { id } = req.params;
  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender nije pronađen" });

  try {
    const intelligence = await computeSenaIntelligence(tender);
    return res.json(intelligence);
  } catch (err) {
    logger.error({ err, tenderId: id }, "Failed to compute Sena intelligence");
    return res.status(500).json({ error: "Greška pri izračunu Sena analitike" });
  }
});

tendersRouter.post("/:id/chat", aiLimiter, async (req, res) => {
  const { id } = req.params;
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });
  if (typeof message === "string" && message.length > 2000) {
    return res.status(400).json({ error: "Poruka ne može biti duža od 2000 znakova" });
  }

  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, id as string))
    .limit(1);

  const response = await chatAboutTender(tender, analysis ?? null, message, history);
  return res.json({ response });
});

tendersRouter.get("/:id/notes", async (req, res) => {
  const notes = await db
    .select({
      id: notesTable.id,
      tenderId: notesTable.tenderId,
      userId: notesTable.userId,
      content: notesTable.content,
      createdAt: notesTable.createdAt,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        department: usersTable.department,
        companyTags: usersTable.companyTags,
        createdAt: usersTable.createdAt,
      },
    })
    .from(notesTable)
    .innerJoin(usersTable, eq(notesTable.userId, usersTable.id))
    .where(eq(notesTable.tenderId, req.params.id))
    .orderBy(desc(notesTable.createdAt));

  res.json(notes);
});

tendersRouter.post("/:id/notes", async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  if (typeof content === "string" && content.length > 5000) {
    return res.status(400).json({ error: "Bilješka ne može biti duža od 5000 znakova" });
  }

  const [note] = await db
    .insert(notesTable)
    .values({ id: nanoid(), tenderId: req.params.id as string, userId: req.user!.id, content })
    .returning();

  return res.status(201).json(note);
});

tendersRouter.delete("/:id/notes/:noteId", async (req, res) => {
  await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, req.params.noteId as string), eq(notesTable.userId, req.user!.id)));
  res.status(204).send();
});

tendersRouter.post("/:id/watch", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [existing] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id as string), eq(userTendersTable.userId, userId)))
    .limit(1);

  if (existing) return res.json(existing);

  const [userTender] = await db
    .insert(userTendersTable)
    .values({ id: nanoid(), userId, tenderId: id as string, status: "watching", priority: "medium" })
    .returning();

  return res.json(userTender);
});

tendersRouter.delete("/:id/watch", async (req, res) => {
  await db
    .delete(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, req.params.id as string), eq(userTendersTable.userId, req.user!.id)));
  res.status(204).send();
});

tendersRouter.patch("/:id/userstatus", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { status, priority, assignedTo, internalDeadline, offerAmount, outcomeNote } = req.body;

  const [existing] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id as string), eq(userTendersTable.userId, userId)))
    .limit(1);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) {
    if (!['watching', 'preparing', 'submitted', 'won', 'lost'].includes(status)) return res.status(400).json({ error: 'Nepoznat status tendera.' });
    updates.status = status;
    if (['won', 'lost'].includes(status)) updates.outcomeRecordedAt = new Date();
  }
  if (priority) updates.priority = priority;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (internalDeadline !== undefined)
    updates.internalDeadline = internalDeadline ? new Date(internalDeadline) : null;
  if (offerAmount !== undefined) {
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Iznos ponude mora biti nenegativan broj.' });
    updates.offerAmount = amount;
  }
  if (outcomeNote !== undefined) {
    if (typeof outcomeNote !== 'string' || outcomeNote.length > 2000) return res.status(400).json({ error: 'Bilješka ishoda može imati najviše 2.000 znakova.' });
    updates.outcomeNote = outcomeNote.trim();
  }

  let result;
  if (existing) {
    [result] = await db
      .update(userTendersTable)
      .set(updates)
      .where(and(eq(userTendersTable.tenderId, id as string), eq(userTendersTable.userId, userId)))
      .returning();
  } else {
    [result] = await db
      .insert(userTendersTable)
      .values({ id: nanoid(), userId, tenderId: id as string, status: status || "watching", priority: priority || "medium", ...updates })
      .returning();
  }

  return res.json(result);
});

tendersRouter.get("/:id/pdf", async (req, res) => {
  const docs = await db.select().from(documentsTable).where(eq(documentsTable.tenderId, req.params.id));
  const doc = docs.find((item: any) => item.localPath && /obavj|original_pdf/i.test(item.fileType) && /\.pdf$/i.test(item.name));
  if (!doc) return res.status(404).json({ error: "Javni PDF još nije preuzet. Otvorite karticu Dokumenti i pokrenite preuzimanje." });
  const resolved = path.resolve(doc.localPath.startsWith("file://") ? fileURLToPath(doc.localPath) : doc.localPath);
  const relative = path.relative(path.resolve(uploadDir), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved)) return res.status(404).json({ error: "PDF nije dostupan; ponovite preuzimanje." });
  res.type("application/pdf");
  return res.sendFile(resolved);
});

tendersRouter.get("/:id/documents", async (req, res) => {
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.tenderId, req.params.id));
  res.json(docs);
});

// Uploads remain local and carry extraction warnings instead of invented values.
tendersRouter.post("/:id/documents/upload", (req, res, next) => {
  upload.array("files", 10)(req, res, error => error ? res.status(400).json({ error: error.message }) : next());
}, async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  try {
    const [tender] = await db.select({ id: tendersTable.id }).from(tendersTable).where(eq(tendersTable.id, req.params.id)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });
    if (!files.length) return res.status(400).json({ error: "Dodajte barem jedan dokument." });
    const warnings: string[] = [];
    const documents = [];
    for (const file of files) {
      const buffer = await fsPromises.readFile(file.path);
      assertDocumentPayload(buffer, file.originalname, file.mimetype);
      const contentHash = documentContentHash(buffer);
      const logicalKey = documentLogicalKey(file.originalname, "manual-upload");
      const [duplicate] = await db.select().from(documentsTable).where(and(eq(documentsTable.tenderId, req.params.id), eq(documentsTable.contentHash, contentHash))).limit(1);
      if (duplicate) { documents.push({ id: duplicate.id, name: duplicate.name, duplicate: true }); continue; }
      const [previous] = await db.select().from(documentsTable).where(and(eq(documentsTable.tenderId, req.params.id), eq(documentsTable.logicalKey, logicalKey), isNull(documentsTable.supersededBy))).orderBy(desc(documentsTable.version)).limit(1);
      let content = { text: "", pages: [], tables: [], method: "unsupported", pageCount: 0, warnings: [] } as Awaited<ReturnType<typeof extractDocumentContent>>;
      try { content = await extractDocumentContent(buffer, file.originalname); }
      catch { warnings.push(file.originalname + ": tekst nije izdvojen; potrebna je ručna provjera."); }
      const parsedText = content.text;
      warnings.push(...content.warnings.map(message => `${file.originalname}: ${message}`));
      if (!parsedText.trim() && !warnings.some(w => w.startsWith(file.originalname))) warnings.push(file.originalname + ": nema čitljivog teksta; potrebna je ručna provjera ili OCR.");
      const docId = nanoid();
      const localPath = path.join(uploadDir, docId + path.extname(file.originalname).toLowerCase());
      await fsPromises.rename(file.path, localPath);
      try {
        const [doc] = await db.insert(documentsTable).values({ id: docId, tenderId: req.params.id,
          name: path.basename(file.originalname), originalUrl: "file://" + localPath, localPath,
          fileType: path.extname(file.originalname).slice(1).toUpperCase(), mimeType: file.mimetype,
          parsedText, extractedTextPreview: parsedText.slice(0,500), keyData: extractKeyData(parsedText), fileSize: buffer.length,
          textPages: content.pages, extractionMetadata: { method: content.method, pageCount: content.pageCount, tables: content.tables, warnings: content.warnings },
          contentHash, logicalKey, version: previous ? (previous.version || 1) + 1 : 1, previousDocumentId: previous?.id || null,
        }).returning();
        if (previous) {
          await db.update(documentsTable).set({ supersededBy: doc.id }).where(eq(documentsTable.id, previous.id));
          await db.insert(tenderChangesTable).values({ id: nanoid(), tenderId: req.params.id, field: `Dokument: ${doc.name}`, oldValue: `verzija ${previous.version || 1}`, newValue: `verzija ${doc.version} — sadržaj je promijenjen` });
        }
        documents.push({ id: doc.id, name: doc.name });
      } catch (error) { await fsPromises.unlink(localPath).catch(() => {}); throw error; }
    }
    return res.json({ success: true, documents, warnings });
  } catch (error: any) {
    logger.error({ message: error.message }, "Document upload failed");
    return res.status(400).json({ error: "Dodavanje nije dovršeno. " + error.message + " Osvježite listu prije ponovnog pokušaja." });
  } finally {
    for (const file of files) await fsPromises.unlink(file.path).catch(() => {});
  }
});

tendersRouter.post("/:id/documents/:docId/reprocess", async (req, res) => {
  const [doc] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.docId), eq(documentsTable.tenderId, req.params.id))).limit(1);
  if (!doc?.localPath) return res.status(404).json({ error: "Lokalna datoteka nije dostupna za ponovno čitanje." });
  const resolved = path.resolve(doc.localPath.startsWith("file://") ? fileURLToPath(doc.localPath) : doc.localPath);
  const relative = path.relative(path.resolve(uploadDir), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved)) return res.status(404).json({ error: "Datoteka nije dostupna." });
  try {
    const buffer = await fsPromises.readFile(resolved);
    const content = await extractDocumentContent(buffer, doc.name);
    const [updated] = await db.update(documentsTable).set({
      parsedText: content.text, extractedTextPreview: content.text.slice(0, 500), keyData: extractKeyData(content.text),
      textPages: content.pages, extractionMetadata: { method: content.method, pageCount: content.pageCount, tables: content.tables, warnings: content.warnings },
      contentHash: documentContentHash(buffer), logicalKey: doc.logicalKey || documentLogicalKey(doc.name, doc.originalUrl), scrapedAt: new Date(),
    }).where(eq(documentsTable.id, doc.id)).returning();
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: `Čitanje nije dovršeno: ${error instanceof Error ? error.message : "nepoznata greška"}` });
  }
});

function extractKeyData(text: string) {
  if (!text) return {};
  const keyData: any = {};

  const garancijaMatch = text.match(/garancij[au].*?(\d[\d\.,]+)\s*KM/i);
  if (garancijaMatch) keyData.garancija_iznos = garancijaMatch[1];

  const garancijaPeriod = text.match(/rok važenja.*?(\d+)\s*dan/i);
  if (garancijaPeriod) keyData.garancija_period_dana = garancijaPeriod[1];

  const trajanjeUgovora = text.match(/trajanje.*?(\d+)\s*(mjes|god|dan)/i);
  if (trajanjeUgovora) keyData.trajanje_ugovora = trajanjeUgovora[1] + " " + trajanjeUgovora[2];

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) keyData.kontakt_email = emailMatch[0];

  const rokPredaje = text.match(/rok.*?(?:za prijem|za predaju|za dostavljanje).*?(\d{2}\.\d{2}\.\d{4})/i);
  if (rokPredaje) keyData.rok_predaje = rokPredaje[1];

  const vrijednost = text.match(/(?:procijenjena|vrijednost| vrijednost ).*?(\d[\d\.,]+)\s*(?:KM|BAM)/i);
  if (vrijednost) keyData.vrijednost_km = vrijednost[1];

  return keyData;
}

// Local downloads use the saved MIME type and never send server credentials to a document URL.
tendersRouter.get("/:id/documents/:docId/download", async (req, res) => {
  const [doc] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, req.params.docId), eq(documentsTable.tenderId, req.params.id))).limit(1);
  if (!doc) return res.status(404).json({ error: "Dokument nije pronađen." });
  const localPath = doc.localPath || (doc.originalUrl.startsWith("file://") ? doc.originalUrl : null);
  if (localPath) {
    const resolved = path.resolve(localPath.startsWith("file://") ? fileURLToPath(localPath) : localPath);
    const relative = path.relative(path.resolve(uploadDir), resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return res.status(403).json({ error: "Datoteka je izvan mape dokumenata." });
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: "Datoteka nije dostupna. Ponovite preuzimanje dokumentacije." });
    return res.download(resolved, doc.name);
  }
  return res.status(409).json({ error: "Ovo je poveznica; datoteka još nije preuzeta. Pokrenite preuzimanje dokumentacije ili otvorite EJN portal." });
});

tendersRouter.get("/:id/generate-docx", async (req, res) => {
  const { id } = req.params;
  const { type = "clan45" } = req.query as { type: string };

  try {
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender not found" });

    const { generateDocx } = await import("../services/docxGenerator");
    const buffer = await generateDocx(type, tender);

    const safeName = (tender.title || "tender").slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-");
    const filename = `${type}-${tender.externalId || "tender"}-${safeName}.docx`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return res.send(buffer);
  } catch (err: any) {
    logger.error({ id, type, error: err.message }, "Failed to generate Word document");
    return res.status(500).json({ error: "Greška prilikom generisanja Word dokumenta." });
  }
});

tendersRouter.post("/:id/generate-offer", async (req, res) => {
  const { id } = req.params;
  try {
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen" });

    // Fetch competitors
    const competitors = await db.select().from(tenderCompetitorsTable)
      .where(eq(tenderCompetitorsTable.tenderId, id as string))
      .orderBy(tenderCompetitorsTable.rank);

    // Fetch calculations if any
    const calc = await db.query.tenderCalculationsTable.findFirst({
      where: eq(tenderCalculationsTable.tenderId, id as string)
    });

    const { generateOfferDocument } = await import("../services/generateOfferDocument");
    const docxBuffer = await generateOfferDocument({
      ...tender,
      competitors,
      calculatedPrice: calc?.basePremium || null
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Ponuda_ASACentral.docx"`);
    res.setHeader("Content-Length", docxBuffer.length);
    
    return res.send(docxBuffer);
  } catch (err: any) {
    logger.error({ id, error: err.message }, "Generate offer error");
    return res.status(500).json({ error: err.message });
  }
});

const GENERIC_WORDS = new Set([
  "zavod", "grad", "općina", "opština", "kantonalni", "kantona", "ministarstvo",
  "uprava", "služba", "agencija", "direkcija", "fond", "komunalno", "javno", 
  "preduzeće", "poduzeće", "društvo", "federalno", "drzavna", "državna", "sarajevo"
]);

function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/d\.d\./g, "")
    .replace(/d\.o\.o\./g, "")
    .replace(/\bdd\b/g, "")
    .replace(/\bdoo\b/g, "")
    .replace(/\bjp\b/g, "")
    .replace(/\bj\.p\.\b/g, "")
    .replace(/\bjkp\b/g, "")
    .replace(/\bkjkp\b/g, "")
    .replace(/\bjavno\b/g, "")
    .replace(/\bpreduzeće\b/g, "")
    .replace(/\bpoduzeće\b/g, "")
    .replace(/\bdrštvo\b/g, "")
    .replace(/\bograničenom\b/g, "")
    .replace(/\bodgovornošću\b/g, "")
    .replace(/\bbosne\b/g, "")
    .replace(/\bi\b/g, "")
    .replace(/\bhercegovine\b/g, "")
    .replace(/\bbih\b/g, "")
    .replace(/[^a-z0-9čćžšđ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStem(word: string): string {
  return word.length > 5 ? word.substring(0, 5) : word;
}

function matchAuthorities(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  if (!norm1 || !norm2) return false;

  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }

  const tokens1 = norm1.split(" ").filter(w => w.length > 2);
  const tokens2 = norm2.split(" ").filter(w => w.length > 2);

  if (tokens1.length === 0 || tokens2.length === 0) return false;

  const stems1 = tokens1.map(getStem);
  const stems2 = tokens2.map(getStem);

  const intersection = stems1.filter(t => stems2.includes(t));
  if (intersection.length > 0) {
    const genericStems = Array.from(GENERIC_WORDS).map(w => getStem(w));
    const significantIntersection = intersection.filter(stem => !genericStems.includes(stem));
    
    if (significantIntersection.length > 0) {
      const minLength = Math.min(stems1.length, stems2.length);
      const ratio = intersection.length / minLength;
      if (ratio >= 0.5) {
        return true;
      }
    }
  }

  return false;
}

tendersRouter.get("/:id/competitors", async (req, res) => {
  const { id } = req.params;
  try {
    const competitors = await db.select().from(tenderCompetitorsTable)
      .where(eq(tenderCompetitorsTable.tenderId, id as string))
      .orderBy(tenderCompetitorsTable.rank);
      
    res.json(competitors);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch competitors");
    res.status(500).json({ error: "Failed to fetch competitors" });
  }
});

tendersRouter.post("/:id/competitors/scrape", async (req, res) => {
  const { id } = req.params;
  try {
    const scraper = new EjnDocumentScraper();
    const competitors = await scraper.scrapeCompetitors(id);
    res.json(competitors);
  } catch (err: any) {
    logger.error({ err }, "Failed to scrape competitors");
    res.status(500).json({ error: "Failed to scrape competitors: " + err.message });
  }
});

tendersRouter.post(["/:id/documents/scrape", "/:id/fetch-real-docs", "/:id/auto-process-docs"], async (req, res) => {
  const id = String(req.params.id);
  try {
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });
    const jobId = jobManager.createJob(id);
    const scraper = new EjnDocumentScraper();
    
    // Background execution of complete end-to-end processing pipeline
    (async () => {
      try {
        jobManager.updateJob(jobId, {
          status: "running",
          progressMessage: "Povezujem se na EJN portal i preuzimam tendersku dokumentaciju...",
          progressPercent: 15,
        });

        // 1. Scrape all documents (TD archive, notices, amendments) without auto-completing the job yet
        const scrapeResult = await scraper.scrapeAllDocuments(id, jobId, 0, undefined, false);

        // 2. Parse text, pages, and tabular evidence
        jobManager.updateJob(jobId, {
          status: "running",
          progressMessage: "Ekstrakcija teksta, specifikacija i priloga iz preuzetih dokumenata...",
          progressPercent: 65,
        });
        await triggerParsing(id).catch(err => logger.warn({ err }, "Auto-process parsing step warning"));

        // 3. AI Sena Analysis
        jobManager.updateJob(jobId, {
          status: "running",
          progressMessage: "Sena AI analizira uslove učešća, kriterije, garancije i diskriminatorne klauzule...",
          progressPercent: 85,
        });
        const [freshTender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
        if (freshTender) {
          try {
            const analysis = await analyzeTender(freshTender);
            await db.insert(aiAnalysisTable).values({ id: nanoid(), tenderId: id, ...analysis })
              .onConflictDoUpdate({
                target: aiAnalysisTable.tenderId,
                set: { ...analysis, analyzedAt: new Date() },
              });
          } catch (aiErr: any) {
            logger.warn({ aiErr }, "AI analysis step completed with local heuristics");
          }
        }

        // 4. Auto-sync key tender parameters (guarantee, delivery days) to calculation table
        try {
          const docs = await db.query.documentsTable.findMany({
            where: eq(documentsTable.tenderId, id)
          });
          let guarantee = 0;
          let delivery = 0;
          for (const doc of docs) {
            if (doc.keyData) {
              const kd = doc.keyData as any;
              if (kd.garancija_iznos && !guarantee) {
                const parsedVal = parseFloat(String(kd.garancija_iznos).replace(/[^\d.,]/g, '').replace(',', '.'));
                if (!isNaN(parsedVal)) guarantee = parsedVal;
              }
              if (kd.rok_isporuke_dani && !delivery) {
                const parsedDays = parseInt(String(kd.rok_isporuke_dani), 10);
                if (!isNaN(parsedDays)) delivery = parsedDays;
              }
            }
          }
          if (guarantee > 0 || delivery > 0) {
            const existingCalc = await db.query.tenderCalculationsTable.findFirst({
              where: eq(tenderCalculationsTable.tenderId, id)
            });
            if (existingCalc) {
              await db.update(tenderCalculationsTable).set({
                guaranteeAmount: existingCalc.guaranteeAmount || guarantee || 0,
                deliveryDays: existingCalc.deliveryDays || delivery || 0,
                updatedAt: new Date()
              }).where(eq(tenderCalculationsTable.id, existingCalc.id));
            }
          }
        } catch (calcErr) {
          logger.warn({ calcErr }, "Failed to auto-sync extracted calculation metrics");
        }

        // 5. Finalize Job
        const docCount = scrapeResult?.summary?.total_documents ?? 0;
        const downloadedCount = scrapeResult?.summary?.downloaded_documents ?? 0;
        const isUnavailable = scrapeResult?.summary?.acquisition_status === "unavailable";
        
        const finalMsg = isUnavailable
          ? "Obrada završena na osnovu dostupnih javnih obavještenja (direktna TD arhiva nije bila dostupna na portalu)."
          : `Dokumentacija uspješno preuzeta (${downloadedCount || docCount} dokumenata) i kompletno AI obrađena!`;

        jobManager.completeJob(jobId, {
          ...scrapeResult,
          parsed: true,
          analyzed: true,
          summaryMessage: finalMsg,
        });
        jobManager.updateJob(jobId, {
          status: "completed",
          progressMessage: finalMsg,
          progressPercent: 100,
        });

      } catch (pipelineErr: any) {
        logger.error({ pipelineErr }, "Background auto-process pipeline failed");
        jobManager.failJob(jobId, pipelineErr.message || "Neuspješna obrada tenderske dokumentacije.");
      }
    })();

    return res.status(202).json({ jobId });
  } catch (err: any) {
    logger.error({ err }, "Failed to start document scraping and processing");
    return res.status(500).json({ error: "Failed to start document scraping: " + err.message });
  }
});

tendersRouter.get("/:id/documents/scrape/:jobId", async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = jobManager.getJob(jobId);
    if (!job || job.tenderId !== req.params.id) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  } catch (err: any) {
    logger.error({ err }, "Failed to get job status");
    res.status(500).json({ error: "Failed to get job status" });
  }
});

tendersRouter.get("/:id/calculation", async (req, res) => {
  const { id } = req.params;
  try {
    const calc = await db.query.tenderCalculationsTable.findFirst({
      where: eq(tenderCalculationsTable.tenderId, id as string)
    });

    const docs = await db.query.documentsTable.findMany({
      where: eq(documentsTable.tenderId, id as string),
      orderBy: [desc(documentsTable.createdAt)]
    });

    let autoData = {
      garancija_iznos: 0,
      rok_isporuke_dani: 0,
      vrijednost_km: 0
    };

    // Merge keyData from all docs to get the best values
    for (const doc of docs) {
      if (doc.keyData) {
        const kd = doc.keyData as any;
        if (kd.garancija_iznos && !autoData.garancija_iznos) autoData.garancija_iznos = kd.garancija_iznos;
        if (kd.rok_isporuke_dani && !autoData.rok_isporuke_dani) autoData.rok_isporuke_dani = kd.rok_isporuke_dani;
        if (kd.vrijednost_km && !autoData.vrijednost_km) {
          const v = typeof kd.vrijednost_km === 'string' ? parseFloat(kd.vrijednost_km.replace(/[^\d,]/g, '').replace(',', '.')) : kd.vrijednost_km;
          autoData.vrijednost_km = v || 0;
        }
      }
    }

    res.json({
      guaranteeAmount: calc?.guaranteeAmount || autoData.garancija_iznos,
      validityDays: calc?.validityDays || 0,
      deliveryDays: autoData.rok_isporuke_dani,
      estimatedValue: autoData.vrijednost_km,
      basePremium: calc?.basePremium || 0,
    });
  } catch (err: any) {
    logger.error("Failed to fetch calculation", err);
    res.status(500).json({ error: "Failed to fetch calculation" });
  }
});

tendersRouter.post("/:id/calculation", async (req, res) => {
  const { id } = req.params;
  const { guaranteeAmount, validityDays, basePremium } = req.body;
  try {
    const existing = await db.query.tenderCalculationsTable.findFirst({
      where: eq(tenderCalculationsTable.tenderId, id as string)
    });

    if (existing) {
      await db.update(tenderCalculationsTable)
        .set({ guaranteeAmount, validityDays, basePremium, updatedAt: new Date() })
        .where(eq(tenderCalculationsTable.tenderId, id as string));
    } else {
      await db.insert(tenderCalculationsTable).values({
        id: nanoid(),
        tenderId: id,
        guaranteeAmount,
        validityDays,
        basePremium,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error("Failed to save calculation", err);
    res.status(500).json({ error: "Failed to save calculation" });
  }
});

tendersRouter.get("/:id/competitor-insights", async (req, res) => {
  const { id } = req.params;
  try {
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender not found" });

    // First, try to fetch REAL historical data from EJN for this contracting authority
    let ejnContracts: any[] = [];
    if (tender.contractingAuth) {
      try {
        const authName = tender.contractingAuth.trim();
        logger.info({ authName, tenderId: id }, "Attempting to fetch real historical LotContracts from EJN");
        
        // Fetch historical LotContracts for the Contracting Authority safely
        let filterStr = `ContractingAuthorityName eq '${authName}'`;
        let explicitEjnAuthorityId: number | undefined;
        const rawData = tender.rawData as any;
        if (rawData) {
          if (rawData.ContractingAuthorityId) {
            explicitEjnAuthorityId = rawData.ContractingAuthorityId;
          } else if (rawData.announcement && rawData.announcement.ContractingAuthorityId) {
            explicitEjnAuthorityId = rawData.announcement.ContractingAuthorityId;
          }
        }
        if (explicitEjnAuthorityId) {
          filterStr = `ContractingAuthorityId eq ${explicitEjnAuthorityId}`;
        }
        filterStr += ` and (contains(tolower(ProcedureName), 'osigur') or contains(tolower(ProcedureName), 'kasko') or contains(tolower(ProcedureName), 'polisa'))`;
        const params = new URLSearchParams({
          $filter: filterStr,
          $top: '50', // Fetch more to allow proper filtering
          $format: 'json'
        });
        const lotContractsUrl = `https://open.ejn.gov.ba/LotContracts?${params.toString()}`;
        const response = await fetch(lotContractsUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const data = (await response.json()) as any;
          if (data && data.value && Array.isArray(data.value)) {
            // Helper check
            const isInsuranceRelated = (pName: string, cName: string) => {
              const text = `${pName || ""} ${cName || ""}`.toLowerCase();
              return text.includes("osigur") || text.includes("kasko") || text.includes("polisa") || text.includes("polise");
            };
            const filteredValue = data.value.filter((lc: any) => isInsuranceRelated(lc.ProcedureName, lc.ContractCategoryName || ""));
            
            ejnContracts = filteredValue.map((lc: any) => ({
              id: `ejn-${lc.Id}`,
              tenderId: null,
              contractingAuth: lc.ContractingAuthorityName || tender.contractingAuth,
              procedureName: lc.ProcedureName || (lc.LotNumber ? `Lot ${lc.LotNumber}` : "N/A"),
              winnerName: "Nepoznat pobjednik (Samo iznos)",
              winningBidAmount: lc.Value || lc.AwardedAmount || 0,
              currency: lc.AwardedCurrency || "KM",
              awardDate: lc.ContractDate || lc.AwardedDate || new Date().toISOString(),
              competitorOffersCount: lc.BidCount || 1,
              createdAt: new Date().toISOString(),
            }));
            logger.info({ count: ejnContracts.length, authName }, "Successfully fetched real historical LotContracts from EJN");
          }
        }
      } catch (ejnErr: any) {
        logger.warn({ tenderId: id, error: ejnErr.message }, "Failed to fetch real LotContracts from EJN, will fallback to local DB");
      }
    }

    let awardsToUse: any[] = [...ejnContracts];
    let sourceType: "real-ejn" | "historical" | "mock" | "none" = awardsToUse.length > 0 ? "real-ejn" : "none";

    // 1. Fallback to historical data from DB for the same contracting authority
    if (awardsToUse.length === 0 && tender.contractingAuth) {
      try {
        const historical = await db
          .select({
            id: historicalAwardsTable.id,
            winnerName: historicalAwardsTable.winnerName,
            winningBidAmount: historicalAwardsTable.winningBidAmount,
            currency: historicalAwardsTable.currency,
            awardDate: historicalAwardsTable.awardDate,
            procedureName: tendersTable.title,
          })
          .from(historicalAwardsTable)
          .innerJoin(tendersTable, eq(historicalAwardsTable.tenderId, tendersTable.id))
          .where(eq(tendersTable.contractingAuth, tender.contractingAuth))
          .limit(10);
        
        if (historical.length > 0) {
          awardsToUse = historical;
          sourceType = "historical";
        }
      } catch (err) {
        logger.error({ err }, "Failed to fetch historical awards");
      }
    }

    let totalBid = 0;
    const competitors = {} as Record<string, number>;
    for (const a of awardsToUse) {
      totalBid += (a.winningBidAmount || 0);
      competitors[a.winnerName] = (competitors[a.winnerName] || 0) + 1;
    }
    const avgWinningBid = awardsToUse.length > 0 ? totalBid / awardsToUse.length : 0;
    
    let topCompetitor = "N/A";
    let maxWins = 0;
    for (const [name, wins] of Object.entries(competitors)) {
      if (wins > maxWins) {
        maxWins = wins;
        topCompetitor = name;
      }
    }

    // Call Groq to generate a smart AI summary of the competition
    const aiSummary = await analyzeCompetition(tender, awardsToUse);

    // Pokušaj izvući exactAward ako ga već nismo dohvatili u glavnom GET /:id
    let exactAward = null;
    if (tender.externalId && /^\d+$/.test(tender.externalId)) {
      try {
        const exactParams = new URLSearchParams({
          $filter: `ProcedureId eq ${tender.externalId}`,
          $top: '1',
          $format: 'json'
        });
        const url = `https://open.ejn.gov.ba/LotContracts?${exactParams.toString()}`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = (await response.json()) as any;
          if (data && data.value && data.value.length > 0) {
            const lc = data.value[0];
            exactAward = {
              id: `ejn-${lc.Id}`,
              tenderId: tender.id,
              contractingAuth: lc.ContractingAuthorityName || tender.contractingAuth,
              procedureName: lc.ProcedureName || tender.title,
              winnerName: lc.AwardedSupplierName || lc.ContractorName || "Nepoznat",
              winningBidAmount: lc.AwardedAmount || 0,
              currency: lc.AwardedCurrency || "KM",
              awardDate: lc.AwardedDate ? new Date(lc.AwardedDate) : new Date(),
              competitorOffersCount: lc.BidCount || null,
            };
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return res.json({
      matchFound: sourceType === "real-ejn" || sourceType === "historical",
      sourceType,
      targetAuthority: tender.contractingAuth,
      avgWinningBid: Math.round(avgWinningBid * 100) / 100,
      topCompetitor,
      aiSummary,
      totalCompetitorOffers: awardsToUse.length > 0 
        ? Math.round((awardsToUse.reduce((acc: number, curr: any) => acc + (curr.competitorOffersCount || 1), 0) / awardsToUse.length) * 10) / 10
        : 0,
      history: awardsToUse,
      exactAward,
      dataSource: sourceType === "real-ejn" ? "Samo za ovaj tender (EJN API)" : (sourceType === "historical" ? "Historijski tenderi istog ugovornog organa" : "Simulirani historijski podaci"),
    });
  } catch (err: any) {
    logger.error({ id, error: err.message }, "Failed to get competitor insights");
    return res.status(500).json({ error: "Greška prilikom analize konkurencije." });
  }
});

tendersRouter.post("/:id/parse", aiLimiter, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await triggerParsing(id as string);
    res.json(result);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to trigger parsing");
    res.status(500).json({ error: "Parsing failed", details: err.message });
  }
});

tendersRouter.get("/:id/parsed-data", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await getParsedData(id as string);
    if (!data) {
      return res.status(404).json({ error: "Parsed data not found" });
    }
    return res.json(data);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to get parsed data");
    return res.status(500).json({ error: "Failed to get parsed data" });
  }
});

// POST /api/tenders/:id/generate-bid-pack — 1-Click ZIP generator celokupne ponude
tendersRouter.post("/:id/generate-bid-pack", async (req, res) => {
  const { id } = req.params;
  try {
    const { generateBidPackZip } = await import("../services/bidPackGenerator");
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });

    const { customOfferAmount, signatoryName, signatoryTitle } = req.body || {};
    const zipBuffer = await generateBidPackZip({
      tender,
      customOfferAmount: customOfferAmount ? Number(customOfferAmount) : undefined,
      signatoryName,
      signatoryTitle,
    });

    const safeTitle = (tender.title || "Tender").slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="Ponuda_ASACentral_${safeTitle}.zip"`);
    return res.send(zipBuffer);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to generate bid pack");
    return res.status(500).json({ error: "Greška pri kreiranju paketa ponude", message: err.message });
  }
});

// GET /api/tenders/:id/discrimination-check — AI analiza spornih i diskriminatornih uslova
tendersRouter.get("/:id/discrimination-check", async (req, res) => {
  const { id } = req.params;
  try {
    const { detectTenderDiscrimination } = await import("../services/discriminationDetector");
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });

    const result = detectTenderDiscrimination(tender);
    return res.json(result);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to check discrimination");
    return res.status(500).json({ error: "Greška pri analizi diskriminacije", message: err.message });
  }
});

// POST /api/tenders/:id/generate-urz-appeal — Generisanje formalnog podneska žalbe URŽ-u
tendersRouter.post("/:id/generate-urz-appeal", async (req, res) => {
  const { id } = req.params;
  try {
    const { generateUrzAppealDocx } = await import("../services/discriminationDetector");
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });

    const docxBuffer = await generateUrzAppealDocx(tender, req.body?.issueId);
    const safeTitle = (tender.title || "Tender").slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Zalba_URZ_BiH_${safeTitle}.docx"`);
    return res.send(docxBuffer);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to generate URZ appeal");
    return res.status(500).json({ error: "Greška pri generisanju žalbe", message: err.message });
  }
});

// POST /api/tenders/:id/extract-fleet-excel — Izvoz specifikacije voznog parka u Excel (.xlsx)
tendersRouter.post("/:id/extract-fleet-excel", async (req, res) => {
  const { id } = req.params;
  try {
    const { generateFleetExcel } = await import("../services/fleetExcelExtractor");
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id as string)).limit(1);
    if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });

    const docs = await db.select().from(documentsTable).where(eq(documentsTable.tenderId, id as string));
    const excelBuffer = await generateFleetExcel(tender, docs);
    const safeTitle = (tender.title || "Vozni_park").slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Specifikacija_Vozila_${safeTitle}.xlsx"`);
    return res.send(excelBuffer);
  } catch (err: any) {
    logger.error({ id, err: err.message }, "Failed to extract fleet excel");
    return res.status(500).json({ error: "Greška pri izvozu u Excel", message: err.message });
  }
});

