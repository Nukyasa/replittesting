import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import mammoth from "mammoth";

export const MAX_DOCUMENT_BYTES = 40 * 1024 * 1024;

export function assertEjnUrl(value: string): string {
  const url = new URL(value, "https://www.ejn.gov.ba");
  if (url.protocol !== "https:" || !["www.ejn.gov.ba", "ejn.gov.ba", "docs.ejn.gov.ba"].includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Dokument nije na dozvoljenoj EJN adresi.");
  }
  return url.href;
}

export function isDownloadedDocument(document: { fileType?: string | null; localPath?: string | null; fileSize?: number | null }): boolean {
  return !/portal.?link/i.test(document.fileType || "") && Boolean(document.localPath) && (document.fileSize || 0) > 0;
}

export function documentFilename(disposition: string | undefined, fallback: string): string {
  let name = fallback;
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const normal = disposition?.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  if (encoded) {
    try { name = decodeURIComponent(encoded); } catch { name = fallback; }
  } else if (normal) {
    name = normal[1] || normal[2];
  }
  return path.posix.basename(name.replace(/\\/g, "/")).replace(/[\x00-\x1f<>:"|?*]/g, "_").trim() || "dokument";
}

export function assertDocumentPayload(buffer: Buffer, filename: string, contentType = ""): void {
  if (buffer.length === 0 || buffer.length > MAX_DOCUMENT_BYTES) throw new Error("Dokument je prazan ili prelazi ograničenje od 40 MB.");
  const beginning = buffer.subarray(0, 1024).toString("utf8").trimStart();
  if (/text\/html|application\/(?:json|xml)|text\/xml/i.test(contentType) || /^(?:<!doctype|<html|<head|<body|\{\s*"|\[\s*\{)/i.test(beginning)) {
    throw new Error("Portal je vratio stranicu ili poruku umjesto dokumenta; provjerite pristup na EJN portalu.");
  }
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf" && !beginning.includes("%PDF-")) throw new Error("Preuzeti sadržaj nije ispravan PDF dokument.");
  if ([".zip", ".docx", ".xlsx"].includes(extension) && buffer.subarray(0, 2).toString("ascii") !== "PK") throw new Error("Preuzeti sadržaj nije ispravna ZIP/Office datoteka.");
}

export interface ExtractedPage { page: number; text: string; method: "embedded" | "ocr" }
export interface ExtractedDocumentContent {
  text: string;
  pages: ExtractedPage[];
  tables: { page: number; rows: string[][] }[];
  method: "embedded" | "ocr" | "embedded+ocr" | "unsupported";
  pageCount: number;
  warnings: string[];
}

export function documentContentHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function documentLogicalKey(name: string, originalUrl = "") {
  const urlWithoutFragment = originalUrl.replace(/([?&](?:token|timestamp|_=)[^&#]*)/gi, "").replace(/[#?&]+$/, "");
  return `${urlWithoutFragment}|${path.basename(name).toLocaleLowerCase("bs")}`.replace(/\s+/g, " ");
}

async function prepareOcrLanguages() {
  const require = createRequire(import.meta.url);
  const target = path.join(os.tmpdir(), "tender-manager-ocr-languages");
  await fs.mkdir(target, { recursive: true });
  for (const packageName of ["@tesseract.js-data/bos", "@tesseract.js-data/srp_latn", "@tesseract.js-data/srp"]) {
    const config = require(packageName) as { code: string; langPath: string };
    const source = path.join(config.langPath, `${config.code}.traineddata.gz`);
    const destination = path.join(target, `${config.code}.traineddata.gz`);
    await fs.copyFile(source, destination).catch(async error => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
  }
  return target;
}

export async function extractDocumentContent(buffer: Buffer, filename: string): Promise<ExtractedDocumentContent> {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const extracted = await parser.getText({ pageJoiner: "" });
      const pages: ExtractedPage[] = extracted.pages.map(page => ({ page: page.num, text: page.text.trim(), method: "embedded" }));
      const warnings: string[] = [];
      const sparse = pages.filter(page => page.text.replace(/\s/g, "").length < 40).map(page => page.page);
      const maxOcrPages = Math.max(0, Math.min(60, Number(process.env.OCR_MAX_PAGES || 30)));
      const pagesForOcr = sparse.slice(0, maxOcrPages);
      if (pagesForOcr.length) {
        try {
          const [{ createWorker, OEM }, languagePath, screenshots] = await Promise.all([
            import("tesseract.js"),
            prepareOcrLanguages(),
            parser.getScreenshot({ partial: pagesForOcr, desiredWidth: 1800, imageBuffer: true, imageDataUrl: false }),
          ]);
          const worker = await createWorker(["bos", "srp_latn", "srp"], OEM.LSTM_ONLY, { langPath: languagePath, cachePath: languagePath });
          try {
            for (const screenshot of screenshots.pages) {
              const result = await worker.recognize(Buffer.from(screenshot.data));
              const ocrText = result.data.text.trim();
              if (ocrText.replace(/\s/g, "").length >= 20) {
                const page = pages.find(item => item.page === screenshot.pageNumber);
                if (page) { page.text = ocrText; page.method = "ocr"; }
              }
            }
          } finally { await worker.terminate(); }
        } catch (error) {
          warnings.push(`OCR nije dovršen: ${error instanceof Error ? error.message : "nepoznata greška"}`);
        }
      }
      if (sparse.length > maxOcrPages) warnings.push(`OCR je ograničen na ${maxOcrPages} stranica; ${sparse.length - maxOcrPages} stranica zahtijeva ručnu provjeru.`);
      const remainingUnreadable = pages.filter(page => page.text.replace(/\s/g, "").length < 20).length;
      if (remainingUnreadable) warnings.push(`${remainingUnreadable} od ${pages.length} stranica nema dovoljno čitljivog teksta.`);
      let tables: { page: number; rows: string[][] }[] = [];
      try {
        const tableResult = await parser.getTable();
        tables = tableResult.pages.flatMap(page => page.tables.map(rows => ({ page: page.num, rows })));
      } catch { warnings.push("Tabele nisu automatski izdvojene; provjerite raspored u izvornom PDF-u."); }
      const hasOcr = pages.some(page => page.method === "ocr");
      const hasEmbedded = pages.some(page => page.method === "embedded" && page.text);
      return {
        text: pages.map(page => page.text).filter(Boolean).join("\n\n"), pages, tables,
        method: hasOcr && hasEmbedded ? "embedded+ocr" : hasOcr ? "ocr" : "embedded",
        pageCount: extracted.total, warnings,
      };
    } finally { await parser.destroy(); }
  }
  if (extension === ".docx" || extension === ".txt") {
    const text = extension === ".docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf8");
    return { text, pages: [{ page: 1, text, method: "embedded" }], tables: [], method: "embedded", pageCount: 1, warnings: [] };
  }
  return { text: "", pages: [], tables: [], method: "unsupported", pageCount: 0, warnings: ["Format nema podržano automatsko izdvajanje teksta."] };
}

export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  return (await extractDocumentContent(buffer, filename)).text;
}
