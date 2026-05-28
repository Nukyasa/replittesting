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
import { eq, and, desc, asc, ilike, gte, lte, sql, inArray } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { analyzeTender, chatAboutTender } from "../services/aiAnalyzer";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";

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
    conditions.push(ilike(tendersTable.title, `%${search}%`));
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
      .where(where),
  ]);

  let result = tenders;

  if (minScore !== undefined || maxScore !== undefined) {
    const min = minScore ? parseFloat(minScore) : 0;
    const max = maxScore ? parseFloat(maxScore) : 100;
    result = result.filter(
      (t) => t.relevanceScore != null && t.relevanceScore >= min && t.relevanceScore <= max
    );
  }

  res.json({
    tenders: result,
    total: count,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(count / limitNum),
  });
});

tendersRouter.get("/export", async (req, res) => {
  const {
    search,
    source,
    entity,
    category,
    status,
  } = req.query as Record<string, string>;

  const conditions = [];
  if (search) conditions.push(ilike(tendersTable.title, `%${search}%`));
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

tendersRouter.post("/:id/analyze", async (req, res) => {
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
        .set({
          ...result,
          analyzedAt: new Date(),
          analysisVersion: "2",
        })
        .where(eq(aiAnalysisTable.tenderId, id))
        .returning();
    } else {
      [analysis] = await db
        .insert(aiAnalysisTable)
        .values({
          id: nanoid(),
          tenderId: id,
          ...result,
        })
        .returning();
    }

    res.json(analysis);
  } catch (err) {
    logger.error({ err }, "Failed to analyze tender");
    res.status(500).json({ error: "Analysis failed" });
  }
});

tendersRouter.post("/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });

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

  const [note] = await db
    .insert(notesTable)
    .values({
      id: nanoid(),
      tenderId: req.params.id,
      userId: req.user!.id,
      content,
    })
    .returning();

  res.status(201).json(note);
});

tendersRouter.delete("/:id/notes/:noteId", async (req, res) => {
  await db
    .delete(notesTable)
    .where(
      and(eq(notesTable.id, req.params.noteId), eq(notesTable.userId, req.user!.id))
    );
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
    .values({
      id: nanoid(),
      userId,
      tenderId: id,
      status: "watching",
      priority: "medium",
    })
    .returning();

  res.json(userTender);
});

tendersRouter.delete("/:id/watch", async (req, res) => {
  await db
    .delete(userTendersTable)
    .where(
      and(
        eq(userTendersTable.tenderId, req.params.id),
        eq(userTendersTable.userId, req.user!.id)
      )
    );
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
      .values({
        id: nanoid(),
        userId,
        tenderId: id,
        status: status || "watching",
        priority: priority || "medium",
        ...updates,
      })
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
