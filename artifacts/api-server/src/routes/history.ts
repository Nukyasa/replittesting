import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { historicalAwardsTable, contractingAuthorityProfilesTable } from "@workspace/db";
import { sql, desc, asc, ilike, and, or, eq, gte } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { seedHistoryData } from "../services/historySeed";

export const historyRouter = Router();

// GET /api/history — Lista dodijeljenih ugovora sa filterima i popustima
historyRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Ensure initial seed if table is currently empty
    const checkCount = await db.select().from(historicalAwardsTable).limit(1);
    if (checkCount.length === 0) {
      await seedHistoryData();
    }
    const search = String(req.query.search || "").trim();
    const winner = String(req.query.winner || "").trim();
    const authority = String(req.query.authority || "").trim();
    const category = String(req.query.category || "").trim();
    const scope = String(req.query.scope || "asa").toLowerCase(); // asa (osiguranje + tehnicki), insurance, inspection, all
    const minDiscount = req.query.minDiscount ? Number(req.query.minDiscount) : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;
    const sortBy = String(req.query.sortBy || "awardDate");
    const sortOrder = String(req.query.sortOrder || "desc").toLowerCase();

    // Izgradi WHERE uslove
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(historicalAwardsTable.procedureName, `%${search}%`),
          ilike(historicalAwardsTable.contractingAuth, `%${search}%`),
          ilike(historicalAwardsTable.winnerName, `%${search}%`),
          ilike(historicalAwardsTable.ejnBroj, `%${search}%`)
        )
      );
    }

    if (winner && winner !== "all") {
      conditions.push(ilike(historicalAwardsTable.winnerName, `%${winner}%`));
    }

    if (authority) {
      conditions.push(ilike(historicalAwardsTable.contractingAuth, `%${authority}%`));
    }

    if (minDiscount !== undefined && !Number.isNaN(minDiscount)) {
      conditions.push(gte(historicalAwardsTable.discountPct, minDiscount));
    }

    // Scope filter (Osiguranje i Tehnički pregled)
    if (scope === "insurance") {
      conditions.push(
        or(
          ilike(historicalAwardsTable.procedureName, "%osigur%"),
          ilike(historicalAwardsTable.procedureName, "%kasko%"),
          ilike(historicalAwardsTable.cpvKod, "6651%")
        )
      );
    } else if (scope === "inspection") {
      conditions.push(
        or(
          ilike(historicalAwardsTable.procedureName, "%tehničk%pregled%"),
          ilike(historicalAwardsTable.procedureName, "%tehnick%pregled%"),
          ilike(historicalAwardsTable.procedureName, "%ispitivanje vozila%"),
          ilike(historicalAwardsTable.procedureName, "%tahograf%"),
          ilike(historicalAwardsTable.cpvKod, "7163%")
        )
      );
    } else if (scope === "asa") {
      conditions.push(
        or(
          ilike(historicalAwardsTable.procedureName, "%osigur%"),
          ilike(historicalAwardsTable.procedureName, "%kasko%"),
          ilike(historicalAwardsTable.cpvKod, "6651%"),
          ilike(historicalAwardsTable.procedureName, "%tehničk%pregled%"),
          ilike(historicalAwardsTable.procedureName, "%tehnick%pregled%"),
          ilike(historicalAwardsTable.procedureName, "%ispitivanje vozila%"),
          ilike(historicalAwardsTable.procedureName, "%tahograf%"),
          ilike(historicalAwardsTable.cpvKod, "7163%")
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Dohvati podatke
    let query = db.select().from(historicalAwardsTable);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }

    // Sortiranje
    if (sortBy === "winningBidAmount") {
      query = (sortOrder === "asc" ? query.orderBy(asc(historicalAwardsTable.winningBidAmount)) : query.orderBy(desc(historicalAwardsTable.winningBidAmount))) as any;
    } else if (sortBy === "discountPct") {
      query = (sortOrder === "asc" ? query.orderBy(asc(historicalAwardsTable.discountPct)) : query.orderBy(desc(historicalAwardsTable.discountPct))) as any;
    } else {
      query = (sortOrder === "asc" ? query.orderBy(asc(historicalAwardsTable.awardDate)) : query.orderBy(desc(historicalAwardsTable.awardDate))) as any;
    }

    const allMatched = await query;
    const total = allMatched.length;
    const paged = allMatched.slice(offset, offset + limit);

    // Mapiraj i izračunaj uštede
    const items = paged.map((row: any) => {
      const estVal = row.estimatedValue || row.winningBidAmount * 1.15;
      const discount = row.discountPct !== null && row.discountPct !== undefined
        ? row.discountPct
        : Math.max(0, Math.round(((estVal - row.winningBidAmount) / estVal) * 1000) / 10);
      const savings = Math.max(0, estVal - row.winningBidAmount);

      const isInspection = (row.procedureName || "").toLowerCase().includes("tehničk") ||
        (row.procedureName || "").toLowerCase().includes("tehnick") ||
        (row.procedureName || "").toLowerCase().includes("tahograf") ||
        (row.cpvKod || "").startsWith("7163");

      return {
        id: row.id,
        tenderId: row.tenderId,
        ejnBroj: row.ejnBroj || "—",
        procedureName: row.procedureName,
        contractingAuth: row.contractingAuth,
        winnerName: row.winnerName,
        winningBidAmount: row.winningBidAmount,
        estimatedValue: estVal,
        discountPct: discount,
        savingsAmountKM: savings,
        competitorOffersCount: row.competitorOffersCount || 1,
        currency: row.currency || "KM",
        awardDate: row.awardDate ? row.awardDate.toISOString() : new Date().toISOString(),
        cpvKod: row.cpvKod || (isInspection ? "71631200-2" : "66514110-0"),
        category: isInspection ? "Tehnički pregled" : "Osiguranje",
        hasEAuction: true,
      };
    });

    res.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Greška u GET /api/history:", error);
    res.status(500).json({ error: "Greška pri dohvatanju historije tendera", message: error.message });
  }
});

// GET /api/history/stats — Agregirana statistika e-aukcija, popusta i pobjednika
historyRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const scope = String(req.query.scope || "asa").toLowerCase();
    const rows = await db.select().from(historicalAwardsTable);

    let filtered = rows;
    if (scope === "insurance") {
      filtered = rows.filter((r: any) => 
        (r.procedureName || "").toLowerCase().includes("osigur") ||
        (r.procedureName || "").toLowerCase().includes("kasko") ||
        (r.cpvKod || "").startsWith("6651")
      );
    } else if (scope === "inspection") {
      filtered = rows.filter((r: any) => 
        (r.procedureName || "").toLowerCase().includes("tehničk") ||
        (r.procedureName || "").toLowerCase().includes("tehnick") ||
        (r.procedureName || "").toLowerCase().includes("tahograf") ||
        (r.cpvKod || "").startsWith("7163")
      );
    }

    const totalAwards = filtered.length;
    const totalAmount = filtered.reduce((acc: number, r: any) => acc + (r.winningBidAmount || 0), 0);
    
    // Prosječan popust
    const discounts = filtered.map((r: any) => {
      if (r.discountPct !== null && r.discountPct !== undefined) return r.discountPct;
      const est = r.estimatedValue || r.winningBidAmount * 1.15;
      return Math.max(0, Math.round(((est - r.winningBidAmount) / est) * 1000) / 10);
    });
    const avgDiscount = discounts.length > 0 
      ? Math.round((discounts.reduce((a: number, b: number) => a + b, 0) / discounts.length) * 10) / 10 
      : 0;

    // Top pobjednici
    const winnerMap = new Map<string, { count: number; totalAmount: number; discounts: number[] }>();
    for (const r of filtered) {
      const name = r.winnerName || "Ostali";
      const existing = winnerMap.get(name) || { count: 0, totalAmount: 0, discounts: [] };
      existing.count += 1;
      existing.totalAmount += r.winningBidAmount || 0;
      if (r.discountPct) existing.discounts.push(r.discountPct);
      winnerMap.set(name, existing);
    }

    const topWinners = Array.from(winnerMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmountKM: data.totalAmount,
        avgDiscountPct: data.discounts.length > 0
          ? Math.round((data.discounts.reduce((a: number, b: number) => a + b, 0) / data.discounts.length) * 10) / 10
          : 0,
      }))
      .sort((a, b) => b.totalAmountKM - a.totalAmountKM)
      .slice(0, 8);

    res.json({
      totalAwards,
      totalAmountKM: totalAmount,
      avgDiscountPct: avgDiscount,
      topWinners,
    });
  } catch (error: any) {
    console.error("Greška u GET /api/history/stats:", error);
    res.status(500).json({ error: "Greška pri dohvatanju statistike historije", message: error.message });
  }
});
