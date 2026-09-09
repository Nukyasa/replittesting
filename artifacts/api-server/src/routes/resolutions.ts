import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/auth";
import { fetchResolutions, type EjnResolution } from "../services/ejnPublicApi";
import { db, urzDecisionsTable } from "@workspace/db";
import { seedHistoryData } from "../services/historySeed";
import { ilike, or, desc } from "drizzle-orm";

export const resolutionsRouter = Router();
resolutionsRouter.use(authMiddleware);

// GET /api/resolutions — Lista rješenja URŽ iz baze i EJN API-ja
resolutionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const year = req.query.year ? Number(req.query.year) : undefined;
    const type = String(req.query.type || "all");
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    // Provjeri lokalne URŽ presedane iz baze
    const checkCount = await db.select().from(urzDecisionsTable).limit(1);
    if (checkCount.length === 0) {
      await seedHistoryData();
    }

    let localQuery = db.select().from(urzDecisionsTable);
    if (search) {
      localQuery = localQuery.where(
        or(
          ilike(urzDecisionsTable.caseNumber, `%${search}%`),
          ilike(urzDecisionsTable.procedureName, `%${search}%`),
          ilike(urzDecisionsTable.contractingAuth, `%${search}%`),
          ilike(urzDecisionsTable.appellant, `%${search}%`),
          ilike(urzDecisionsTable.sporniUslov, `%${search}%`),
          ilike(urzDecisionsTable.summary, `%${search}%`)
        )
      ) as any;
    }
    const localDecisions = await localQuery.orderBy(desc(urzDecisionsTable.decisionDate));

    const formattedLocal = localDecisions.map((d: any) => ({
      id: d.id,
      number: d.caseNumber,
      date: d.decisionDate.toISOString(),
      type: "URŽ Rješenje",
      procedureName: d.procedureName,
      procedureNumber: d.ejnBroj || d.caseNumber,
      procedureType: "Otvoreni postupak",
      contractingAuthority: d.contractingAuth,
      city: "Sarajevo",
      entity: "BiH",
      category: d.category,
      contractType: "Usluge",
      isAuctionOnline: true,
      awardCriterion: "Najniža cijena",
      hasLots: false,
      outcome: d.outcome,
      outcomeLabel: d.outcomeLabel,
      legalBasis: d.legalBasis,
      sporniUslov: d.sporniUslov,
      summary: d.summary,
      appellant: d.appellant,
      ejnUrl: "https://www.ejn.gov.ba",
    }));

    let items: EjnResolution[] = [];
    let count = 0;
    try {
      const ejnResult = await fetchResolutions({
        top: limit,
        skip,
        search: search || undefined,
        year,
        type: type !== "all" ? type : undefined,
      });
      items = ejnResult.value;
      count = ejnResult.count ?? 0;
    } catch (ejnErr) {
      console.warn("EJN fetchResolutions fallback to local decisions:", ejnErr);
    }

    // Formatiraj EJN podatke
    const formattedEjn = items.map((r: EjnResolution) => ({
      id: String(r.Id),
      number: r.Number || "",
      date: r.Date,
      type: r.Type || "Procedure",
      procedureId: r.ProcedureId,
      procedureName: r.ProcedureName || "—",
      procedureNumber: r.ProcedureNumber || "",
      procedureType: mapProcedureType(r.ProcedureType),
      contractingAuthorityId: r.ContractingAuthorityId,
      contractingAuthority: r.ContractingAuthorityName || "—",
      city: r.ContractingAuthorityCityName || "",
      entity: r.ContractingAuthorityAdministrativeUnitName || "",
      category: r.ContractCategoryName || "",
      contractType: r.ContractType || "",
      isAuctionOnline: !!r.IsAuctionOnline,
      awardCriterion: r.AwardCriterion || "",
      hasLots: !!r.HasLots,
      lastUpdated: r.LastUpdated,
      ejnUrl: r.ProcedureNumber
        ? `https://www.ejn.gov.ba/Announcement/Search?procedureNumber=${encodeURIComponent(r.ProcedureNumber)}`
        : "https://www.ejn.gov.ba/Announcement/Search",
    }));

    // Kombiniraj lokalne pravne presedane na vrhu
    const combined = [...formattedLocal, ...formattedEjn];
    const totalCount = count + formattedLocal.length;

    // Grupiraj statistiku po tipu
    const stats = {
      total: totalCount,
      byType: combined.reduce((acc: Record<string, number>, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json({
      data: combined,
      meta: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      stats,
      source: "urz_registry_and_ejn",
    });
  } catch (err: any) {
    console.error("Error in GET /api/resolutions:", err);
    res.status(500).json({ error: "Greška pri dohvatanju rješenja URŽ", message: err.message });
  }
});

// GET /api/resolutions/stats — Statistika rješenja
resolutionsRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const thisYear = new Date().getFullYear();
    const [current, previous] = await Promise.all([
      fetchResolutions({ top: 0, year: thisYear }),
      fetchResolutions({ top: 0, year: thisYear - 1 }),
    ]);

    res.json({
      thisYear: current.count ?? 0,
      lastYear: previous.count ?? 0,
      source: "ejn_openapi",
    });
  } catch (err: any) {
    console.error("Error in GET /api/resolutions/stats:", err);
    res.status(500).json({ error: "Greška pri dohvatanju statistike", message: err.message });
  }
});

// GET /api/resolutions/:id — Detalji jednog rješenja
resolutionsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Neispravan ID rješenja" });
      return;
    }

    // Dohvati konkretno rješenje po ID-u
    const { value: items } = await fetchResolutions({ top: 1, skip: 0 });
    // Filtriramo na osnovu ID-a — alternativno direktan filter ako API podržava
    const item = items.find((r: EjnResolution) => r.Id === id);

    if (!item) {
      res.status(404).json({ error: "Rješenje nije pronađeno" });
      return;
    }

    res.json({
      id: String(item.Id),
      number: item.Number,
      date: item.Date,
      type: item.Type,
      procedureName: item.ProcedureName,
      procedureNumber: item.ProcedureNumber,
      contractingAuthority: item.ContractingAuthorityName,
      category: item.ContractCategoryName,
      ejnUrl: item.ProcedureNumber
        ? `https://www.ejn.gov.ba/Announcement/Search?procedureNumber=${encodeURIComponent(item.ProcedureNumber)}`
        : "https://www.ejn.gov.ba/Resolution",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Greška pri dohvatanju rješenja", message: err.message });
  }
});

function mapProcedureType(type?: string): string {
  const map: Record<string, string> = {
    OpenProcedure: "Otvoreni postupak",
    CompetitiveRequest: "Zahtjev za ponude",
    DirectAgreement: "Direktni sporazum",
    RestrictedProcedure: "Ograničeni postupak",
    NegotiatedProcedure: "Pregovarački postupak",
    CompetitiveDialogue: "Kompetitivni dijalog",
    InnovationPartnership: "Partnerstvo za inovacije",
  };
  return map[type || ""] || type || "—";
}
