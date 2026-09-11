import axios, { type AxiosInstance } from "axios";
import { db, documentsTable, tendersTable, tenderChangesTable } from "@workspace/db";
import { nanoid } from "../lib/nanoid";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import AdmZip from "adm-zip";
import { EjnSessionManager } from "./ejnSession";
import { jobManager } from "./jobManager";
import { assertDocumentPayload, assertEjnUrl, documentFilename, extractDocumentContent, documentContentHash, documentLogicalKey, isDownloadedDocument, MAX_DOCUMENT_BYTES } from "../lib/documentFiles";
import { createPublicEjnClient, EJN_PORTAL, resolvePortalAnnouncement, type PortalAnnouncement } from "../lib/ejnPortalDocuments";

type SavedDocument = { id: string; type: string; filename: string; downloaded: boolean };
export interface DocumentAcquisitionResult {
  tender_id: string;
  ejn_id: number | null;
  ejn_broj: string;
  scraped_at: string;
  documents: SavedDocument[];
  vezana_obavjestenja: { ejn_broj: string; vrsta: string; naziv: string; datum: string; documents: SavedDocument[] }[];
  competitors: unknown[];
  warnings: string[];
  summary: {
    total_documents: number;
    downloaded_documents: number;
    existing_documents: number;
    acquisition_status: "downloaded" | "partial" | "unavailable";
    has_tender_documentation: boolean;
    has_aneksi: boolean;
    has_dodjela_ugovora: boolean;
    has_pojasnjenja: boolean;
    latest_document_date: string | null;
  };
}

export class EjnDocumentScraper {
  private static running = new Map<string, Promise<DocumentAcquisitionResult>>();

  async scrapeAllDocuments(tenderId: string, jobId: string, _depth = 0, _explicitEjnId?: number, autoCompleteJob = true): Promise<DocumentAcquisitionResult> {
    jobManager.updateJob(jobId, { status: "running", progressMessage: "Pronalazim dokumente na EJN portalu...", progressPercent: 10 });
    let task = EjnDocumentScraper.running.get(tenderId);
    if (!task) {
      task = this.acquireDocuments(tenderId, jobId);
      EjnDocumentScraper.running.set(tenderId, task);
    }
    try {
      const result = await task;
      if (autoCompleteJob) {
        jobManager.completeJob(jobId, result);
        jobManager.updateJob(jobId, { progressMessage: result.summary.acquisition_status === "unavailable"
          ? "Dokumenti nisu preuzeti. Pogledajte napomene i otvorite EJN portal."
          : `Dostupno ${result.summary.total_documents} dokumenata; novo preuzeto ${result.summary.downloaded_documents}.` });
      }
      return result;
    } catch (error) {
      if (autoCompleteJob) {
        jobManager.failJob(jobId, error instanceof Error ? error.message : "Preuzimanje dokumenata nije uspjelo.");
      }
      throw error;
    } finally {
      if (EjnDocumentScraper.running.get(tenderId) === task) EjnDocumentScraper.running.delete(tenderId);
    }
  }

  private async acquireDocuments(tenderId: string, jobId: string): Promise<DocumentAcquisitionResult> {
    const tender = await db.query.tendersTable.findFirst({ where: eq(tendersTable.id, tenderId) });
    if (!tender) throw new Error("Tender nije pronađen.");
    const raw = tender.rawData as Record<string, any> | null;
    const noticeNumber = String(raw?.announcement?.Number || raw?.Number || raw?.number || tender.externalId || "");
    const result: DocumentAcquisitionResult = {
      tender_id: tenderId, ejn_id: null, ejn_broj: noticeNumber, scraped_at: new Date().toISOString(),
      documents: [], vezana_obavjestenja: [], competitors: [], warnings: [],
      summary: { total_documents: 0, downloaded_documents: 0, existing_documents: 0, acquisition_status: "unavailable", has_tender_documentation: false, has_aneksi: false, has_dodjela_ugovora: false, has_pojasnjenja: false, latest_document_date: null },
    };
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const warn = (message: string) => { if (!result.warnings.includes(message)) result.warnings.push(message); };
    let publicClient: AxiosInstance;
    try { publicClient = await createPublicEjnClient(); } catch { warn("EJN javna sesija trenutno nije dostupna. Pokušajte ponovo ili ručno dodajte dokumentaciju."); return result; }

    let announcement: PortalAnnouncement | null = null;
    if (/^\d+-[\d-]+\/\d{2,4}$/.test(noticeNumber)) {
      try { announcement = await resolvePortalAnnouncement(publicClient, noticeNumber); }
      catch { warn("Javna pretraga EJN obavještenja trenutno nije dostupna."); }
    }
    if (!announcement) {
      warn("Nije pronađeno tačno podudarno obavještenje na portalu. Provjerite broj obavještenja i dokumente dodajte ručno.");
      return result;
    }
    result.ejn_id = announcement.id;
    const downloadNotice = async (record: PortalAnnouncement, docType: string, related: string | null) => {
      if (!record.downloadUrl || !/\.pdf(?:[?#]|$)/i.test(record.downloadUrl)) { warn(`PDF obavještenja ${record.number} nije dostupan.`); return null; }
      try {
        const response = await this.fetchBinary(record.downloadUrl);
        const name = documentFilename(String(response.headers["content-disposition"] || ""), `Obavjestenje_${record.number.replace(/[\/]/g, "_")}.pdf`);
        const saved = await this.saveDocument(tenderId, record.downloadUrl, name, docType, related, Buffer.from(response.data), String(response.headers["content-type"] || "application/pdf"), uploadDir, warn);
        if (!result.documents.some(doc => doc.id === saved.id)) result.documents.push(saved);
        return saved;
      } catch { warn(`PDF obavještenja ${record.number} nije preuzet. Otvorite izvorni EJN portal.`); return null; }
    };

    jobManager.updateJob(jobId, { progressMessage: "Preuzimam javno obavještenje i provjeravam dokumentaciju...", progressPercent: 30 });
    await downloadNotice(announcement, this.noticeType(announcement.announcementType), null);

    // Respect the portal's published access flags and complaint confirmation screen.
    if (announcement.procedureId) {
      try {
        let client = publicClient;
        let access = (await client.get(`${EJN_PORTAL}/Api/Documentation/CheckAccess`, { params: { id: announcement.procedureId } })).data;
        if (access?.hasComplaint) {
          warn("Postupak ima žalbu. Pregledajte upozorenje i pristup dokumentaciji direktno na EJN portalu.");
        } else {
          const hasAllowedDocuments = (rules: any) => rules?.isQualificationDocumentationAllowed || rules?.isIntermediateDocumentationAllowed || rules?.isProcurementDocumentationAllowed;
          if (!hasAllowedDocuments(access) && (process.env.EJN_USERNAME || process.env.EJN_USER) && (process.env.EJN_PASSWORD || process.env.EJN_PASS)) {
            client = await EjnSessionManager.getInstance().getAuthedClient();
            access = (await client.get(`${EJN_PORTAL}/Api/Documentation/CheckAccess`, { params: { id: announcement.procedureId } })).data;
          }
          if (access?.hasComplaint) {
            warn("Postupak ima žalbu. Pristup dokumentaciji provjerite direktno na EJN portalu.");
          } else if (!hasAllowedDocuments(access)) {
            warn("Portal ne dozvoljava preuzimanje tenderske dokumentacije u ovoj sesiji. Provjerite pristup/prijavu na portalu ili dodajte preuzete datoteke ručno.");
          } else {
            const allowed = [
              ["QualificationDocumentation", access.isQualificationDocumentationAllowed],
              ["IntermediateDocumentation", access.isIntermediateDocumentationAllowed],
              ["ProcurementDocumentation", access.isProcurementDocumentationAllowed],
            ] as const;
            for (const [type, canDownload] of allowed) {
              if (!canDownload) continue;
              try {
                const redirect = await client.get(`${EJN_PORTAL}/Supplier/Documentation/Download`, { params: { id: announcement.procedureId, type } });
                if (typeof redirect.data?.redirectTo !== "string") throw new Error("Nedostaje adresa dokumentacije.");
                const archiveUrl = assertEjnUrl(redirect.data.redirectTo);
                const response = await this.fetchBinary(archiveUrl, client);
                const buffer = Buffer.from(response.data);
                const name = documentFilename(String(response.headers["content-disposition"] || ""), `${type}.zip`);
                const mime = String(response.headers["content-type"] || "application/octet-stream");
                assertDocumentPayload(buffer, name, mime);
                const documentSource = `${EJN_PORTAL}/Supplier/Documentation/Download?id=${announcement.procedureId}&type=${type}`;
                let docs: SavedDocument[];
                if (path.extname(name).toLowerCase() === ".zip") docs = await this.saveArchive(tenderId, documentSource, buffer, uploadDir, warn);
                else docs = [await this.saveDocument(tenderId, documentSource, name, "TENDERSKA_DOK", null, buffer, mime, uploadDir, warn)];
                for (const doc of docs) if (!result.documents.some(existing => existing.id === doc.id)) result.documents.push(doc);
                if (docs.length > 0) result.summary.has_tender_documentation = true;
              } catch { warn(`Dokumentacija ${type} nije preuzeta. Provjerite pristup na portalu.`); }
            }
          }
        }
      } catch { warn("Nije moguće provjeriti ili preuzeti tendersku dokumentaciju. Provjerite EJN pristup ili dodajte dokumente ručno."); }
    } else warn("Portal nije naveo postupak za preuzimanje tenderske dokumentacije.");

    jobManager.updateJob(jobId, { progressMessage: "Provjeravam vezana obavještenja i izmjene...", progressPercent: 70 });
    try {
      const response = await publicClient.get(`${EJN_PORTAL}/api/Announcement/GetRelatedAnnouncements`, { params: { id: announcement.id } });
      if (!Array.isArray(response.data)) throw new Error("Neispravna lista vezanih obavještenja.");
      const related = response.data.filter((record: PortalAnnouncement) => record.id !== announcement!.id);
      if (related.length > 30) warn("Prikazano je prvih 30 vezanih obavještenja. Ostala pregledajte na portalu.");
      for (const record of related.slice(0, 30) as PortalAnnouncement[]) {
        const type = this.noticeType(record.announcementType);
        const doc = await downloadNotice(record, type, record.number);
        result.summary.has_aneksi ||= type === "ANEKS";
        result.summary.has_dodjela_ugovora ||= type === "DODJELA";
        result.summary.has_pojasnjenja ||= type === "POJASNJENJE";
        result.vezana_obavjestenja.push({ ejn_broj: record.number, vrsta: record.announcementType || "", naziv: record.name || "", datum: record.date || "", documents: doc ? [doc] : [] });
      }
    } catch { warn("Vezana obavještenja nisu provjerena. Moguće izmjene pregledajte na EJN portalu."); }

    result.summary.total_documents = result.documents.length;
    result.summary.downloaded_documents = result.documents.filter(doc => doc.downloaded).length;
    result.summary.existing_documents = result.documents.filter(doc => !doc.downloaded).length;
    result.summary.acquisition_status = result.documents.length === 0 ? "unavailable" : result.warnings.length > 0 || !result.summary.has_tender_documentation ? "partial" : "downloaded";
    logger.info({ tenderId, documents: result.summary.total_documents, status: result.summary.acquisition_status }, "EJN dokumenti obrađeni");
    return result;
  }

  async scrapeCompetitors(tenderId: string, explicitEjnId?: number): Promise<any[]> {
    const { scrapeCompetitors } = await import("./ejnCompetitorScraper");
    return scrapeCompetitors(tenderId, explicitEjnId);
  }

  private fetchBinary(url: string, client: AxiosInstance = axios) {
    return client.get(assertEjnUrl(url), {
      responseType: "arraybuffer", timeout: 30000, maxContentLength: MAX_DOCUMENT_BYTES, maxRedirects: 3,
      beforeRedirect: (options) => { assertEjnUrl(`${options.protocol}//${options.hostname}${options.path}`); },
    });
  }

  private async saveArchive(tenderId: string, url: string, buffer: Buffer, uploadDir: string, warn: (message: string) => void): Promise<SavedDocument[]> {
    const entries = new AdmZip(buffer).getEntries().filter(entry => !entry.isDirectory);
    if (entries.length > 150 || entries.reduce((total, entry) => total + entry.header.size, 0) > 120 * 1024 * 1024 || entries.some(entry => entry.header.size > MAX_DOCUMENT_BYTES)) throw new Error("Arhiva prelazi dozvoljenu veličinu.");
    const docs: SavedDocument[] = [];
    for (const entry of entries) {
      const name = documentFilename(undefined, entry.entryName);
      if (!/\.(pdf|docx?|xlsx?|txt|rtf|csv|png|jpe?g)$/i.test(name)) { warn(`Datoteka ${name} zahtijeva ručni pregled iz arhive.`); continue; }
      try {
        const mime = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
        docs.push(await this.saveDocument(tenderId, `${url}#file=${encodeURIComponent(entry.entryName)}`, name, "TENDERSKA_DOK", null, entry.getData(), mime, uploadDir, warn));
      } catch { warn(`Datoteka ${name} nije obrađena; pregledajte izvornu arhivu.`); }
    }
    return docs;
  }

  private async saveDocument(tenderId: string, url: string, name: string, type: string, related: string | null, buffer: Buffer, mime: string, uploadDir: string, warn: (message: string) => void): Promise<SavedDocument> {
    assertDocumentPayload(buffer, name, mime);
    const hash = documentContentHash(buffer);
    const logicalKey = documentLogicalKey(name, url);
    const existing = await db.query.documentsTable.findFirst({ where: and(eq(documentsTable.tenderId, tenderId), eq(documentsTable.originalUrl, url), isNull(documentsTable.supersededBy)) });
    const sameContent = await db.query.documentsTable.findFirst({ where: and(eq(documentsTable.tenderId, tenderId), eq(documentsTable.contentHash, hash)) });
    if (sameContent && isDownloadedDocument(sameContent)) return { id: sameContent.id, type, filename: name, downloaded: false };
    if (existing && isDownloadedDocument(existing)) {
      let localFile = existing.localPath!;
      try { if (localFile.startsWith("file://")) localFile = fileURLToPath(localFile); } catch { localFile = localFile.replace(/^file:\/\//, ""); }
      const saved = await fs.readFile(localFile).catch(() => null);
      if (saved?.equals(buffer)) {
        if (!existing.contentHash) await db.update(documentsTable).set({ contentHash: hash, logicalKey }).where(eq(documentsTable.id, existing.id));
        return { id: existing.id, type, filename: name, downloaded: false };
      }
    }
    let content = { text: "", pages: [], tables: [], method: "unsupported", pageCount: 0, warnings: [] } as Awaited<ReturnType<typeof extractDocumentContent>>;
    try { content = await extractDocumentContent(buffer, name); } catch { warn(`Tekst datoteke ${name} nije automatski pročitan; potreban je ručni pregled.`); }
    const text = content.text;
    content.warnings.forEach(message => warn(`${name}: ${message}`));
    if (!text.trim()) warn(`Datoteka ${name} nema čitljiv tekst za automatsku analizu.`);
    const id = nanoid();
    const version = existing ? (existing.version || 1) + 1 : 1;
    const filePath = path.join(uploadDir, `${id}${path.extname(name).toLowerCase()}`);
    await fs.writeFile(filePath, buffer);
    const values = {
      name, originalUrl: url, localPath: pathToFileURL(filePath).href, fileType: type, mimeType: mime,
      parsedText: text, extractedTextPreview: text.slice(0, 500), keyData: this.extractKeyData(text),
      textPages: content.pages, extractionMetadata: { method: content.method, pageCount: content.pageCount, tables: content.tables, warnings: content.warnings },
      contentHash: hash, logicalKey, version, previousDocumentId: existing?.id || null,
      relatedEjnBroj: related, fileSize: buffer.length, scrapedAt: new Date(),
    };
    await db.insert(documentsTable).values({ id, tenderId, ...values, createdAt: new Date() });
    if (existing) {
      await db.update(documentsTable).set({ supersededBy: id }).where(eq(documentsTable.id, existing.id));
      await db.insert(tenderChangesTable).values({ id: nanoid(), tenderId, field: `Dokument: ${name}`, oldValue: `verzija ${existing.version || 1}`, newValue: `verzija ${version} — sadržaj je promijenjen`, changedAt: new Date() });
    }
    return { id, type, filename: name, downloaded: true };
  }

  private noticeType(type = ""): string {
    if (/aneks|izmjen|ispravk/i.test(type)) return "ANEKS";
    if (/dodjel/i.test(type)) return "DODJELA";
    if (/pojašnjen|pojasnjen/i.test(type)) return "POJASNJENJE";
    return "OBAVJESTENJE";
  }

  private extractKeyData(text: string): Record<string, string> {
    const data: Record<string, string> = {};
    const amount = text.match(/garancij[au].*?(\d[\d.,]+)\s*KM/i);
    if (amount) data.garancija_iznos = amount[1];
    const period = text.match(/rok važenja.*?(\d+)\s*dan/i);
    if (period) data.garancija_period_dana = period[1];
    const duration = text.match(/trajanje.*?(\d+)\s*(mjes|god|dan)/i);
    if (duration) data.trajanje_ugovora = `${duration[1]} ${duration[2]}`;
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (email) data.kontakt_email = email[0];
    return data;
  }
}
