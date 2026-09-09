/**
 * ejnPublicApi.ts — Centralni client za javni EJN Open API
 * Koristi open.ejn.gov.ba (isti kao sena.ba)
 * Ima in-memory cache, retry logiku i filtere za osiguranje
 */

const EJN_BASE = "https://open.ejn.gov.ba";

// In-memory cache
const cache = new Map<string, { data: any; expiresAt: number }>();

function cacheGet(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key: string, data: any, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ejnFetch(path: string, params: Record<string, string> = {}, ttlMs = 10 * 60 * 1000): Promise<any> {
  const url = new URL(path, EJN_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`EJN HTTP ${res.status} za ${path}`);
      const json = await res.json();
      cacheSet(cacheKey, json, ttlMs);
      return json;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await delay(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSURANCE FILTERS (CPV 66xxx + ključne riječi)
// ─────────────────────────────────────────────────────────────────────────────

const INSURANCE_FILTER_PROCEDURE =
  "contains(tolower(ContractCategoryName),'osiguranj') or " +
  "contains(tolower(ProcedureName),'osiguranj') or " +
  "contains(tolower(ContractCategoryName),'insuranc') or " +
  "contains(tolower(ProcedureName),'kasko')";

const INSURANCE_FILTER_NAME =
  "contains(tolower(Name),'osiguranj') or " +
  "contains(tolower(Name),'kasko') or " +
  "contains(tolower(MainCpvCodeName),'osiguranj')";

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUTIONS — Rješenja URŽ
// ─────────────────────────────────────────────────────────────────────────────

export interface EjnResolution {
  Id: number;
  Number: string;
  Date: string;
  Type: string;
  ProcedureId?: number;
  ProcedureName?: string;
  ProcedureNumber?: string;
  ProcedureType?: string;
  ContractingAuthorityId?: number;
  ContractingAuthorityName?: string;
  ContractingAuthorityCityName?: string;
  ContractingAuthorityAdministrativeUnitName?: string;
  ContractCategoryName?: string;
  ContractType?: string;
  IsAuctionOnline?: boolean;
  AwardCriterion?: string;
  HasLots?: boolean;
  LastUpdated?: string;
}

export async function fetchResolutions(options: {
  top?: number;
  skip?: number;
  filter?: string;
  search?: string;
  year?: number;
  type?: string;
} = {}): Promise<{ value: EjnResolution[]; count?: number }> {
  const filters: string[] = [];

  // Insurance filter by default
  filters.push(`(${INSURANCE_FILTER_PROCEDURE})`);

  if (options.year) {
    const start = `${options.year}-01-01T00:00:00Z`;
    const end = `${options.year + 1}-01-01T00:00:00Z`;
    filters.push(`Date ge ${start} and Date lt ${end}`);
  }

  if (options.type && options.type !== "all") {
    filters.push(`tolower(Type) eq '${options.type.toLowerCase()}'`);
  }

  if (options.search) {
    const s = options.search.toLowerCase().replace(/'/g, "''");
    filters.push(
      `(contains(tolower(ProcedureName),'${s}') or contains(tolower(ContractingAuthorityName),'${s}') or contains(tolower(Number),'${s}'))`
    );
  }

  const params: Record<string, string> = {
    "$top": String(options.top ?? 50),
    "$skip": String(options.skip ?? 0),
    "$orderby": "Id desc",
    "$filter": filters.join(" and "),
    "$count": "true",
  };

  const data = await ejnFetch("/Resolutions", params, 10 * 60 * 1000);
  return { value: data.value ?? [], count: data["@odata.count"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANNED PROCUREMENTS — Planirane nabavke (Rano upozorenje)
// ─────────────────────────────────────────────────────────────────────────────

export interface EjnPlannedProcurement {
  Id: number;
  Name: string;
  ContractType?: string;
  ProcedureType?: string;
  EstimatedValue?: number;
  EstimatedProcedureStartDate?: string;
  ProcurementPlanId?: number;
  ProcurementPlanName?: string;
  ContractingAuthorityId?: number;
  ContractingAuthorityName?: string;
  ContractingAuthorityCityName?: string;
  ContractingAuthorityAdministrativeUnitName?: string;
  MainCpvCodeName?: string;
  MainCpvCodeId?: number;
  FundingSourceName?: string;
  IsAbandoned?: boolean;
  OrdinalNumber?: number;
  LastUpdated?: string;
}

export async function fetchPlannedProcurements(options: {
  top?: number;
  skip?: number;
  year?: number;
  quarter?: number;
  search?: string;
  authorityId?: number;
} = {}): Promise<{ value: EjnPlannedProcurement[]; count?: number }> {
  const filters: string[] = [];

  // Insurance filter
  filters.push(`(${INSURANCE_FILTER_NAME})`);

  // Not abandoned
  filters.push("IsAbandoned eq false");

  if (options.year) {
    const y = options.year;
    if (options.quarter) {
      const qStart = [(y + "-01-01"), (y + "-04-01"), (y + "-07-01"), (y + "-10-01")][options.quarter - 1];
      const qEnd = [(y + "-04-01"), (y + "-07-01"), (y + "-10-01"), ((y + 1) + "-01-01")][options.quarter - 1];
      filters.push(`EstimatedProcedureStartDate ge ${qStart}T00:00:00Z and EstimatedProcedureStartDate lt ${qEnd}T00:00:00Z`);
    } else {
      filters.push(`EstimatedProcedureStartDate ge ${y}-01-01T00:00:00Z and EstimatedProcedureStartDate lt ${y + 1}-01-01T00:00:00Z`);
    }
  } else {
    // Default: this year and next
    const now = new Date();
    const from = `${now.getFullYear()}-01-01T00:00:00Z`;
    const to = `${now.getFullYear() + 2}-01-01T00:00:00Z`;
    filters.push(`EstimatedProcedureStartDate ge ${from} and EstimatedProcedureStartDate lt ${to}`);
  }

  if (options.search) {
    const s = options.search.toLowerCase().replace(/'/g, "''");
    filters.push(`(contains(tolower(Name),'${s}') or contains(tolower(ContractingAuthorityName),'${s}'))`);
  }

  if (options.authorityId) {
    filters.push(`ContractingAuthorityId eq ${options.authorityId}`);
  }

  const params: Record<string, string> = {
    "$top": String(options.top ?? 100),
    "$skip": String(options.skip ?? 0),
    "$orderby": "EstimatedProcedureStartDate asc",
    "$filter": filters.join(" and "),
    "$count": "true",
  };

  const data = await ejnFetch("/PlannedProcurements", params, 15 * 60 * 1000);
  return { value: data.value ?? [], count: data["@odata.count"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIERS — Dobavljači iz EJN registra
// ─────────────────────────────────────────────────────────────────────────────

export interface EjnSupplier {
  Id: number;
  Name: string;
  TaxNumber?: string;
  CityName?: string;
  CountryName?: string;
  ActivityTypeName?: string;
  SupplierGroupId?: number;
  SupplierGroupName?: string;
  LastUpdated?: string;
}

export async function fetchSuppliers(options: {
  top?: number;
  skip?: number;
  search?: string;
} = {}): Promise<{ value: EjnSupplier[]; count?: number }> {
  const filters: string[] = [];

  if (options.search) {
    const s = options.search.toLowerCase().replace(/'/g, "''");
    filters.push(`contains(tolower(Name),'${s}')`);
  } else {
    // Default: insurance-related suppliers
    filters.push(
      "(contains(tolower(Name),'osiguranj') or contains(tolower(Name),'insurance') or " +
      "contains(tolower(ActivityTypeName),'osiguranj'))"
    );
  }

  const params: Record<string, string> = {
    "$top": String(options.top ?? 50),
    "$skip": String(options.skip ?? 0),
    "$orderby": "Name asc",
    "$count": "true",
  };

  if (filters.length) params["$filter"] = filters.join(" and ");

  const data = await ejnFetch("/Suppliers", params, 20 * 60 * 1000);
  return { value: data.value ?? [], count: data["@odata.count"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// AWARDS / LOT CONTRACTS — Dodjele ugovora za tender detalj
// ─────────────────────────────────────────────────────────────────────────────

export interface EjnAward {
  Id: number;
  ProcedureId?: number;
  ProcedureName?: string;
  ProcedureNumber?: string;
  ContractingAuthorityName?: string;
  Value?: number;
  ContractDate?: string;
  NumberOfReceivedOffers?: number;
  NumberOfAcceptableOffers?: number;
  LowestAcceptableOfferValue?: number;
  HighestAcceptableOfferValue?: number;
  LastUpdated?: string;
}

export async function fetchAwardsByProcedure(procedureId: number): Promise<EjnAward[]> {
  const data = await ejnFetch("/Awards", {
    "$filter": `ProcedureId eq ${procedureId}`,
    "$orderby": "Id desc",
    "$top": "20",
  }, 30 * 60 * 1000);
  return data.value ?? [];
}

export async function fetchLotContractsByProcedure(procedureId: number): Promise<any[]> {
  const data = await ejnFetch("/LotContracts", {
    "$filter": `ProcedureId eq ${procedureId}`,
    "$orderby": "Id desc",
    "$top": "20",
  }, 30 * 60 * 1000);
  return data.value ?? [];
}

// Helper: Dohvati dodjele zajedno sa pobjednicima
export async function fetchTenderAwardInfo(procedureId: number) {
  try {
    const [awards, lotContracts] = await Promise.all([
      fetchAwardsByProcedure(procedureId),
      fetchLotContractsByProcedure(procedureId),
    ]);
    return { awards, lotContracts };
  } catch {
    return { awards: [], lotContracts: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTING AUTHORITIES — Ugovorni organi
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchContractingAuthority(ejnId: number) {
  try {
    const data = await ejnFetch(`/ContractingAuthorities`, {
      "$filter": `Id eq ${ejnId}`,
      "$top": "1",
    }, 60 * 60 * 1000); // 1h cache
    return data.value?.[0] ?? null;
  } catch {
    return null;
  }
}
