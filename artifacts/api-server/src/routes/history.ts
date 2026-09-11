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

// GET /api/history/renewals — Prediktivni radar za obnovu ugovora konkurenata
historyRouter.get("/renewals", async (req: Request, res: Response) => {
  try {
    const checkCount = await db.select().from(historicalAwardsTable).limit(1);
    if (checkCount.length === 0) {
      await seedHistoryData();
    }

    const rows = await db.select().from(historicalAwardsTable);
    const now = new Date();

    const renewals = rows
      .map((r: any) => {
        const awardDate = new Date(r.awardDate);
        // Ako u nazivu stoji 2 ili 3 godine, trajanje je duže, inače standardno 12 mjeseci
        let durationMonths = 12;
        const lowerProc = (r.procedureName || "").toLowerCase();
        if (lowerProc.includes("3 godine") || lowerProc.includes("36 mjeseci")) durationMonths = 36;
        else if (lowerProc.includes("2 godine") || lowerProc.includes("24 mjeseca")) durationMonths = 24;

        const expiryDate = new Date(awardDate);
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

        const projectedNoticeDate = new Date(expiryDate);
        projectedNoticeDate.setDate(projectedNoticeDate.getDate() - 45); // Objava tendera obično 45 dana prije isteka starog

        const diffTime = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let urgency: "critical" | "high" | "medium" | "low" | "expired" = "low";
        if (daysUntilExpiry <= 0) {
          urgency = "expired";
        } else if (daysUntilExpiry <= 30) {
          urgency = "critical";
        } else if (daysUntilExpiry <= 60) {
          urgency = "high";
        } else if (daysUntilExpiry <= 120) {
          urgency = "medium";
        }

        const category = lowerProc.includes("tehničk") || lowerProc.includes("tehnick") || (r.cpvKod || "").startsWith("7163")
          ? "Tehnički pregled"
          : lowerProc.includes("kasko") || lowerProc.includes("vozil")
          ? "Osiguranje vozila (AO/Kasko)"
          : lowerProc.includes("imovin")
          ? "Osiguranje imovine"
          : "Nezgoda i lica";

        return {
          id: r.id,
          procedureName: r.procedureName,
          contractingAuth: r.contractingAuth,
          winnerName: r.winnerName,
          winningBidAmount: r.winningBidAmount,
          estimatedValue: r.estimatedValue || Math.round(r.winningBidAmount * 1.15),
          discountPct: r.discountPct || 13,
          awardDate: r.awardDate,
          expiryDate: expiryDate.toISOString().split("T")[0],
          projectedNoticeDate: projectedNoticeDate.toISOString().split("T")[0],
          daysUntilExpiry,
          urgency,
          category,
          ejnBroj: r.ejnBroj,
        };
      })
      .filter((r: any) => r.daysUntilExpiry >= -90) // Zanemari ugovore istekle prije više od 3 mjeseca
      .sort((a: any, b: any) => a.daysUntilExpiry - b.daysUntilExpiry);

    const urgentCount = renewals.filter((r: any) => r.urgency === "critical").length;
    const upcomingCount = renewals.filter((r: any) => r.urgency === "high" || r.urgency === "medium").length;
    const expiredCount = renewals.filter((r: any) => r.urgency === "expired").length;
    const totalPipelineKM = renewals.reduce((acc: number, r: any) => acc + r.winningBidAmount, 0);

    res.json({
      renewals,
      stats: {
        total: renewals.length,
        urgentCount,
        upcomingCount,
        expiredCount,
        totalPipelineKM,
      },
    });
  } catch (error: any) {
    console.error("Greška u GET /api/history/renewals:", error);
    res.status(500).json({ error: "Greška pri dohvatanju radara za obnovu", message: error.message });
  }
});

// GET /api/history/battlecards — Glava-uz-glavu analiza rivalskih osiguravajućih društava
historyRouter.get("/battlecards", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(historicalAwardsTable);
    
    // Taktike i profili konkurenata
    const competitorPlaybooks: Record<string, {
      aggressiveness: "Vrlo visoka" | "Visoka" | "Umjerena" | "Konzervativna";
      preferredSegments: string[];
      weakness: string;
      tacticalAdvice: string;
      complaintTendency: "Često se žali" | "Povremeno" | "Rijetko";
    }> = {
      "Euroherc osiguranje d.d.": {
        aggressiveness: "Vrlo visoka",
        preferredSegments: ["Kasko i AO vozni parkovi", "Javna komunalna preduzeća"],
        weakness: "Idu u agresivan damping na e-aukciji (-16% do -22%), ali često imaju propuste u potpunosti servisne mreže po kantonima.",
        tacticalAdvice: "Ne ulaziti u direktan rat cijenama ispod 15% marže. Insistirati na provjeri ispunjenosti uslova lokacije servisa.",
        complaintTendency: "Često se žali",
      },
      "Sarajevo Osiguranje d.d.": {
        aggressiveness: "Visoka",
        preferredSegments: ["Federalna ministarstva", "Vozni parkovi policije", "Veliki sistemi (Elektroprivreda)"],
        weakness: "Dugogodišnji status 'domaćeg' favorita stvara inertnost u pripremi alternativnih tehničkih specifikacija.",
        tacticalAdvice: "Iskoristiti prednost modernih digitalnih servisa i brze isplate šteta ASA Central. Pritisnuti na e-aukciji u zadnjem krugu.",
        complaintTendency: "Povremeno",
      },
      "Triglav Osiguranje d.d.": {
        aggressiveness: "Umjerena",
        preferredSegments: ["Kolektivno zdravstveno i nezgoda", "Imovina velikih industrijskih objekata"],
        weakness: "Rijetko spuštaju cijenu ispod -10% na e-aukciji. Vezani su za stroge korporativne tablice profitabilnosti.",
        tacticalAdvice: "Kada je Triglav jedini konkurent, umjereno agresivna ponuda (-11% do -13%) gotovo sigurno osigurava pobjedu.",
        complaintTendency: "Rijetko",
      },
      "Croatia osiguranje d.d.": {
        aggressiveness: "Visoka",
        preferredSegments: ["Hercegovački kantoni", "Elektroprenos", "Medicinske ustanove"],
        weakness: "Slabija koncentracija vlastitih stanica tehničkog pregleda u centralnoj Bosni.",
        tacticalAdvice: "Istaknuti integrisanu ponudu osiguranja i tehničkih pregleda na vlastitim stanicama ASA Central.",
        complaintTendency: "Povremeno",
      },
      "Wiener osiguranje VIG": {
        aggressiveness: "Konzervativna",
        preferredSegments: ["Imovinska osiguranja", "Kombinovana odgovornost"],
        weakness: "Spor proces odobravanja velikih flotnih popusta od strane centrale.",
        tacticalAdvice: "Iskoristiti brzinu odobravanja cijena ASA Central Uprave za tenderske rokove.",
        complaintTendency: "Rijetko",
      },
      "Adriatic osiguranje d.d.": {
        aggressiveness: "Visoka",
        preferredSegments: ["AO vozni parkovi", "Gradski saobraćaj"],
        weakness: "Fokus samo na cijenu, često bez dugoročnog servisa.",
        tacticalAdvice: "Ponuditi dodatne pakete asistencije na cesti i zamjenskih vozila.",
        complaintTendency: "Često se žali",
      },
    };

    // Agregacija iz stvarnih podataka
    const competitorMap = new Map<string, any>();

    for (const r of rows) {
      const name = r.winnerName || "Ostali";
      const existing = competitorMap.get(name) || {
        name,
        totalWonCount: 0,
        totalWonAmountKM: 0,
        discounts: [],
        authorities: new Set<string>(),
      };

      existing.totalWonCount += 1;
      existing.totalWonAmountKM += r.winningBidAmount || 0;
      if (r.discountPct) existing.discounts.push(r.discountPct);
      if (r.contractingAuth) existing.authorities.add(r.contractingAuth);
      competitorMap.set(name, existing);
    }

    const battlecards = Object.keys(competitorPlaybooks).map(name => {
      const stats = competitorMap.get(name) || {
        totalWonCount: 0,
        totalWonAmountKM: 0,
        discounts: [12],
        authorities: new Set(),
      };
      const playbook = competitorPlaybooks[name];

      const avgDiscount = stats.discounts.length > 0
        ? Math.round((stats.discounts.reduce((a: number, b: number) => a + b, 0) / stats.discounts.length) * 10) / 10
        : 12.5;

      return {
        competitorName: name,
        totalWonCount: stats.totalWonCount,
        totalWonAmountKM: stats.totalWonAmountKM,
        avgAuctionDiscountPct: avgDiscount,
        strongholds: Array.from(stats.authorities).slice(0, 4),
        ...playbook,
      };
    });

    res.json({ battlecards });
  } catch (error: any) {
    console.error("Greška u GET /api/history/battlecards:", error);
    res.status(500).json({ error: "Greška pri dohvatanju battlecards analize", message: error.message });
  }
});

