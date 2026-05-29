import { Router } from "express";
import { db } from "@workspace/db";
import {
  tendersTable,
  aiAnalysisTable,
  documentsTable,
  notesTable,
  userTendersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, ilike, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { analyzeTender, chatAboutTender } from "../services/aiAnalyzer";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import { aiLimiter } from "../lib/rateLimiters";
import ExcelJS from "exceljs";

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
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
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
    conditions.push(eq(tendersTable.category, category));
  }
  if (status) {
    conditions.push(eq(tendersTable.status, status));
  }
  if (minScore !== undefined) {
    conditions.push(gte(aiAnalysisTable.relevanceScore, parseFloat(minScore)));
  }
  if (maxScore !== undefined) {
    conditions.push(lte(aiAnalysisTable.relevanceScore, parseFloat(maxScore)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy;
  const dir = sortOrder === "asc" ? asc : desc;
  switch (sortBy) {
    case "deadline":
      orderBy = dir(tendersTable.deadline);
      break;
    case "estimatedValue":
      orderBy = dir(tendersTable.estimatedValue);
      break;
    case "publicationDate":
      orderBy = dir(tendersTable.publicationDate);
      break;
    default:
      orderBy = dir(tendersTable.createdAt);
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
        createdAt: tendersTable.createdAt,
        relevanceScore: aiAnalysisTable.relevanceScore,
      })
      .from(tendersTable)
      .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
      .where(where)
      .orderBy(orderBy)
      .limit(limitNum)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tendersTable)
      .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
      .where(where),
  ]);

  res.json({
    tenders,
    total: count,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(count / limitNum),
  });
});

tendersRouter.get("/export", async (req, res) => {
  const { search, source, entity, category, status } = req.query as Record<string, string>;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
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
      relevanceScore: aiAnalysisTable.relevanceScore,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(where)
    .orderBy(desc(tendersTable.publicationDate))
    .limit(5000);

  const BOM = "\uFEFF";
  const headers = ["ID", "Naziv", "Ugovorni organ", "Entitet", "Kategorija", "Izvor", "Status", "Vrijednost", "Valuta", "Datum objave", "Rok prijave", "AI ocjena"];

  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("bs-BA") : "";
  const rows = tenders.map(t => [
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

  const csv = BOM + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ejn_tenderi_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

tendersRouter.get("/export/xlsx", async (req, res) => {
  const { search, source, entity, category, status } = req.query as Record<string, string>;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(tendersTable.title, `%${search}%`),
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
      relevanceScore: aiAnalysisTable.relevanceScore,
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

  tenders.forEach((t) => {
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
      batch.map(async ({ id }) => {
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
            .set({ ...result, analyzedAt: new Date(), analysisVersion: "2" })
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

  res.json({ analyzed, failed, errors });
});

tendersRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, id))
    .limit(1);

  const docs = await db.select().from(documentsTable).where(eq(documentsTable.tenderId, id));

  const [userTender] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id), eq(userTendersTable.userId, userId)))
    .limit(1);

  res.json({
    ...tender,
    relevanceScore: analysis?.relevanceScore ?? null,
    aiAnalysis: analysis ?? null,
    documents: docs,
    userTender: userTender ?? null,
  });
});

tendersRouter.get("/:id/analysis", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, req.params.id))
    .limit(1);
  if (!analysis) return res.status(404).json({ error: "No analysis found" });
  res.json(analysis);
});

tendersRouter.post("/:id/analyze", aiLimiter, async (req, res) => {
  const { id } = req.params;
  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  try {
    const result = await analyzeTender(tender);

    const existing = await db
      .select({ id: aiAnalysisTable.id })
      .from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.tenderId, id))
      .limit(1);

    let analysis;
    if (existing.length > 0) {
      [analysis] = await db
        .update(aiAnalysisTable)
        .set({ ...result, analyzedAt: new Date(), analysisVersion: "2" })
        .where(eq(aiAnalysisTable.tenderId, id))
        .returning();
    } else {
      [analysis] = await db
        .insert(aiAnalysisTable)
        .values({ id: nanoid(), tenderId: id, ...result })
        .returning();
    }

    res.json(analysis);
  } catch (err) {
    logger.error({ err }, "Failed to analyze tender");
    res.status(500).json({ error: "Analysis failed" });
  }
});

tendersRouter.post("/:id/chat", aiLimiter, async (req, res) => {
  const { id } = req.params;
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });
  if (typeof message === "string" && message.length > 2000) {
    return res.status(400).json({ error: "Poruka ne može biti duža od 2000 znakova" });
  }

  const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
  if (!tender) return res.status(404).json({ error: "Tender not found" });

  const [analysis] = await db
    .select()
    .from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.tenderId, id))
    .limit(1);

  const response = await chatAboutTender(tender, analysis ?? null, message, history);
  res.json({ response });
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
    .values({ id: nanoid(), tenderId: req.params.id, userId: req.user!.id, content })
    .returning();

  res.status(201).json(note);
});

tendersRouter.delete("/:id/notes/:noteId", async (req, res) => {
  await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, req.params.noteId), eq(notesTable.userId, req.user!.id)));
  res.status(204).send();
});

tendersRouter.post("/:id/watch", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [existing] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id), eq(userTendersTable.userId, userId)))
    .limit(1);

  if (existing) return res.json(existing);

  const [userTender] = await db
    .insert(userTendersTable)
    .values({ id: nanoid(), userId, tenderId: id, status: "watching", priority: "medium" })
    .returning();

  res.json(userTender);
});

tendersRouter.delete("/:id/watch", async (req, res) => {
  await db
    .delete(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, req.params.id), eq(userTendersTable.userId, req.user!.id)));
  res.status(204).send();
});

tendersRouter.patch("/:id/userstatus", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { status, priority, assignedTo, internalDeadline } = req.body;

  const [existing] = await db
    .select()
    .from(userTendersTable)
    .where(and(eq(userTendersTable.tenderId, id), eq(userTendersTable.userId, userId)))
    .limit(1);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (internalDeadline !== undefined)
    updates.internalDeadline = internalDeadline ? new Date(internalDeadline) : null;

  let result;
  if (existing) {
    [result] = await db
      .update(userTendersTable)
      .set(updates)
      .where(and(eq(userTendersTable.tenderId, id), eq(userTendersTable.userId, userId)))
      .returning();
  } else {
    [result] = await db
      .insert(userTendersTable)
      .values({ id: nanoid(), userId, tenderId: id, status: status || "watching", priority: priority || "medium", ...updates })
      .returning();
  }

  res.json(result);
});

tendersRouter.get("/:id/documents", async (req, res) => {
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.tenderId, req.params.id));
  res.json(docs);
});
