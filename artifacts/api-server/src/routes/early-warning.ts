import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/auth";
import { fetchPlannedProcurements, type EjnPlannedProcurement } from "../services/ejnPublicApi";

export const earlyWarningRouter = Router();
earlyWarningRouter.use(authMiddleware);

function getQuarter(dateStr?: string): number {
  if (!dateStr) return 0;
  const month = new Date(dateStr).getMonth() + 1;
  return Math.ceil(month / 3);
}

function getYear(dateStr?: string): number {
  if (!dateStr) return new Date().getFullYear();
  return new Date(dateStr).getFullYear();
}

function mapProcedureType(type?: string): string {
  const map: Record<string, string> = {
    OpenProcedure: "Otvoreni postupak",
    CompetitiveRequest: "Zahtjev za ponude",
    DirectAgreement: "Direktni sporazum",
    RestrictedProcedure: "Ograničeni postupak",
    NegotiatedProcedure: "Pregovarački postupak",
    CompetitiveDialogue: "Kompetitivni dijalog",
  };
  return map[type || ""] || type || "—";
}

// GET /api/early-warning — Planirane nabavke iz EJN (Rano upozorenje)
earlyWarningRouter.get("/", async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const year = req.query.year ? Number(req.query.year) : undefined;
    const quarter = req.query.quarter ? Number(req.query.quarter) : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const skip = (page - 1) * limit;

    const { value: items, count } = await fetchPlannedProcurements({
      top: limit,
      skip,
      search: search || undefined,
      year,
      quarter,
    });

    const now = new Date();
    const currentYear = now.getFullYear();

    // Formatiraj i grupiraj po kvartalima
    const formatted = items.map((p: EjnPlannedProcurement) => {
      const startDate = p.EstimatedProcedureStartDate;
      const q = getQuarter(startDate);
      const y = getYear(startDate);
      const isPast = startDate ? new Date(startDate) < now : false;

      return {
        id: String(p.Id),
        name: p.Name || "—",
        contractType: p.ContractType || "",
        procedureType: mapProcedureType(p.ProcedureType),
        estimatedValue: p.EstimatedValue ? Number(p.EstimatedValue) : null,
        estimatedStartDate: startDate || null,
        year: y,
        quarter: q,
        quarterLabel: q ? `Q${q} ${y}` : `${y}`,
        isCurrentYear: y === currentYear,
        isPast,
        planId: p.ProcurementPlanId,
        planName: p.ProcurementPlanName || "",
        contractingAuthorityId: p.ContractingAuthorityId,
        contractingAuthority: p.ContractingAuthorityName || "—",
        city: p.ContractingAuthorityCityName || "",
        entity: p.ContractingAuthorityAdministrativeUnitName || "",
        cpvCode: p.MainCpvCodeName || "",
        fundingSource: p.FundingSourceName || "",
        ejnUrl: `https://www.ejn.gov.ba/PlannedProcurement/Search`,
      };
    });

    // Grupiraj po kvartalima
    const byQuarter: Record<string, typeof formatted> = {};
    for (const item of formatted) {
      const key = item.quarterLabel || "Nepoznat period";
      if (!byQuarter[key]) byQuarter[key] = [];
      byQuarter[key].push(item);
    }

    // KPI statistike
    const upcoming = formatted.filter(p => !p.isPast);
    const totalValue = upcoming.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

    res.json({
      data: formatted,
      byQuarter,
      kpis: {
        totalPlanned: count ?? items.length,
        upcomingCount: upcoming.length,
        totalEstimatedValue: totalValue,
        authorities: [...new Set(formatted.map(p => p.contractingAuthority))].length,
        currentQuarter: `Q${getQuarter(now.toISOString())} ${currentYear}`,
      },
      meta: {
        page,
        limit,
        total: count ?? items.length,
        pages: Math.ceil((count ?? items.length) / limit),
      },
      source: "ejn_openapi",
    });
  } catch (err: any) {
    console.error("Error in GET /api/early-warning:", err);
    res.status(500).json({ error: "Greška pri dohvatanju planiranih nabavki", message: err.message });
  }
});

// GET /api/early-warning/summary — Sažetak po kvartalima
earlyWarningRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const { value: items } = await fetchPlannedProcurements({ top: 200, year });

    const quarters = [1, 2, 3, 4].map(q => {
      const qItems = items.filter((p: EjnPlannedProcurement) => getQuarter(p.EstimatedProcedureStartDate) === q);
      const totalValue = qItems.reduce((sum, p) => sum + (Number(p.EstimatedValue) || 0), 0);
      return {
        quarter: q,
        label: `Q${q} ${year}`,
        count: qItems.length,
        totalEstimatedValue: totalValue,
        authorities: [...new Set(qItems.map((p: EjnPlannedProcurement) => p.ContractingAuthorityName))].length,
      };
    });

    res.json({ year, quarters, source: "ejn_openapi" });
  } catch (err: any) {
    console.error("Error in GET /api/early-warning/summary:", err);
    res.status(500).json({ error: "Greška pri dohvatanju sažetka", message: err.message });
  }
});
