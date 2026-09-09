import type { EjnRow } from "./ejnIngestion";

export interface EjnDocument {
  id: number;
  name: string;
  fileType: string;
  downloadUrl: string;
  fileSize?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class EjnApiService {
  static baseUrl = "https://open.ejn.gov.ba";

  static async fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
    const attempts = Math.max(1, Math.min(5, retries));
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const timeout = AbortSignal.timeout(20_000);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        const response = await fetch(url, { ...options, signal });
        if (response.ok) return response;
        const error = new Error(`EJN API HTTP ${response.status}`);
        await response.body?.cancel();
        if (response.status < 500 && response.status !== 429) throw Object.assign(error, { permanent: true });
        throw error;
      } catch (error) {
        if (attempt === attempts - 1 || (error as { permanent?: boolean }).permanent || options.signal?.aborted) throw error;
        await delay(1000 * 2 ** attempt);
      }
    }
    throw new Error("EJN API zahtjev nije završen.");
  }

  static async fetchCollection(path: string, query: Record<string, string>): Promise<{ value: EjnRow[]; [key: string]: unknown }> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await this.fetchWithRetry(url.toString(), { headers: { Accept: "application/json" } });
    const data = await response.json() as { value?: EjnRow[] };
    if (!data || !Array.isArray(data.value)) throw new Error(`EJN API ${path}: odgovor ne sadrži očekivanu listu podataka.`);
    return { ...data, value: data.value };
  }

  static async fetchAnnouncements(skip = 0, top = 50, lastUpdatedStr?: string, announcedThrough?: string) {
    if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(top) || top < 1 || top > 100) throw new Error("Neispravna EJN paginacija.");
    const filters: string[] = [];
    if (lastUpdatedStr) filters.push(`LastUpdated ge ${new Date(lastUpdatedStr).toISOString()}`);
    if (announcedThrough) filters.push(`LastUpdated le ${new Date(announcedThrough).toISOString()}`);
    return this.fetchCollection("/AnnouncementProcedureNotices", {
      "$skip": String(skip), "$top": String(top), "$orderby": "Announced desc,LastUpdated desc,Id desc", "$filter": filters.join(" and "),
    });
  }

  static async fetchProcedureLots(procedureId: number) {
    if (!Number.isSafeInteger(procedureId) || procedureId <= 0) throw new Error("Neispravan EJN ProcedureId.");
    const all: EjnRow[] = [];
    const pageSize = 100;
    for (let page = 0; page < 10; page++) {
      const data = await this.fetchCollection("/Lots", {
        "$filter": `ProcedureId eq ${procedureId}`, "$orderby": "Id asc", "$top": String(pageSize), "$skip": String(page * pageSize),
      });
      all.push(...data.value);
      if (data.value.length < pageSize) return { value: all };
    }
    throw new Error(`Postupak ${procedureId}: dosegnut limit od 1000 lotova; podaci nisu potpuni.`);
  }

  /** The public OData catalog has no document collections. Use EjnDocumentScraper. */
  static async fetchProcedureDocuments(_procedureId: number): Promise<EjnDocument[]> {
    throw new Error("EJN OpenAPI ne izlaže tenderske dokumente. Dokumentacija se preuzima kroz EJN portal.");
  }
  static async fetchLotDocuments(_lotId: number): Promise<EjnDocument[]> {
    throw new Error("EJN OpenAPI ne izlaže dokumente lotova. Dokumentacija se preuzima kroz EJN portal.");
  }
  static async fetchAllTenderDocuments(procedureId: number): Promise<EjnDocument[]> {
    return this.fetchProcedureDocuments(procedureId);
  }
}
