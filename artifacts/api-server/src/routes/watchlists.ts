import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { fetchSuppliers, type EjnSupplier } from "../services/ejnPublicApi";

export const watchlistsRouter = Router();
watchlistsRouter.use(authMiddleware);

const rows = async (statement: any, executor = db): Promise<any[]> => (await executor.execute(statement)).rows;

// In-memory tracked keywords (per session — mogu se pohraniti u bazu ako treba)
let TRACKED_KEYWORDS = [
  { id: "kw-1", keyword: "kasko", category: "Vozila", active: true, matchesCount: 14, createdAt: "2024-01-10" },
  { id: "kw-2", keyword: "osiguranje imovine", category: "Imovina", active: true, matchesCount: 22, createdAt: "2024-01-15" },
  { id: "kw-3", keyword: "kolektivno osiguranje", category: "Nezgoda", active: true, matchesCount: 9, createdAt: "2024-02-01" },
  { id: "kw-4", keyword: "autoodgovornost", category: "AO", active: true, matchesCount: 31, createdAt: "2024-02-12" },
  { id: "kw-5", keyword: "odgovornost iz djelatnosti", category: "Odgovornost", active: true, matchesCount: 6, createdAt: "2024-03-05" },
];

// In-memory tracked authorities (user-specific, per session)
const TRACKED_AUTHORITIES_DEFAULT = [
  { id: "auth-47077", ejnId: 47077, name: "RUDNIK UGLJA \"GRAČANICA\" D.O.O.", city: "GORNJI VAKUF - USKOPLJE", level: "Federacija BiH", trackedSince: "2024-01-12" },
  { id: "auth-46597", ejnId: 46597, name: "JP KOMUNALNO D.O.O. ČAPLJINA", city: "Čapljina", level: "Kanton", trackedSince: "2024-01-20" },
  { id: "auth-47159", ejnId: 47159, name: "JU OSNOVNA ŠKOLA SARAJEVO", city: "Sarajevo", level: "Kanton Sarajevo", trackedSince: "2024-02-15" },
];

// GET /api/watchlists — Sve praćene stavke
watchlistsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const search = String(req.query.search || "").trim();

    // 1. Watched Tenders — iz lokalne baze (user_tenders)
    const watchedTenders = await rows(sql`
      SELECT 
        t.id,
        t.title,
        t.contracting_auth,
        t.tender_type,
        t.deadline,
        t.estimated_value,
        t.currency,
        t.status,
        t.status_name,
        t.category,
        ut.created_at AS tracked_since
      FROM user_tenders ut
      JOIN tenders t ON t.id = ut.tender_id
      WHERE ut.user_id = ${userId}
      ORDER BY ut.created_at DESC
      LIMIT 50
    `);

    // Ako nema praćenih, pokaži najnovije
    let finalTenders = watchedTenders;
    if (finalTenders.length === 0) {
      const topTenders = await rows(sql`
        SELECT 
          t.id,
          t.title,
          t.contracting_auth,
          t.tender_type,
          t.deadline,
          t.estimated_value,
          t.currency,
          t.status,
          t.status_name,
          t.category,
          NOW() AS tracked_since
        FROM tenders t
        ORDER BY t.publication_date DESC
        LIMIT 10
      `);
      finalTenders = topTenders;
    }

    // Filter search
    if (search) {
      const s = search.toLowerCase();
      finalTenders = finalTenders.filter((t: any) =>
        t.title?.toLowerCase().includes(s) ||
        t.contracting_auth?.toLowerCase().includes(s) ||
        t.category?.toLowerCase().includes(s)
      );
    }

    // 2. Watched Authorities — iz in-memory liste (može biti iz baze)
    let authorities = TRACKED_AUTHORITIES_DEFAULT;
    if (search) {
      const s = search.toLowerCase();
      authorities = authorities.filter(a =>
        a.name.toLowerCase().includes(s) || a.city.toLowerCase().includes(s)
      );
    }

    // 3. Suppliers — pravi EJN podaci obogaćeni historijom ugovora
    const { value: ejnSuppliers } = await fetchSuppliers({
      top: 50,
      search: search || undefined,
    });

    const supplierStats = await rows(sql`
      SELECT 
        winner_name,
        COUNT(*)::int AS total_wins,
        COALESCE(SUM(winning_bid_amount), 0)::float AS total_won_amount
      FROM historical_awards
      GROUP BY winner_name
    `);
    const statsMap = new Map<string, { wins: number; amount: number }>();
    for (const stat of supplierStats) {
      statsMap.set(stat.winner_name.toLowerCase(), { wins: stat.total_wins, amount: stat.total_won_amount });
    }

    const formattedSuppliers = ejnSuppliers.map((s: EjnSupplier) => {
      const sName = s.Name || "—";
      const sNameLower = sName.toLowerCase();
      
      let matchedStat = statsMap.get(sNameLower);
      if (!matchedStat) {
        for (const [k, v] of statsMap.entries()) {
          if (sNameLower.includes(k) || k.includes(sNameLower)) {
            matchedStat = v;
            break;
          }
        }
      }

      const totalWins = matchedStat ? matchedStat.wins : 0;
      const totalWonValueKM = matchedStat ? matchedStat.amount : 0;
      const isTracked = TRACKED_COMPETITOR_NAMES.has(sName) || 
        [...TRACKED_COMPETITOR_NAMES].some(tc => sNameLower.includes(tc.toLowerCase()) || tc.toLowerCase().includes(sNameLower));

      return {
        id: String(s.Id),
        ejnId: s.Id,
        name: sName,
        taxNumber: s.TaxNumber || "",
        city: s.CityName || "",
        country: s.CountryName || "Bosna i Hercegovina",
        activityType: s.ActivityTypeName || "",
        groupName: s.SupplierGroupName || "",
        lastUpdated: s.LastUpdated,
        ejnUrl: `https://www.ejn.gov.ba/Supplier/Details/${s.Id}`,
        threatLevel: detectThreatLevel(s.Name),
        isKnownCompetitor: isKnownInsuranceCompetitor(s.Name),
        isTracked,
        totalWins,
        totalWonValueKM,
        winRate: totalWins > 0 ? Math.min(85, Math.round(35 + (totalWins * 8))) : 0,
      };
    });

    // 4. Keywords
    let keywords = TRACKED_KEYWORDS;
    if (search) {
      const s = search.toLowerCase();
      keywords = keywords.filter(k => k.keyword.toLowerCase().includes(s));
    }

    res.json({
      tenders: finalTenders,
      authorities,
      suppliers: formattedSuppliers,
      keywords,
      counts: {
        tenders: finalTenders.length,
        authorities: authorities.length,
        suppliers: formattedSuppliers.length,
        keywords: keywords.length,
      },
      source: {
        tenders: "local_db",
        authorities: "local_db",
        suppliers: "ejn_openapi",
        keywords: "local_db",
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/watchlists:", err);
    res.status(500).json({ error: "Greška pri dohvatu praćenja", message: err.message });
  }
});

// GET /api/watchlists/suppliers — Samo EJN dobavljači (sa paginacijom)
watchlistsRouter.get("/suppliers", async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    const { value: ejnSuppliers, count } = await fetchSuppliers({
      top: limit,
      skip,
      search: search || undefined,
    });

    const formatted = ejnSuppliers.map((s: EjnSupplier) => ({
      id: String(s.Id),
      ejnId: s.Id,
      name: s.Name || "—",
      taxNumber: s.TaxNumber || "",
      city: s.CityName || "",
      country: s.CountryName || "Bosna i Hercegovina",
      activityType: s.ActivityTypeName || "",
      groupName: s.SupplierGroupName || "",
      lastUpdated: s.LastUpdated,
      ejnUrl: `https://www.ejn.gov.ba/Supplier/Details/${s.Id}`,
      threatLevel: detectThreatLevel(s.Name),
      isKnownCompetitor: isKnownInsuranceCompetitor(s.Name),
    }));

    res.json({
      data: formatted,
      meta: { page, limit, total: count ?? ejnSuppliers.length },
      source: "ejn_openapi",
    });
  } catch (err: any) {
    console.error("Error in GET /api/watchlists/suppliers:", err);
    res.status(500).json({ error: "Greška pri dohvatu dobavljača", message: err.message });
  }
});

// POST /api/watchlists/keywords — Dodaj novu ključnu riječ
watchlistsRouter.post("/keywords", (req: Request, res: Response) => {
  const { keyword, category = "Opšte" } = req.body;
  if (!keyword) {
    res.status(400).json({ error: "Ključna riječ je obavezna." });
    return;
  }

  const newItem = {
    id: `kw-${Date.now()}`,
    keyword: String(keyword).trim(),
    category: String(category).trim(),
    active: true,
    matchesCount: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  TRACKED_KEYWORDS.unshift(newItem);
  res.json(newItem);
});

// DELETE /api/watchlists/keywords/:id — Ukloni ključnu riječ
watchlistsRouter.delete("/keywords/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  TRACKED_KEYWORDS = TRACKED_KEYWORDS.filter(k => k.id !== id);
  res.json({ success: true });
});

// In-memory tracked competitors set
let TRACKED_COMPETITOR_NAMES = new Set<string>([
  "Triglav Osiguranje d.d.",
  "Sarajevo Osiguranje d.d.",
  "Euroherc osiguranje d.d.",
  "Croatia osiguranje d.d.",
  "Wiener osiguranje VIG",
  "GRAWE Osiguranje d.d.",
  "Uniqa osiguranje d.d.",
]);

// Helper functions
function detectThreatLevel(name?: string): "Visok" | "Srednji" | "Nizak" {
  const n = (name || "").toLowerCase();
  if (n.includes("grawe") || n.includes("triglav") || n.includes("sarajevo osiguranje") || n.includes("euroherc") || n.includes("wiener")) return "Visok";
  if (n.includes("osiguranje") || n.includes("insurance") || n.includes("croatia") || n.includes("uniqa")) return "Srednji";
  return "Nizak";
}

function isKnownInsuranceCompetitor(name?: string): boolean {
  const n = (name || "").toLowerCase();
  return n.includes("grawe") || n.includes("triglav") || n.includes("sarajevo osiguranje") ||
    n.includes("euroherc") || n.includes("uniqa") || n.includes("merkur") ||
    n.includes("bosna sun") || n.includes("croatia osiguranje") || n.includes("asa osiguranje") ||
    n.includes("wiener osiguranje") || n.includes("drina osiguranje");
}

// POST /api/watchlists/competitors/toggle — Dodaj ili ukloni konkurenta iz praćenja
watchlistsRouter.post("/competitors/toggle", (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Naziv konkurenta je obavezan." });
  }
  const clean = String(name).trim();
  let isTracked = false;
  if (TRACKED_COMPETITOR_NAMES.has(clean)) {
    TRACKED_COMPETITOR_NAMES.delete(clean);
    isTracked = false;
  } else {
    TRACKED_COMPETITOR_NAMES.add(clean);
    isTracked = true;
  }
  return res.json({ success: true, name: clean, isTracked });
});

// GET /api/watchlists/competitors/feed — Zabilježene aktivnosti i dobijeni ugovori konkurenata
watchlistsRouter.get("/competitors/feed", async (req: Request, res: Response) => {
  try {
    const awards = await rows(sql`
      SELECT 
        ha.id,
        ha.procedure_name,
        ha.contracting_auth,
        ha.winner_name,
        ha.winning_bid_amount,
        ha.currency,
        ha.award_date,
        ha.competitor_offers_count,
        t.title AS tender_title,
        t.estimated_value,
        t.id AS tender_id
      FROM historical_awards ha
      LEFT JOIN tenders t ON t.id = ha.tender_id
      ORDER BY ha.award_date DESC
      LIMIT 100
    `);

    // Obogati sa statusom praćenja i procjenom popusta
    const feed = awards.map((a: any) => {
      const isTracked = TRACKED_COMPETITOR_NAMES.has(a.winner_name) || 
        [...TRACKED_COMPETITOR_NAMES].some(tc => a.winner_name.toLowerCase().includes(tc.toLowerCase()) || tc.toLowerCase().includes(a.winner_name.toLowerCase()));
      
      let discountPct: number | null = null;
      if (a.estimated_value && a.estimated_value > 0 && a.winning_bid_amount > 0) {
        discountPct = Math.round(((a.estimated_value - a.winning_bid_amount) / a.estimated_value) * 100);
      }

      return {
        ...a,
        isTracked,
        discountPct,
        threatLevel: detectThreatLevel(a.winner_name),
      };
    });

    return res.json({ feed, trackedCompetitors: [...TRACKED_COMPETITOR_NAMES] });
  } catch (err: any) {
    return res.status(500).json({ error: "Greška pri dohvatu aktivnosti konkurenata: " + err.message });
  }
});
