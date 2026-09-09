import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { EjnApiService } from "./ejnApiService";
import { parseEjnDate, parseEjnAmount } from "./ejnIngestion";

type Row = Record<string, any>;
const rows = async (q: any): Promise<Row[]> => (await db.execute(q)).rows;
const active = new Set<number>();
const validId = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
export function authorityIdentity(tender: Row): number | null {
  const raw = tender.rawData || tender.raw_data || {};
  const id = raw.announcement?.ContractingAuthorityId ?? raw.ContractingAuthorityId;
  return validId(id) ? id : null;
}
export function procedureId(tender: Row): number | null {
  const raw = tender.rawData || tender.raw_data || {};
  const id = raw.announcement?.ProcedureId ?? raw.ProcedureId;
  return validId(id) ? id : null;
}
const cyr = "абвгдђежзијклљмнњопрстћуфхцчџш".split("");
const lat = ["a","b","v","g","d","đ","e","ž","z","i","j","k","l","lj","m","n","nj","o","p","r","s","t","ć","u","f","h","c","č","dž","š"];
function words(s: string) { return [...s.toLowerCase()].map(c => lat[cyr.indexOf(c)] ?? c).join(""); }
export function comparisonReason(tender: Row, contract: Row): string | null {
  const a = words(tender.title || ""), b = words(contract.procedure_name || "");
  for (const [pattern, label] of [[/zaposlen|radnik|kolektiv|djelatnik/, "Osiguranje zaposlenih"], [/vozil|kasko|automobil/, "Vozila / kasko"], [/imovin|objek/, "Imovina / objekti"], [/zdravstv/, "Zdravstveno osiguranje"]] as [RegExp,string][]) {
    if (pattern.test(a) && pattern.test(b) && /osigur|kasko|polic|insurance/.test(a) && /osigur|kasko|polic|insurance/.test(b)) return label + " — podudaranje pojmova u nazivu";
  }
  const tokens = [...new Set(a.match(/[a-zčćžšđ]{5,}/g) || [])].filter(t => !["nabavka","usluge","usluga","potrebe","godinu","godine"].includes(t));
  if (tokens.filter(t => b.includes(t)).length >= 2) return "Podudaranje najmanje dva pojma u nazivu";
  return null;
}
async function all(entity: string, filter: string) {
  const result: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const data = await EjnApiService.fetchCollection('/' + entity, { $filter: filter, $top: '100', $skip: String(page * 100), $orderby: 'Id asc' });
    result.push(...data.value);
    if (data.value.length < 100) return result;
  }
  throw new Error(`EJN ${entity}: lista je veća od dozvoljenog obuhvata; imena nisu potvrđena.`);
}
async function byIds(entity: string, field: string, ids: number[]) {
  const result: Row[] = [];
  const unique = [...new Set(ids.filter(validId))];
  for (let i = 0; i < unique.length; i += 20) result.push(...await all(entity, unique.slice(i, i + 20).map(id => `${field} eq ${id}`).join(' or ')));
  return result;
}
export async function resolveWinners(contracts: Row[], entity = 'LotContracts'): Promise<Map<number, string[]>> {
  let bases: Row[];
  if (entity === 'Awards') {
    // Award IDs are checked against actual lot records before following their awarded groups.
    const lots = await byIds('Lots', 'Id', contracts.map(c => c.Id));
    const validLots = lots.filter(l => contracts.some(c => c.Id === l.Id && c.ProcedureId === l.ProcedureId && c.ContractingAuthorityId === l.ContractingAuthorityId));
    const lotGroups = (await byIds('SupplierGroups', 'LotId', validLots.map(l => l.Id))).filter(g => g.IsAwarded === true);
    bases = lotGroups.map(g => ({ Id: g.LotId, SupplierGroupId: g.Id }));
  } else bases = await byIds('LotContractsBase', 'Id', contracts.map(c => c.Id));
  const groups = bases.map(b => b.SupplierGroupId);
  const reg = await byIds('SupplierGroupSupplierLinks', 'SupplierGroupId', groups);
  const unreg = await byIds('SupplierGroupUnregisteredSupplierLinks', 'SupplierGroupId', groups);
  const suppliers = await byIds('Suppliers', 'Id', reg.map(l => l.SupplierId));
  const unregistered = await byIds('UnregisteredSuppliers', 'Id', unreg.map(l => l.UnregisteredSupplierId));
  const names = new Map(suppliers.map(s => [s.Id, s.Name]));
  const unames = new Map(unregistered.map(s => [s.Id, s.Name]));
  const result = new Map<number,string[]>();
  for (const base of bases) result.set(base.Id, [...new Set([...(result.get(base.Id) || []),
    ...reg.filter(l => l.SupplierGroupId === base.SupplierGroupId).map(l => names.get(l.SupplierId)),
    ...unreg.filter(l => l.SupplierGroupId === base.SupplierGroupId).map(l => unames.get(l.UnregisteredSupplierId)),
  ].filter((s): s is string => typeof s === 'string' && !!s.trim()).map(s => s.trim()))]);
  return result;
}
async function persistContracts(contracts: Row[], entity: string, authorityId: number) {
  if (!contracts.length) return;
  const winners = await resolveWinners(contracts, entity);
  await db.transaction(async (tx: any) => {
    for (const c of contracts) {
      await tx.execute(sql`INSERT INTO ejn_contract_history(contract_id,source_entity,authority_id,procedure_id,procedure_name,procedure_number,winner_names,amount,contract_date,raw_data)
        VALUES(${c.Id},${entity},${authorityId},${validId(c.ProcedureId) ? c.ProcedureId : null},${c.ProcedureName || ''},${c.ProcedureNumber || null},${JSON.stringify(winners.get(c.Id) || [])}::jsonb,${parseEjnAmount(c.Value)},${parseEjnDate(c.ContractDate)?.toISOString() || null},${JSON.stringify(c)}::jsonb)
        ON CONFLICT(contract_id,source_entity) DO UPDATE SET procedure_name=excluded.procedure_name,procedure_number=excluded.procedure_number,winner_names=excluded.winner_names,
        amount=excluded.amount,contract_date=excluded.contract_date,raw_data=excluded.raw_data,fetched_at=now()`);
    }
  });
}

/** Fetch relevant insurance awards first so users do not wait for the full authority archive. */
export async function syncRelevantHistory(tender: Row) {
  const authorityId = authorityIdentity(tender);
  if (!authorityId) return;
  const title = words(tender.title || '');
  const terms = /osigur|kasko|polic|insurance/.test(title)
    ? ['osigur', 'kasko', 'polic', 'insurance', 'осигура', 'каско']
    : [...new Set(title.match(/[a-zčćžšđ]{6,}/g) || [])].filter(t => !['nabavka','usluge','usluga','potrebe'].includes(t)).slice(0,3);
  if (!terms.length) return;
  const filter = `ContractingAuthorityId eq ${authorityId} and (${terms.map(t => `contains(tolower(ProcedureName),'${t.replace(/'/g,"''")}')`).join(' or ')})`;
  const contracts: Row[] = [];
  for (let page=0; page<3; page++) {
    const data = await EjnApiService.fetchCollection('/Awards', { $filter: filter, $orderby: 'Id desc', $top: '100', $skip: String(page*100) });
    contracts.push(...data.value);
    if (data.value.length < 100) break;
  }
  if (contracts.some(c => c.ContractingAuthorityId !== authorityId)) throw new Error('EJN je vratio dodjelu drugog naručioca.');
  await persistContracts(contracts, 'Awards', authorityId);
}

export async function syncAuthorityHistory(authorityId: number, lockHeld = false) {
  if (!validId(authorityId)) throw new Error('Nije potvrđen EJN identifikator naručioca.');
  if (active.has(authorityId) && !lockHeld) return;
  if (!lockHeld) active.add(authorityId);
  try {
    const [old] = await rows(sql`SELECT * FROM ejn_history_sync WHERE authority_id=${authorityId}`);
    await db.execute(sql`INSERT INTO ejn_history_sync(authority_id,status,last_run) VALUES(${authorityId},'running',now())
      ON CONFLICT(authority_id) DO UPDATE SET status='running',last_run=now(),error=NULL`);
    for (const entity of ['Awards','LotContracts']) {
    let before: number | null = old?.has_more ? entity === 'Awards' ? old.before_award_id : old.before_id : null;
    if (old?.has_more && (entity === 'Awards' ? old.awards_more === false : old.lots_more === false)) continue;
    for (let page = 0; page < 3; page++) {
      const filter = `ContractingAuthorityId eq ${authorityId}` + (before ? ` and Id lt ${before}` : '');
      const { value } = await EjnApiService.fetchCollection('/'+entity, { $filter: filter, $orderby: 'Id desc', $top: '50' });
      if (value.some(c => !validId(c.Id) || c.ContractingAuthorityId !== authorityId)) throw new Error('EJN je vratio neispravan identitet ugovora.');
      const winners = await resolveWinners(value,entity);
      const more = value.length === 50;
      before = value.length ? Math.min(...value.map(c => c.Id)) : before;
      await db.transaction(async (tx: any) => {
        for (const c of value) {
          await tx.execute(sql`INSERT INTO ejn_contract_history(contract_id,source_entity,authority_id,procedure_id,procedure_name,procedure_number,winner_names,amount,contract_date,raw_data)
            VALUES(${c.Id},${entity},${authorityId},${validId(c.ProcedureId) ? c.ProcedureId : null},${c.ProcedureName || ''},${c.ProcedureNumber || null},${JSON.stringify(winners.get(c.Id) || [])}::jsonb,${parseEjnAmount(c.Value)},${parseEjnDate(c.ContractDate)?.toISOString() || null},${JSON.stringify(c)}::jsonb)
            ON CONFLICT(contract_id,source_entity) DO UPDATE SET procedure_name=excluded.procedure_name,procedure_number=excluded.procedure_number,winner_names=excluded.winner_names,
            amount=excluded.amount,contract_date=excluded.contract_date,raw_data=excluded.raw_data,fetched_at=now()`);
        }
        if (entity === 'Awards') await tx.execute(sql`UPDATE ejn_history_sync SET before_award_id=${before},awards_more=${more},last_run=now(),error=NULL WHERE authority_id=${authorityId}`);
        else await tx.execute(sql`UPDATE ejn_history_sync SET before_id=${before},lots_more=${more},last_run=now(),error=NULL WHERE authority_id=${authorityId}`);
        await tx.execute(sql`UPDATE ejn_history_sync SET has_more=lots_more OR awards_more,status=CASE WHEN lots_more OR awards_more THEN 'partial' ELSE 'completed' END WHERE authority_id=${authorityId}`);
      });
      if (!more) break;
    }
    }
  } catch (error) {
    await db.execute(sql`UPDATE ejn_history_sync SET status='failed',error=${error instanceof Error ? error.message : String(error)},last_run=now() WHERE authority_id=${authorityId}`);
    throw error;
  } finally { active.delete(authorityId); }
}
export function historyRunning(authorityId: number) { return active.has(authorityId); }
export function queueHistory(authorityId: number, tender?: Row) {
  if (active.size >= 2 || active.has(authorityId)) return false;
  active.add(authorityId);
  void (async () => {
    try { if (tender) await syncRelevantHistory(tender); } catch { /* Full cursor sync still runs. */ }
    await syncAuthorityHistory(authorityId, true);
  })().catch(() => { active.delete(authorityId); /* Persisted in ejn_history_sync for the UI and retry. */ });
  return true;
}
export async function getTenderHistory(tender: Row) {
  const authorityId = authorityIdentity(tender);
  if (!authorityId) return { authorityId: null, status: 'unavailable', message: 'Nije potvrđen EJN identifikator naručioca. Historija se ne povezuje samo po sličnom nazivu.', current: [], previous: [], other: [] };
  const [state] = await rows(sql`SELECT * FROM ejn_history_sync WHERE authority_id=${authorityId}`);
  if (!state || state.status === 'running' || (!state.has_more && state.last_run && Date.now() - new Date(state.last_run).getTime() > 7 * 86400000)) queueHistory(authorityId, tender);
  const contracts = await rows(sql`SELECT * FROM ejn_contract_history WHERE authority_id=${authorityId} ORDER BY contract_date DESC NULLS LAST,contract_id DESC`);
  const pid = procedureId(tender);
  const published = new Date(tender.publicationDate || tender.publication_date).getTime();
  const current: Row[] = [], previous: Row[] = [], other: Row[] = [];
  for (const c of contracts) {
    const entity = c.source_entity === 'Awards' ? 'Awards' : 'LotContracts';
    const item = { ...c, raw_data: undefined, sourceUrl: `https://open.ejn.gov.ba/${entity}?$filter=Id%20eq%20${c.contract_id}`, winnerSourceUrl: entity === 'Awards' ? `https://open.ejn.gov.ba/SupplierGroups?$filter=LotId%20eq%20${c.contract_id}%20and%20IsAwarded%20eq%20true` : `https://open.ejn.gov.ba/LotContractsBase?$filter=Id%20eq%20${c.contract_id}` };
    if (pid && c.procedure_id === pid) { current.push(item); continue; }
    if (!c.contract_date || !Number.isFinite(published) || new Date(c.contract_date).getTime() >= published) continue;
    const reason = comparisonReason(tender, c);
    (reason ? previous : other).push({ ...item, matchReason: reason || 'Isti naručilac; sličnost predmeta nije potvrđena' });
  }
  const amounts = contracts.map(item => Number(item.amount)).filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const winnerCounts = new Map<string, number>();
  let knownWinnerRecords = 0;
  for (const contract of contracts) {
    const winners = Array.isArray(contract.winner_names) ? contract.winner_names.filter((name: unknown): name is string => typeof name === 'string' && !!name.trim()) : [];
    if (winners.length) knownWinnerRecords++;
    for (const name of winners) winnerCounts.set(name, (winnerCounts.get(name) || 0) + 1);
  }
  const leadingWinner = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'bs'))[0] || null;
  const coverage = contracts.length ? Math.round(100 * Math.min(knownWinnerRecords / contracts.length, amounts.length / contracts.length)) : 0;
  const confidence = contracts.length >= 30 && coverage >= 70 ? 'high' : contracts.length >= 10 && coverage >= 45 ? 'medium' : 'low';
  const intelligence = {
    contractRecords: contracts.length, knownWinnerRecords, amountRecords: amounts.length,
    amountRange: amounts.length ? { min: amounts[0], median: amounts[Math.floor(amounts.length / 2)], max: amounts[amounts.length - 1] } : null,
    leadingWinner: leadingWinner ? { name: leadingWinner[0], records: leadingWinner[1], sharePct: Math.round(100 * leadingWinner[1] / Math.max(1, knownWinnerRecords)) } : null,
    confidence, coveragePct: coverage,
    oneBidderRate: null, directAgreementShare: null,
    unavailable: ['Broj ponuda i udio direktnih sporazuma nisu izračunati jer nisu potvrđeni u trenutno preuzetim EJN zapisima.'],
  };
  return { authorityId, ...state, status: historyRunning(authorityId) ? 'running' : state?.status || 'pending', count: contracts.length, current, previous, other, intelligence };
}
let batchRunning = false;
export async function syncHistoryBatch() {
  if (batchRunning) return;
  batchRunning = true;
  try {
  const candidates = await rows(sql`SELECT DISTINCT COALESCE(raw_data->'announcement'->>'ContractingAuthorityId',raw_data->>'ContractingAuthorityId') AS authority
    FROM tenders WHERE source IN ('ejn','ejn_openapi') AND status='open'`);
  const states = await rows(sql`SELECT * FROM ejn_history_sync`);
  const map = new Map(states.map(s => [s.authority_id, s]));
  const ids = candidates.map(c => Number(c.authority)).filter(validId).sort((a,b) => new Date(map.get(a)?.last_run || 0).getTime() - new Date(map.get(b)?.last_run || 0).getTime());
  let processed = 0;
  for (const id of ids) {
    const state = map.get(id);
    if (active.has(id) || (state?.last_run && !state.has_more && Date.now() - new Date(state.last_run).getTime() < 7 * 86400000)) continue;
    try { await syncAuthorityHistory(id); } catch { /* retry in next batch */ }
    if (++processed >= 3) break;
  }
  } finally { batchRunning = false; }
}
