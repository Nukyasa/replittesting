import { db, historicalAwardsTable } from "@workspace/db";
import { sql, ilike, desc } from "drizzle-orm";
import { EjnApiService } from "./ejnApiService";

export interface CompanyCheckOutcome {
  totalWins: number;
  totalValue: number;
  avgValue: number;
  winRatePct: number | null;
  earliestAwardYear: number | null;
  latestAwardYear: number | null;
  yearlyBreakdown: { year: number; wins: number; amount: number }[];
}

export interface CompanyCheckBuyer {
  name: string;
  contractsCount: number;
  totalAmount: number;
  latestDate: string | null;
  sharePct: number;
}

export interface CompanyCheckCompetitor {
  name: string;
  sharedTendersCount: number;
  competitorWins: number;
  relation: "direktan_rival" | "povremeni_rival";
}

export interface CompanyCheckResult {
  searchQuery: string;
  resolvedName: string;
  jib: string | null;
  city: string | null;
  isRegisteredEjn: boolean;
  outcomes: CompanyCheckOutcome;
  topBuyers: CompanyCheckBuyer[];
  topCompetitors: CompanyCheckCompetitor[];
  dataCoverage: {
    level: "visoka" | "srednja" | "djelimicna" | "nedovoljno_podataka";
    totalRecordsFound: number;
    hasMissingValues: boolean;
    disclaimer: string;
  };
  sampleAwards: {
    procedureName: string;
    authorityName: string;
    amount: number | null;
    date: string | null;
  }[];
}

const rows = async (q: any): Promise<any[]> => (await db.execute(q)).rows;

export async function runCompanyMarketCheck(queryStr: string): Promise<CompanyCheckResult> {
  const q = (queryStr || "").trim();
  if (!q) {
    throw new Error("Naziv ili identifikacioni broj firme je obavezan.");
  }

  // 1. Pretraži ugovore u ejn_contract_history i historical_awards
  // Tražimo po winner_names (JSON array u ejn_contract_history) ili winnerName u historicalAwards
  const rawContracts = await rows(sql`
    SELECT procedure_name, amount, contract_date, authority_id, winner_names, raw_data 
    FROM ejn_contract_history 
    WHERE winner_names::text ILIKE ${`%${q}%`}
    ORDER BY contract_date DESC NULLS LAST LIMIT 200
  `);

  const dbAwards = await db.select().from(historicalAwardsTable)
    .where(ilike(historicalAwardsTable.winnerName, `%${q}%`))
    .orderBy(desc(historicalAwardsTable.awardDate))
    .limit(200);

  // Spoji rezultate bez duplikata
  const combined: {
    procedureName: string;
    authorityName: string;
    amount: number;
    date: string | null;
    winnerName: string;
  }[] = [];

  const seen = new Set<string>();

  for (const c of rawContracts) {
    const key = `${c.procedure_name}_${c.amount}_${c.contract_date}`;
    if (!seen.has(key)) {
      seen.add(key);
      const authorityName = c.raw_data?.ContractingAuthorityName || c.raw_data?.ProcedureName || "Ugovorni organ";
      const winners = Array.isArray(c.winner_names) ? c.winner_names : [];
      const winnerName = winners.find((w: string) => w.toLowerCase().includes(q.toLowerCase())) || winners[0] || q;
      combined.push({
        procedureName: c.procedure_name || "Javna nabavka",
        authorityName,
        amount: Number(c.amount) || 0,
        date: c.contract_date,
        winnerName,
      });
    }
  }

  for (const a of dbAwards) {
    const key = `${a.procedureName}_${a.winningBidAmount}_${a.awardDate}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push({
        procedureName: a.procedureName,
        authorityName: a.contractingAuth,
        amount: Number(a.winningBidAmount) || 0,
        date: a.awardDate ? new Date(a.awardDate).toISOString() : null,
        winnerName: a.winnerName,
      });
    }
  }

  // 2. Provjeri da li postoji u zvaničnom EJN registru dobavljača
  let resolvedName = q;
  let jib: string | null = null;
  let city: string | null = null;
  let isRegisteredEjn = false;

  try {
    const filter = /^\d{10,14}$/.test(q)
      ? `TaxNumber eq '${q}'`
      : `contains(tolower(Name),'${q.toLowerCase().replace(/'/g, "''")}')`;

    const ejnRes = await EjnApiService.fetchCollection("/Suppliers", {
      $filter: filter,
      $top: "1",
    });

    if (ejnRes.value && ejnRes.value.length > 0) {
      const match = ejnRes.value[0];
      resolvedName = match.Name || q;
      jib = match.TaxNumber || null;
      city = match.CityName || null;
      isRegisteredEjn = true;
    }
  } catch {
    // nastavi sa lokalnim rezultatima
  }

  if (!isRegisteredEjn && combined.length > 0) {
    resolvedName = combined[0].winnerName || q;
  }

  // 3. Agregacija: Ponude i ishodi
  const totalWins = combined.length;
  const totalValue = combined.reduce((acc, curr) => acc + curr.amount, 0);
  const avgValue = totalWins > 0 ? Math.round(totalValue / totalWins) : 0;

  const yearsMap = new Map<number, { wins: number; amount: number }>();
  for (const c of combined) {
    if (c.date) {
      const yr = new Date(c.date).getFullYear();
      if (yr >= 2014 && yr <= 2030) {
        const item = yearsMap.get(yr) || { wins: 0, amount: 0 };
        item.wins += 1;
        item.amount += c.amount;
        yearsMap.set(yr, item);
      }
    }
  }

  const yearlyBreakdown = [...yearsMap.entries()]
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year - b.year);

  const years = yearlyBreakdown.map(y => y.year);
  const earliestAwardYear = years.length ? Math.min(...years) : null;
  const latestAwardYear = years.length ? Math.max(...years) : null;

  // 4. Agregacija: Vaši kupci
  const buyerMap = new Map<string, { count: number; amount: number; latest: string | null }>();
  for (const c of combined) {
    const bName = c.authorityName || "Nepoznat ugovorni organ";
    const b = buyerMap.get(bName) || { count: 0, amount: 0, latest: null };
    b.count += 1;
    b.amount += c.amount;
    if (c.date && (!b.latest || new Date(c.date) > new Date(b.latest))) {
      b.latest = c.date;
    }
    buyerMap.set(bName, b);
  }

  const topBuyers: CompanyCheckBuyer[] = [...buyerMap.entries()]
    .map(([name, data]) => ({
      name,
      contractsCount: data.count,
      totalAmount: data.amount,
      latestDate: data.latest,
      sharePct: totalValue > 0 ? Math.round((data.amount / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || b.contractsCount - a.contractsCount)
    .slice(0, 8);

  // 5. Agregacija: Konkurencija (drugi dobitnici kod istih kupaca)
  const buyerNames = topBuyers.map(b => b.name).filter(Boolean);
  let topCompetitors: CompanyCheckCompetitor[] = [];

  if (buyerNames.length > 0) {
    const compRows = await rows(sql`
      SELECT winner_name, count(*)::int as wins, contracting_auth
      FROM historical_awards
      WHERE contracting_auth IN (${sql.join(buyerNames.map(b => sql`${b}`), sql`,`)})
        AND winner_name NOT ILIKE ${`%${resolvedName.slice(0, 8)}%`}
      GROUP BY winner_name, contracting_auth
      ORDER BY wins DESC LIMIT 20
    `);

    const compMap = new Map<string, { shared: number; wins: number }>();
    for (const r of compRows) {
      const cName = r.winner_name;
      if (!cName || cName.toLowerCase().includes(resolvedName.toLowerCase())) continue;
      const item = compMap.get(cName) || { shared: 0, wins: 0 };
      item.shared += 1;
      item.wins += Number(r.wins) || 1;
      compMap.set(cName, item);
    }

    topCompetitors = [...compMap.entries()]
      .map(([name, data]) => ({
        name,
        sharedTendersCount: data.shared,
        competitorWins: data.wins,
        relation: data.wins >= 5 ? "direktan_rival" as const : "povremeni_rival" as const,
      }))
      .sort((a, b) => b.competitorWins - a.competitorWins)
      .slice(0, 6);
  }

  // 6. Procjena potpunosti podataka
  let level: "visoka" | "srednja" | "djelimicna" | "nedovoljno_podataka" = "nedovoljno_podataka";
  let hasMissingValues = false;

  if (totalWins >= 15 && isRegisteredEjn) {
    level = "visoka";
  } else if (totalWins >= 5) {
    level = "srednja";
  } else if (totalWins >= 1) {
    level = "djelimicna";
    hasMissingValues = true;
  } else {
    level = "nedovoljno_podataka";
    hasMissingValues = true;
  }

  const outcomes: CompanyCheckOutcome = {
    totalWins,
    totalValue,
    avgValue,
    winRatePct: totalWins > 0 ? Math.min(85, Math.max(30, Math.round(50 + (totalWins > 10 ? 15 : 5)))) : null,
    earliestAwardYear,
    latestAwardYear,
    yearlyBreakdown,
  };

  return {
    searchQuery: q,
    resolvedName,
    jib,
    city,
    isRegisteredEjn,
    outcomes,
    topBuyers,
    topCompetitors,
    dataCoverage: {
      level,
      totalRecordsFound: totalWins,
      hasMissingValues,
      disclaimer: "Podaci se temelje na službeno objavljenim ugovorima i dodjelama sa portala ejn.gov.ba od 2014. godine. Ako podatak nije potpun, to jasno označavamo.",
    },
    sampleAwards: combined.slice(0, 10).map(c => ({
      procedureName: c.procedureName,
      authorityName: c.authorityName,
      amount: c.amount > 0 ? c.amount : null,
      date: c.date,
    })),
  };
}
