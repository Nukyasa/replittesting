import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { db, companyEvidenceTable, companyProfileTable, tenderRequirementsTable, tendersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { assertDocumentPayload, documentContentHash, extractDocumentContent } from "../lib/documentFiles";
import { runCompanyMarketCheck } from "../services/companyCheck";

const root = path.join(process.cwd(), "uploads", "company");
fs.mkdirSync(root, { recursive: true });
const upload = multer({ dest: root, limits: { fileSize: 20 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => {
  if (![".pdf", ".docx", ".txt"].includes(path.extname(file.originalname).toLowerCase())) return cb(new Error("Dozvoljeni formati su PDF, DOCX i TXT."));
  return cb(null, true);
} });

const list = (value: unknown) => Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean).slice(0, 100) : String(value || "").split(",").map(item => item.trim()).filter(Boolean).slice(0, 100);
const words = (value: string) => new Set(value.toLocaleLowerCase("bs").normalize("NFKD").replace(/[^a-z0-9čćžšđ]+/gi, " ").split(/\s+/).filter(word => word.length >= 4));

export const companyRouter = Router();
companyRouter.use(authMiddleware);

companyRouter.get("/", async (_req, res) => {
  const [profile] = await db.select().from(companyProfileTable).limit(1);
  const evidence = await db.select().from(companyEvidenceTable).orderBy(desc(companyEvidenceTable.updatedAt));
  res.json({ profile: profile || { id: "default", name: "", registrationNumber: "", capabilities: [], cpvCodes: [], keywords: [], excludedKeywords: [] }, evidence });
});

companyRouter.put("/", async (req, res) => {
  const [current] = await db.select().from(companyProfileTable).limit(1);
  const values = {
    name: String(req.body.name || "").trim().slice(0, 200), registrationNumber: String(req.body.registrationNumber || "").trim().slice(0, 80),
    capabilities: list(req.body.capabilities), cpvCodes: list(req.body.cpvCodes), keywords: list(req.body.keywords), excludedKeywords: list(req.body.excludedKeywords),
    updatedBy: req.user!.id, updatedAt: new Date(),
  };
  const [saved] = current
    ? await db.update(companyProfileTable).set(values).where(eq(companyProfileTable.id, current.id)).returning()
    : await db.insert(companyProfileTable).values({ id: "default", ...values }).returning();
  res.json(saved);
});

companyRouter.post("/evidence", (req, res, next) => upload.single("file")(req, res, error => error ? void res.status(400).json({ error: error.message }) : next()), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dodajte dokument dokaza." });
  try {
    const buffer = await fsp.readFile(req.file.path);
    assertDocumentPayload(buffer, req.file.originalname, req.file.mimetype);
    const hash = documentContentHash(buffer);
    const [duplicate] = await db.select().from(companyEvidenceTable).where(eq(companyEvidenceTable.contentHash, hash)).limit(1);
    if (duplicate) return res.status(409).json({ error: "Isti dokaz je već u biblioteci." });
    const content = await extractDocumentContent(buffer, req.file.originalname);
    const id = nanoid();
    const finalPath = path.join(root, `${id}${path.extname(req.file.originalname).toLowerCase()}`);
    await fsp.rename(req.file.path, finalPath);
    const [saved] = await db.insert(companyEvidenceTable).values({
      id, title: String(req.body.title || req.file.originalname).trim().slice(0, 240), evidenceType: String(req.body.evidenceType || "other").slice(0, 80),
      issuer: String(req.body.issuer || "").trim().slice(0, 200), validUntil: req.body.validUntil || null, tags: list(req.body.tags), status: "draft",
      localPath: finalPath, mimeType: req.file.mimetype, fileSize: buffer.length, parsedText: content.text, textPages: content.pages,
      extractionMetadata: { method: content.method, pageCount: content.pageCount, tables: content.tables, warnings: content.warnings }, contentHash: hash, uploadedBy: req.user!.id,
    }).returning();
    return res.json(saved);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Dokaz nije dodat." });
  } finally {
    await fsp.unlink(req.file.path).catch(() => {});
  }
});

companyRouter.patch("/evidence/:id", async (req, res) => {
  const status = ["draft", "approved", "expired"].includes(req.body.status) ? req.body.status : undefined;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (req.body.validUntil !== undefined) updates.validUntil = req.body.validUntil || null;
  if (req.body.tags !== undefined) updates.tags = list(req.body.tags);
  const [saved] = await db.update(companyEvidenceTable).set(updates).where(eq(companyEvidenceTable.id, req.params.id)).returning();
  if (!saved) return res.status(404).json({ error: "Dokaz nije pronađen." });
  return res.json(saved);
});

companyRouter.get("/evidence/:id/download", async (req, res) => {
  const [item] = await db.select().from(companyEvidenceTable).where(eq(companyEvidenceTable.id, req.params.id)).limit(1);
  if (!item) return res.status(404).json({ error: "Dokaz nije pronađen." });
  const resolved = path.resolve(item.localPath);
  const relative = path.relative(path.resolve(root), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved)) return res.status(404).json({ error: "Datoteka nije dostupna." });
  return res.download(resolved, item.title + path.extname(resolved));
});

companyRouter.get("/match/:tenderId", async (req, res) => {
  const [[tender], requirements, evidence, [profile]] = await Promise.all([
    db.select().from(tendersTable).where(eq(tendersTable.id, req.params.tenderId)).limit(1),
    db.select().from(tenderRequirementsTable).where(eq(tenderRequirementsTable.tenderId, req.params.tenderId)),
    db.select().from(companyEvidenceTable).orderBy(desc(companyEvidenceTable.updatedAt)),
    db.select().from(companyProfileTable).limit(1),
  ]);
  if (!tender) return res.status(404).json({ error: "Tender nije pronađen." });
  const today = new Date().toISOString().slice(0, 10);
  const usable = evidence.filter((item: typeof companyEvidenceTable.$inferSelect) => item.status === "approved" && (!item.validUntil || item.validUntil >= today));
  const matches = requirements.map((requirement: typeof tenderRequirementsTable.$inferSelect) => {
    const sourceWords = words(`${requirement.title} ${requirement.sourceQuote}`);
    const candidates = usable.map((item: typeof companyEvidenceTable.$inferSelect) => {
      const candidateWords = words(`${item.title} ${item.evidenceType} ${item.issuer} ${item.tags.join(" ")} ${item.parsedText?.slice(0, 4000) || ""}`);
      const terms = [...sourceWords].filter(word => candidateWords.has(word));
      return { id: item.id, title: item.title, validUntil: item.validUntil, terms, relevance: terms.length };
    }).filter((item: { relevance: number }) => item.relevance > 0).sort((a: { relevance: number }, b: { relevance: number }) => b.relevance - a.relevance).slice(0, 3);
    return { requirementId: requirement.id, title: requirement.title, sourceQuote: requirement.sourceQuote, documentId: requirement.documentId, candidates };
  });
  const tenderWords = words(`${tender.title} ${tender.description || ""} ${tender.cpvCodes.join(" ")}`);
  const profileTerms = [...tenderWords].filter(word => words(`${profile?.capabilities.join(" ")} ${profile?.keywords.join(" ")} ${profile?.cpvCodes.join(" ")}`).has(word));
  return res.json({ profileConfigured: Boolean(profile?.name), approvedEvidenceCount: usable.length, requirementCount: requirements.length, suggestedEvidenceCount: matches.filter((item: { candidates: unknown[] }) => item.candidates.length).length, profileTerms, matches, disclaimer: "Podudaranje predlaže moguće dokaze. Odgovorna osoba mora potvrditi da dokaz tačno ispunjava uslov iz izvornog dokumenta." });
});

companyRouter.get("/market-check", async (req, res) => {
  const query = String(req.query.query || "").trim();
  if (!query) return res.status(400).json({ error: "Unesite naziv ili identifikacioni broj firme." });
  try {
    const result = await runCompanyMarketCheck(query);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Greška pri analizi tržišta firme." });
  }
});
