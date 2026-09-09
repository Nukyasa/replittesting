import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, marketProfilesTable, tendersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";

const list = (value: unknown) => Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean).slice(0, 50) : String(value || "").split(",").map(item => item.trim()).filter(Boolean).slice(0, 50);
const normalized = (value: string) => value.toLocaleLowerCase("bs").normalize("NFKD").replace(/[^a-z0-9čćžšđ]+/gi, " ");
const asNumber = (value: unknown) => value === undefined || value === null || value === "" ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;

export const marketsRouter = Router();
marketsRouter.use(authMiddleware);

marketsRouter.get("/", async (req, res) => {
  return res.json(await db.select().from(marketProfilesTable).where(eq(marketProfilesTable.userId, req.user!.id)).orderBy(desc(marketProfilesTable.updatedAt)));
});

marketsRouter.post("/", async (req, res) => {
  const minValue = asNumber(req.body.minValue), maxValue = asNumber(req.body.maxValue);
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 120 || minValue === undefined || maxValue === undefined || (minValue !== null && maxValue !== null && minValue > maxValue)) return res.status(400).json({ error: "Unesite naziv i ispravan raspon vrijednosti tržišta." });
  const [saved] = await db.insert(marketProfilesTable).values({ id: nanoid(), userId: req.user!.id, name, cpvCodes: list(req.body.cpvCodes), keywords: list(req.body.keywords), authorityNames: list(req.body.authorityNames), minValue, maxValue, openOnly: req.body.openOnly !== false }).returning();
  return res.status(201).json(saved);
});

marketsRouter.put("/:id", async (req, res) => {
  const minValue = asNumber(req.body.minValue), maxValue = asNumber(req.body.maxValue);
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 120 || minValue === undefined || maxValue === undefined || (minValue !== null && maxValue !== null && minValue > maxValue)) return res.status(400).json({ error: "Unesite naziv i ispravan raspon vrijednosti tržišta." });
  const [saved] = await db.update(marketProfilesTable).set({ name, cpvCodes: list(req.body.cpvCodes), keywords: list(req.body.keywords), authorityNames: list(req.body.authorityNames), minValue, maxValue, openOnly: req.body.openOnly !== false, updatedAt: new Date() }).where(and(eq(marketProfilesTable.id, req.params.id), eq(marketProfilesTable.userId, req.user!.id))).returning();
  if (!saved) return res.status(404).json({ error: "Tržište nije pronađeno." });
  return res.json(saved);
});

marketsRouter.get("/:id/tenders", async (req, res) => {
  const [market] = await db.select().from(marketProfilesTable).where(and(eq(marketProfilesTable.id, req.params.id), eq(marketProfilesTable.userId, req.user!.id))).limit(1);
  if (!market) return res.status(404).json({ error: "Tržište nije pronađeno." });
  const candidates = await db.select({ id: tendersTable.id, externalId: tendersTable.externalId, title: tendersTable.title, contractingAuth: tendersTable.contractingAuth, cpvCodes: tendersTable.cpvCodes, estimatedValue: tendersTable.estimatedValue, currency: tendersTable.currency, publicationDate: tendersTable.publicationDate, deadline: tendersTable.deadline, status: tendersTable.status, updatedAt: tendersTable.updatedAt }).from(tendersTable).orderBy(desc(tendersTable.publicationDate)).limit(500);
  const cpv = new Set((market.cpvCodes as string[]).map((code: string) => code.trim()));
  const keywords = (market.keywords as string[]).map(normalized).filter(Boolean);
  const authorities = (market.authorityNames as string[]).map(normalized).filter(Boolean);
  const tenders = candidates.filter((item: { status: string; estimatedValue: number | null; cpvCodes: string[]; title: string; contractingAuth: string }) => {
    if (market.openOnly && item.status !== "open") return false;
    if (market.minValue !== null && (item.estimatedValue === null || item.estimatedValue < market.minValue)) return false;
    if (market.maxValue !== null && (item.estimatedValue === null || item.estimatedValue > market.maxValue)) return false;
    const haystack = normalized(`${item.title} ${item.contractingAuth}`);
    return (!cpv.size && !keywords.length && !authorities.length) || item.cpvCodes.some((code: string) => cpv.has(code)) || keywords.some((word: string) => haystack.includes(word)) || authorities.some((name: string) => normalized(item.contractingAuth).includes(name));
  }).map((item: { cpvCodes: string[]; title: string; contractingAuth: string } & Record<string, unknown>) => ({ ...item, reasons: [...item.cpvCodes.filter((code: string) => cpv.has(code)), ...keywords.filter((word: string) => normalized(`${item.title} ${item.contractingAuth}`).includes(word)), ...authorities.filter((name: string) => normalized(item.contractingAuth).includes(name))].slice(0, 5) }));
  return res.json({ market, tenders, checkedAt: new Date().toISOString() });
});
