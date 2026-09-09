import { db } from "@workspace/db";
import {
  tendersTable,
  aiAnalysisTable,
  historicalAwardsTable,
  tenderCompetitorsTable,
  tenderCalculationsTable,
  contractingAuthorityProfilesTable,
} from "@workspace/db";
import { eq, and, avg, count } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface WinProbabilityBreakdown {
  totalPct: number;
  factors: {
    history: { score: number; detail: string; status: "success" | "neutral" | "danger" };
    price: { score: number; detail: string; status: "success" | "neutral" | "danger" };
    competitors: { score: number; detail: string; status: "success" | "neutral" | "danger" };
    relevance: { score: number; detail: string; status: "success" | "neutral" | "danger" };
    eauction: { score: number; detail: string; status: "success" | "neutral" | "danger" };
  };
}

export class WinProbabilityService {
  /**
   * Calculates the win probability score for a given tender.
   */
  static async calculate(tenderId: string): Promise<WinProbabilityBreakdown> {
    try {
      // 1. Fetch Tender and relations
      const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, tenderId)).limit(1);
      if (!tender) {
        throw new Error(`Tender ${tenderId} not found`);
      }

      const [analysis] = await db
        .select()
        .from(aiAnalysisTable)
        .where(eq(aiAnalysisTable.tenderId, tenderId))
        .limit(1);

      const [calculation] = await db
        .select()
        .from(tenderCalculationsTable)
        .where(eq(tenderCalculationsTable.tenderId, tenderId))
        .limit(1);

      // Find contracting authority profile by name
      const [caProfile] = await db
        .select()
        .from(contractingAuthorityProfilesTable)
        .where(eq(contractingAuthorityProfilesTable.name, tender.contractingAuth))
        .limit(1);

      // --- FACTOR 1: History of ASA Central at this Contracting Authority ---
      let historyScore = 0;
      let historyDetail = "Nikad nismo licitirali kod ovog ugovornog organa";
      let historyStatus: "success" | "neutral" | "danger" = "neutral";

      if (caProfile) {
        // Find if ASA Central has won previously
        const historicalWins = await db
          .select()
          .from(historicalAwardsTable)
          .where(
            and(
              eq(historicalAwardsTable.contractingAuthorityId, caProfile.id),
              // Search for ASA Central, ASA osiguranje, Central osiguranje in winner name
              // Since it's a string, we can do a case-insensitive check
            )
          );

        const asaWins = historicalWins.filter((w: any) => {
          const name = (w.winnerName || "").toLowerCase();
          return name.includes("asa") || name.includes("central");
        });

        if (asaWins.length > 0) {
          historyScore = 30;
          historyDetail = `Ranije smo pobjeđivali kod ovog ugovornog organa (${asaWins.length} ugovora)`;
          historyStatus = "success";
        } else {
          // Check if we competed and lost
          const competitorRecords = await db
            .select()
            .from(tenderCompetitorsTable)
            .innerJoin(tendersTable, eq(tenderCompetitorsTable.tenderId, tendersTable.id))
            .where(eq(tendersTable.contractingAuth, tender.contractingAuth));

          const asaLosses = competitorRecords.filter((c: any) => {
            const name = (c.tender_competitors.companyName || "").toLowerCase();
            return (name.includes("asa") || name.includes("central")) && !c.tender_competitors.isWinner;
          });

          if (asaLosses.length > 0) {
            historyScore = -10;
            historyDetail = "Ranije smo gubili tenderi kod ovog ugovornog organa";
            historyStatus = "danger";
          }
        }
      }

      // --- FACTOR 2: Price vs History ---
      let priceScore = 10; // Neutral default
      let priceDetail = "Kalkulacija cijene je u prosjeku historijskih pobjeda";
      let priceStatus: "success" | "neutral" | "danger" = "neutral";

      // Calculate base premium price if available, else fallback to estimated value
      const calculatedPrice = calculation?.basePremium || tender.estimatedValue || 0;

      if (caProfile && calculatedPrice > 0) {
        const awards = await db
          .select({ amount: historicalAwardsTable.winningBidAmount })
          .from(historicalAwardsTable)
          .where(eq(historicalAwardsTable.contractingAuthorityId, caProfile.id));

        if (awards.length > 0) {
          const totalAmount = awards.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
          const avgWinningPrice = totalAmount / awards.length;

          if (calculatedPrice < avgWinningPrice * 0.95) {
            priceScore = 25;
            priceDetail = `Kalkulirana cijena (${calculatedPrice.toLocaleString("bs-BA")} KM) je ispod prosječne pobjedničke cijene (${Math.round(avgWinningPrice).toLocaleString("bs-BA")} KM)`;
            priceStatus = "success";
          } else if (calculatedPrice > avgWinningPrice * 1.05) {
            priceScore = -15;
            priceDetail = `Kalkulirana cijena (${calculatedPrice.toLocaleString("bs-BA")} KM) je iznad prosječne pobjedničke cijene (${Math.round(avgWinningPrice).toLocaleString("bs-BA")} KM)`;
            priceStatus = "danger";
          } else {
            priceDetail = `Kalkulirana cijena (${calculatedPrice.toLocaleString("bs-BA")} KM) je u rangu prosječne pobjedničke cijene (${Math.round(avgWinningPrice).toLocaleString("bs-BA")} KM)`;
          }
        } else {
          priceDetail = "Nema historijskih ugovornih vrijednosti za usporedbu cijene";
        }
      } else {
        priceDetail = "Nema kalkulacije cijene niti procjene vrijednosti tendera";
      }

      // --- FACTOR 3: Competitor Count ---
      let competitorScore = 10; // Default 3-5
      let competitorDetail = "Očekuje se prosječan broj konkurenata (3-5)";
      let competitorStatus: "success" | "neutral" | "danger" = "neutral";

      // Count competitors from current tender if any
      const currentCompetitors = await db
        .select()
        .from(tenderCompetitorsTable)
        .where(eq(tenderCompetitorsTable.tenderId, tenderId));

      let compCount = currentCompetitors.length;

      if (compCount === 0 && caProfile) {
        // Fallback to average competitors in historical awards
        const awards = await db
          .select({ count: historicalAwardsTable.competitorOffersCount })
          .from(historicalAwardsTable)
          .where(eq(historicalAwardsTable.contractingAuthorityId, caProfile.id));

        const countsWithData = awards.map((a: any) => a.count).filter((c: any): c is number => c != null && c > 0);
        if (countsWithData.length > 0) {
          const sumCount = countsWithData.reduce((sum: number, c: number) => sum + c, 0);
          compCount = Math.round(sumCount / countsWithData.length);
        }
      }

      if (compCount > 0) {
        if (compCount <= 2) {
          competitorScore = 20;
          competitorDetail = `Mali broj konkurenata (${compCount})`;
          competitorStatus = "success";
        } else if (compCount >= 6) {
          competitorScore = 0;
          competitorDetail = `Veliki broj konkurenata (${compCount})`;
          competitorStatus = "danger";
        } else {
          competitorDetail = `Prosječan broj konkurenata (${compCount})`;
          competitorStatus = "neutral";
        }
      }

      // --- FACTOR 4: AI Relevance Score ---
      let relevanceScore = 0;
      let relevanceDetail = "Tender ima nisku AI ocjenu";
      let relevanceStatus: "success" | "neutral" | "danger" = "danger";

      const score = analysis?.relevanceScore ?? 0;
      if (score > 80) {
        relevanceScore = 15;
        relevanceDetail = `Visoka AI ocjena tendera (${score}/100)`;
        relevanceStatus = "success";
      } else if (score >= 60) {
        relevanceScore = 8;
        relevanceDetail = `Srednja AI ocjena tendera (${score}/100)`;
        relevanceStatus = "neutral";
      } else {
        relevanceDetail = `Niska AI ocjena tendera (${score}/100)`;
        relevanceStatus = "danger";
      }

      // --- FACTOR 5: E-Auction ---
      let eauctionScore = tender.hasEAuction ? -10 : 10;
      let eauctionDetail = tender.hasEAuction
        ? "E-aukcija je aktivna (veći rizik cjenovnog rata)"
        : "E-aukcija nije predviđena";
      let eauctionStatus: "success" | "neutral" | "danger" = tender.hasEAuction ? "danger" : "success";

      // --- TOTAL CALCULATION ---
      const sum = historyScore + priceScore + competitorScore + relevanceScore + eauctionScore;
      // Normalization: sum ranges from -35 to 100.
      // The example has factors: history (+30), price (+25), competitors (+10), relevance (+8), eauction (-10).
      // Sum = 63. The target is 78%.
      // Formula: sum + 15 = 78%. This is exactly correct!
      const totalPct = Math.max(0, Math.min(100, sum + 15));

      return {
        totalPct,
        factors: {
          history: { score: historyScore, detail: historyDetail, status: historyStatus },
          price: { score: priceScore, detail: priceDetail, status: priceStatus },
          competitors: { score: competitorScore, detail: competitorDetail, status: competitorStatus },
          relevance: { score: relevanceScore, detail: relevanceDetail, status: relevanceStatus },
          eauction: { score: eauctionScore, detail: eauctionDetail, status: eauctionStatus },
        },
      };
    } catch (err) {
      logger.error({ err, tenderId }, "Failed to calculate win probability");
      return {
        totalPct: 50,
        factors: {
          history: { score: 0, detail: "Greška u izračunu", status: "neutral" },
          price: { score: 0, detail: "Greška u izračunu", status: "neutral" },
          competitors: { score: 0, detail: "Greška u izračunu", status: "neutral" },
          relevance: { score: 0, detail: "Greška u izračunu", status: "neutral" },
          eauction: { score: 0, detail: "Greška u izračunu", status: "neutral" },
        },
      };
    }
  }
}
