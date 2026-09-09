import { db } from "@workspace/db";
import {
  contractingAuthorityProfilesTable,
  historicalAwardsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function cleanNameForSearch(name: string): string {
  return name
    .replace(/d\.o\.o\./gi, "")
    .replace(/doo/gi, "")
    .replace(/j\.p\./gi, "")
    .replace(/jp/gi, "")
    .replace(/j\.u\./gi, "")
    .replace(/ju/gi, "")
    .replace(/a\.d\./gi, "")
    .replace(/ad/gi, "")
    .replace(/k\.j\.k\.p\./gi, "")
    .replace(/kjkp/gi, "")
    .replace(/["'“”„]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectInsuranceType(procName: string, categoryName: string): string {
  const text = `${procName || ""} ${categoryName || ""}`.toLowerCase();
  if (text.includes("kasko")) return "Kasko osiguranje";
  if (text.includes("inokosn")) return "Inokosno osiguranje";
  if (text.includes("zaposlen") || text.includes("radnik") || text.includes("djelatnik") || text.includes("osoblje")) return "Osiguranje zaposlenih";
  if (text.includes("kolektiv")) return "Kolektivno osiguranje";
  if (text.includes("imovin")) return "Osiguranje imovine";
  if (text.includes("nezgod")) return "Osiguranje od nezgode";
  if (text.includes("vozil")) return "Osiguranje vozila";
  if (text.includes("zdravstven")) return "Zdravstveno osiguranje";
  if (text.includes("život") || text.includes("zivot")) return "Životno osiguranje";
  if (text.includes("osigur") || text.includes("polisa") || text.includes("polise")) return "Opšte osiguranje";
  return "";
}

export class ContractingAuthorityService {
  static baseUrl = "https://open.ejn.gov.ba";

  /**
   * Helper to perform OData API requests with rate limit check and retries
   */
  private static async apiRequest(url: string): Promise<any> {
    await delay(1000); // 1 request per second rate limit
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "ASA-Tender-Intelligence/1.0"
        }
      });
      if (!res.ok) {
        throw new Error(`EJN API Error: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      logger.error({ err, url }, "Error fetching from EJN OData API");
      throw err;
    }
  }

  /**
   * Resolves a contracting authority profile by name. If not present or stale (>7 days), scrapes it from EJN OData.
   */
  static async getOrScrapeProfile(authorityName: string, explicitEjnAuthorityId?: number): Promise<any> {
    try {
      // 1. Check database for existing profile
      let existingProfile = null;
      if (explicitEjnAuthorityId) {
        const [prof] = await db
          .select()
          .from(contractingAuthorityProfilesTable)
          .where(eq(contractingAuthorityProfilesTable.ejnId, String(explicitEjnAuthorityId)))
          .limit(1);
        existingProfile = prof;
      }
      if (!existingProfile) {
        const [prof] = await db
          .select()
          .from(contractingAuthorityProfilesTable)
          .where(eq(contractingAuthorityProfilesTable.name, authorityName))
          .limit(1);
        existingProfile = prof;
      }

      const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (
        existingProfile &&
        existingProfile.lastScrapedAt &&
        (Date.now() - new Date(existingProfile.lastScrapedAt).getTime()) < staleThreshold
      ) {
        logger.info({ authorityName, explicitEjnAuthorityId }, "Returning cached CA profile");
        return existingProfile;
      }

      logger.info({ authorityName, explicitEjnAuthorityId }, "Scraping CA profile from EJN OData...");

      let caRecord = null;

      // 2a. Search by ID if available
      if (explicitEjnAuthorityId) {
        try {
          const searchUrl = `${this.baseUrl}/ContractingAuthorities?$filter=Id eq ${explicitEjnAuthorityId}&$format=json`;
          const searchData = await this.apiRequest(searchUrl);
          caRecord = searchData?.value?.[0];
        } catch (idErr: any) {
          logger.warn({ explicitEjnAuthorityId, error: idErr.message }, "Failed to fetch CA by ID from EJN, will fallback to name search");
        }
      }

      // 2b. Search by Name if not found by ID
      if (!caRecord) {
        const cleanedName = cleanNameForSearch(authorityName);
        let searchUrl = `${this.baseUrl}/ContractingAuthorities?$filter=contains(tolower(Name), '${encodeURIComponent(cleanedName.toLowerCase())}')&$top=5&$format=json`;
        let searchData = await this.apiRequest(searchUrl);
        caRecord = searchData?.value?.[0];

        // Fallback if not found: try searching first 3 words
        if (!caRecord) {
          const words = cleanedName.split(" ").slice(0, 3).join(" ");
          if (words.length > 3) {
            searchUrl = `${this.baseUrl}/ContractingAuthorities?$filter=contains(tolower(Name), '${encodeURIComponent(words.toLowerCase())}')&$top=5&$format=json`;
            searchData = await this.apiRequest(searchUrl);
            caRecord = searchData?.value?.[0];
          }
        }
      }

      if (!caRecord) {
        logger.warn({ authorityName, explicitEjnAuthorityId }, "Contracting authority not found on EJN OData");
        // If we have an existing profile in db (but stale), return it as fallback
        if (existingProfile) return existingProfile;
        return null;
      }

      // 3. Upsert profile in our DB
      const profileId = existingProfile?.id || nanoid();
      const newProfile = {
        id: profileId,
        ejnId: String(caRecord.Id),
        name: caRecord.Name || authorityName,
        level: caRecord.ContractingAuthorityAdministrativeUnitName || caRecord.ContractingAuthorityAdministrativeUnitType || null,
        municipality: caRecord.ContractingAuthorityCityName || null,
        vrsta: caRecord.ContractingAuthorityType || null,
        lastScrapedAt: new Date(),
        lastUpdated: new Date(),
      };

      await db
        .insert(contractingAuthorityProfilesTable)
        .values(newProfile)
        .onConflictDoUpdate({
          target: contractingAuthorityProfilesTable.ejnId,
          set: {
            name: newProfile.name,
            level: newProfile.level,
            municipality: newProfile.municipality,
            vrsta: newProfile.vrsta,
            lastScrapedAt: newProfile.lastScrapedAt,
            lastUpdated: newProfile.lastUpdated,
          }
        });

      // 4. Scrape historical awards for this authority
      await this.scrapeHistoricalAwards(profileId, caRecord.Id);

      return newProfile;
    } catch (error) {
      logger.error({ error, authorityName }, "Failed to get/scrape Contracting Authority profile");
      return null;
    }
  }

  /**
   * Fetches contracts for ContractingAuthorityId and resolves winner names in batches.
   */
  private static async scrapeHistoricalAwards(profileId: string, ejnAuthorityId: number): Promise<void> {
    try {
      logger.info({ ejnAuthorityId }, "Scraping historical awards...");

      // 1. Fetch latest contracts filtered by insurance keywords
      const filterStr = `ContractingAuthorityId eq ${ejnAuthorityId} and (contains(tolower(ProcedureName), 'osigur') or contains(tolower(ProcedureName), 'kasko') or contains(tolower(ProcedureName), 'polisa'))`;
      const contractsUrl = `${this.baseUrl}/LotContracts?$filter=${encodeURIComponent(filterStr)}&$orderby=ContractDate desc&$top=100&$format=json`;
      const responseData = await this.apiRequest(contractsUrl);
      let contracts = responseData.value || [];

      // Filter strictly in-memory
      contracts = contracts.filter((c: any) => detectInsuranceType(c.ProcedureName, c.ContractCategoryName || "") !== "");

      if (contracts.length === 0) {
        logger.info({ ejnAuthorityId }, "No insurance-related historical contracts found");
        return;
      }

      // 2. Fetch LotContractsBase for these contracts to get SupplierGroupId
      const contractIds: number[] = contracts.map((c: any) => c.Id);
      const baseRecords: any[] = [];
      
      // Batch filter queries (max 10 IDs per query to avoid long URL issues)
      const batchSize = 10;
      for (let i = 0; i < contractIds.length; i += batchSize) {
        const batch = contractIds.slice(i, i + batchSize);
        const filterStr = batch.map(id => `Id eq ${id}`).join(" or ");
        const baseValUrl = `${this.baseUrl}/LotContractsBase?$filter=${filterStr}&$format=json`;
        const resData = await this.apiRequest(baseValUrl);
        if (resData?.value) {
          baseRecords.push(...resData.value);
        }
      }

      const contractToGroupMap: Record<number, number> = {};
      const supplierGroupIds: number[] = [];
      for (const rec of baseRecords) {
        contractToGroupMap[rec.Id] = rec.SupplierGroupId;
        if (rec.SupplierGroupId && !supplierGroupIds.includes(rec.SupplierGroupId)) {
          supplierGroupIds.push(rec.SupplierGroupId);
        }
      }

      // 3. Resolve Supplier Names in batches
      const supplierMap: Record<string, string> = {};
      const regLinks: any[] = [];
      const unregLinks: any[] = [];

      if (supplierGroupIds.length > 0) {
        // Fetch registered links
        for (let i = 0; i < supplierGroupIds.length; i += batchSize) {
          const batch = supplierGroupIds.slice(i, i + batchSize);
          const filterStr = batch.map(id => `SupplierGroupId eq ${id}`).join(" or ");
          const regUrl = `${this.baseUrl}/SupplierGroupSupplierLinks?$filter=${filterStr}&$format=json`;
          const resData = await this.apiRequest(regUrl);
          if (resData?.value) regLinks.push(...resData.value);
        }

        // Fetch unregistered links
        for (let i = 0; i < supplierGroupIds.length; i += batchSize) {
          const batch = supplierGroupIds.slice(i, i + batchSize);
          const filterStr = batch.map(id => `SupplierGroupId eq ${id}`).join(" or ");
          const unregUrl = `${this.baseUrl}/SupplierGroupUnregisteredSupplierLinks?$filter=${filterStr}&$format=json`;
          const resData = await this.apiRequest(unregUrl);
          if (resData?.value) unregLinks.push(...resData.value);
        }

        // Collect unique Supplier IDs
        const supplierIds = regLinks.map(l => l.SupplierId).filter((v, i, a) => a.indexOf(v) === i);
        const unregisteredSupplierIds = unregLinks.map(l => l.UnregisteredSupplierId).filter((v, i, a) => a.indexOf(v) === i);

        // Fetch registered supplier details
        for (let i = 0; i < supplierIds.length; i += batchSize) {
          const batch = supplierIds.slice(i, i + batchSize);
          const filterStr = batch.map(id => `Id eq ${id}`).join(" or ");
          const supUrl = `${this.baseUrl}/Suppliers?$filter=${filterStr}&$format=json`;
          const resData = await this.apiRequest(supUrl);
          if (resData?.value) {
            for (const s of resData.value) {
              supplierMap[`reg-${s.Id}`] = s.Name;
            }
          }
        }

        // Fetch unregistered supplier details
        for (let i = 0; i < unregisteredSupplierIds.length; i += batchSize) {
          const batch = unregisteredSupplierIds.slice(i, i + batchSize);
          const filterStr = batch.map(id => `Id eq ${id}`).join(" or ");
          const unsupUrl = `${this.baseUrl}/UnregisteredSuppliers?$filter=${filterStr}&$format=json`;
          const resData = await this.apiRequest(unsupUrl);
          if (resData?.value) {
            for (const s of resData.value) {
              supplierMap[`unreg-${s.Id}`] = s.Name;
            }
          }
        }
      }

      // Map back to winner string per group ID
      const groupToWinnerMap: Record<number, string> = {};
      for (const groupId of supplierGroupIds) {
        const winners: string[] = [];
        const regForGroup = regLinks.filter(l => l.SupplierGroupId === groupId);
        for (const link of regForGroup) {
          const name = supplierMap[`reg-${link.SupplierId}`];
          if (name) winners.push(name);
        }
        const unregForGroup = unregLinks.filter(l => l.SupplierGroupId === groupId);
        for (const link of unregForGroup) {
          const name = supplierMap[`unreg-${link.UnregisteredSupplierId}`];
          if (name) winners.push(name);
        }
        groupToWinnerMap[groupId] = winners.join(", ") || "Nepoznat";
      }

      // 4. Save awards to DB
      const awardsToInsert = contracts.map((c: any) => {
        const groupId = contractToGroupMap[c.Id];
        const winner = groupToWinnerMap[groupId] || "Nepoznat";
        
        return {
          id: `ejn-${c.Id}`,
          tenderId: null, // Scraped historical awards don't map to a specific local tender record initially
          contractingAuthorityId: profileId,
          contractingAuth: c.ContractingAuthorityName || "",
          procedureName: c.ProcedureName || "",
          winnerName: winner,
          winningBidAmount: c.Value || 0,
          currency: "KM",
          awardDate: c.ContractDate ? new Date(c.ContractDate) : new Date(),
          competitorOffersCount: null, // can default to null or extract from base record if available
          cpvKod: detectInsuranceType(c.ProcedureName, c.ContractCategoryName),
          ejnBroj: c.ProcedureNumber || null,
        };
      });

      // Clear old historical awards for this authority to ensure clean sync
      await db.delete(historicalAwardsTable).where(eq(historicalAwardsTable.contractingAuthorityId, profileId));

      // Batch insert the new resolved records
      if (awardsToInsert.length > 0) {
        await db.insert(historicalAwardsTable).values(awardsToInsert);
        logger.info({ count: awardsToInsert.length }, "Saved historical awards successfully");
      }
    } catch (err) {
      logger.error({ err, ejnAuthorityId }, "Failed to scrape and resolve historical awards");
    }
  }
}
