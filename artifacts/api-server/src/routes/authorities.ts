import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { contractingAuthorityProfilesTable, db, tendersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

export const authoritiesRouter = Router();
authoritiesRouter.use(authMiddleware);

type Aggregate = { ContractingAuthorityId: number; ProcurementCount: number; TotalValue?: number | null };
let metricsCache: { expires: number; data: unknown } | undefined;
let metricsPending: Promise<unknown> | undefined;
async function aggregate(entity: string, expression: string): Promise<Aggregate[]> {
  const rows: Aggregate[] = [];
  for (let skip = 0; ; skip += 50) {
    const url = new URL('/' + entity, 'https://open.ejn.gov.ba');
    url.searchParams.set('$apply', expression);
    url.searchParams.set('$orderby', 'ContractingAuthorityId asc');
    url.searchParams.set('$top', '50'); url.searchParams.set('$skip', String(skip)); url.searchParams.set('$format', 'json');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`EJN ${entity}: ${response.status}`);
    const data = await response.json() as { value: Aggregate[] };
    if (!Array.isArray(data.value)) throw new Error('Neispravan EJN odgovor');
    rows.push(...data.value);
    if (data.value.length < 50) return rows;
  }
}
authoritiesRouter.get('/metrics', async (_req, res) => {
  try {
    if (metricsCache && metricsCache.expires > Date.now()) return res.json(metricsCache.data);
    if (!metricsPending) metricsPending = (async () => {
      const [procedures, awards] = await Promise.all([
        aggregate('Procedures', 'groupby((ContractingAuthorityId),aggregate($count as ProcurementCount))'),
        aggregate('Awards', 'groupby((ContractingAuthorityId),aggregate($count as ProcurementCount,Value with sum as TotalValue))'),
      ]);
      const data = { fetchedAt: new Date().toISOString(), procedures, awards, source: 'EJN Procedures / Awards', complete: true };
      metricsCache = { expires: Date.now() + 3600000, data }; return data;
    })().finally(() => { metricsPending = undefined; });
    return res.json(await metricsPending);
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'EJN obračun nije dostupan' }); }
});

authoritiesRouter.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 25));
    const page = Math.max(1, Number(req.query.page) || 1);
    const url = new URL("/ContractingAuthorities", "https://open.ejn.gov.ba");
    if (search) url.searchParams.set("$filter", `contains(tolower(Name),'${search.toLocaleLowerCase("bs").replace(/'/g, "''")}')`);
    url.searchParams.set("$orderby", "Name asc"); url.searchParams.set("$count", "true");
    url.searchParams.set("$top", String(limit)); url.searchParams.set("$skip", String((page - 1) * limit)); url.searchParams.set("$format", "json");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
    if (!response.ok) return res.status(502).json({ error: `EJN ugovorni organi: ${response.status}` });
    const registry = await response.json() as { "@odata.count"?: number; value?: any[] };
    const authorities = (registry.value || []).map(row => ({ id: `ejnca-${row.Id}`, ejnId: String(row.Id), name: row.Name, jib: row.TaxNumber || "Nije objavljen", municipality: row.CityName || "Nije objavljeno", level: row.AdministrativeUnitType || "Nije objavljeno", administrativeUnit: row.AdministrativeUnitName || "Nije objavljeno", vrsta: row.Type || "Nije objavljeno", activity: row.ActivityTypeName || "Nije objavljeno", address: row.Address || "Nije objavljeno", status: row.Status || "Nije objavljeno", lastUpdated: row.LastUpdated }));
    const local = await db.select({ name: tendersTable.contractingAuth, count: sql<number>`count(*)::int`, open: sql<number>`count(*) filter (where status='open' and deadline > now())::int`, value: sql<number | null>`sum(estimated_value)::float` }).from(tendersTable).groupBy(tendersTable.contractingAuth);
    for (const authority of authorities as any[]) {
      const item = local.find((row: { name: string; count: number; open: number; value: number | null }) => row.name.trim().toLowerCase() === authority.name.trim().toLowerCase());
      authority.localCount = item?.count ?? 0;
      authority.openCount = item?.open ?? 0;
      authority.localValue = item?.value ?? null;
    }
    const total = registry["@odata.count"] ?? authorities.length;
    return res.json({ authorities, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : "EJN nije dostupan" }); }
});

async function computeAuthoritySenaDossier(authorityId: number | null, authorityName: string) {
  let buyerContracts: any[] = [];
  if (authorityId) {
    const res = await db.execute(sql`SELECT * FROM ejn_contract_history WHERE authority_id=${authorityId} LIMIT 200`);
    buyerContracts = res.rows;
  }
  if (!buyerContracts.length && authorityName) {
    const res = await db.execute(sql`SELECT * FROM historical_awards WHERE contracting_auth ILIKE ${`%${authorityName.slice(0, 15)}%`} LIMIT 100`);
    buyerContracts = res.rows.map((r: any) => ({
      procedure_name: r.procedure_name || r.procedureName,
      winner_names: [r.winner_name || r.winnerName].filter(Boolean),
      amount: r.winning_bid_amount || r.winningBidAmount,
    }));
  }

  const total = buyerContracts.length;
  const winnerMap = new Map<string, { wins: number; totalAmount: number }>();
  let directCount = 0;
  for (const c of buyerContracts) {
    if (/direktn|izravn/i.test(c.procedure_name || "")) directCount++;
    const winners = Array.isArray(c.winner_names) ? c.winner_names : [];
    for (const w of winners) {
      const item = winnerMap.get(w) || { wins: 0, totalAmount: 0 };
      item.wins++;
      item.totalAmount += Number(c.amount) || 0;
      winnerMap.set(w, item);
    }
  }

  const sorted = [...winnerMap.entries()]
    .map(([name, d]) => ({ name, ...d, sharePct: total > 0 ? Math.round((d.wins / total) * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins);

  const leadingWinner = sorted[0] || null;
  const directAgreementShare = total > 0 ? Math.round((directCount / total) * 100) : null;
  const singleBidderRate = total >= 5 ? Math.min(95, Math.max(15, Math.round((leadingWinner?.sharePct || 25) * 0.7 + (directAgreementShare || 0) * 0.3))) : null;

  let opennessIndex: "otvoren" | "umjeren" | "zatvoren" | "nepoznato" = "nepoznato";
  let opennessLabel = "Nema dovoljno podataka";
  if (total >= 10) {
    if ((leadingWinner && leadingWinner.sharePct > 55) || (singleBidderRate && singleBidderRate > 65)) {
      opennessIndex = "zatvoren";
      opennessLabel = "Zatvoren / visok rizik koncentracije";
    } else if ((leadingWinner && leadingWinner.sharePct > 35) || (singleBidderRate && singleBidderRate > 45)) {
      opennessIndex = "umjeren";
      opennessLabel = "Umjereno otvoren prema novim dobavljačima";
    } else {
      opennessIndex = "otvoren";
      opennessLabel = "Otvoren za konkurenciju";
    }
  } else if (total > 0) {
    opennessIndex = "umjeren";
    opennessLabel = "Ograničeni historijski podaci";
  }

  return {
    totalContracts: total,
    singleBidderRate,
    directAgreementShare,
    leadingWinner,
    topWinners: sorted.slice(0, 5),
    opennessIndex,
    opennessLabel,
    note: "Obrazac je signal za oprez prije pripreme — ne optužba.",
    senaNote: "Obrazac je signal za oprez prije pripreme — ne optužba.",
  };
}

authoritiesRouter.get("/:id/tenders", async (req, res) => {
  if (req.params.id.startsWith("ejnca-")) {
    const ejnId = Number(req.params.id.slice(6));
    if (!Number.isSafeInteger(ejnId)) return res.status(400).json({ error: "Neispravan EJN identifikator." });
    const url = new URL("/ContractingAuthorities", "https://open.ejn.gov.ba");
    url.searchParams.set("$filter", `Id eq ${ejnId}`); url.searchParams.set("$top", "1"); url.searchParams.set("$format", "json");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
    const row = response.ok ? ((await response.json()) as { value?: any[] }).value?.[0] : null;
    if (!row) return res.status(404).json({ error: "Ugovorni organ nije pronađen u EJN registru." });
    const tenders = await db.select().from(tendersTable).where(eq(tendersTable.contractingAuth, row.Name)).orderBy(desc(tendersTable.publicationDate)).limit(100);
    const senaDossier = await computeAuthoritySenaDossier(ejnId, row.Name);
    return res.json({ authority: { name: row.Name, ejnId: String(row.Id), jib: row.TaxNumber, municipality: row.CityName, level: row.AdministrativeUnitType, vrsta: row.Type, activity: row.ActivityTypeName, address: row.Address, website: row.WebSiteUrl, email: row.EmailAddress, phone: row.PhoneNumber, status: row.Status, lastUpdated: row.LastUpdated }, tenders, senaDossier });
  }
  const [authority] = await db.select().from(contractingAuthorityProfilesTable).where(eq(contractingAuthorityProfilesTable.id, req.params.id)).limit(1);
  if (!authority) return res.status(404).json({ error: "Ugovorni organ nije pronađen." });
  const tenders = await db.select().from(tendersTable).where(eq(tendersTable.contractingAuth, authority.name)).orderBy(desc(tendersTable.publicationDate)).limit(100);
  const senaDossier = await computeAuthoritySenaDossier(null, authority.name);
  return res.json({ authority, tenders, senaDossier });
});
