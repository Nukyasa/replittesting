/** Pure helpers shared by extraction, analysis and offline fixture tests. */
export interface EvidenceDocument {
  id: string;
  name: string;
  parsedText: string | null;
  fileType?: string | null;
  textPages?: unknown;
  supersededBy?: string | null;
}

export interface TenderFacts {
  id?: string;
  title: string;
  description?: string | null;
  category?: string | null;
  contractingAuth?: string | null;
  currency?: string | null;
  estimatedValue?: number | null;
  deadline?: Date | string | null;
  questionsDeadline?: Date | string | null;
  publicationDate?: Date | string | null;
  awardCriteria?: string | null;
  awardCriteriaDetails?: string | null;
  guaranteeAmount?: number | null;
  guaranteeType?: string | null;
}

export type EvidenceKind = "requirement" | "document" | "declaration" | "deadline" | "guarantee" | "criterion";
export interface TenderEvidence {
  documentId: string;
  documentName: string;
  quote: string;
  kind: EvidenceKind;
  pageNumber?: number;
}

export interface AnalysisMetadata {
  provider: "local" | "groq" | "anthropic" | "gemini";
  status: "metadata_only" | "document_review" | "ai_review";
  documentCount: number;
  readableDocumentCount: number;
  sourceDocumentIds: string[];
  truncated: boolean;
  warnings: string[];
  scoringAvailable: false;
  evidence: TenderEvidence[];
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const cyrillic = "абвгдђежзијклљмнњопрстћуфхцчџш".split("");
const latin = ["a", "b", "v", "g", "d", "đ", "e", "ž", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "ć", "u", "f", "h", "c", "č", "dž", "š"];
const transliteration = new Map(cyrillic.map((letter, i) => [letter, latin[i]]));
const matchingText = (text: string) => [...text.toLowerCase()].map(letter => transliteration.get(letter) ?? letter).join("");

export function readableDocuments(documents: EvidenceDocument[]) {
  return documents.filter(doc => !doc.supersededBy && !/^(link|html|url|portal|ejn_portal_link)$/i.test(doc.fileType || "")
    && !!doc.parsedText?.trim() && !/^https?:\/\/\S+$/i.test(doc.parsedText.trim()));
}

export function collectDocumentEvidence(documents: EvidenceDocument[]): TenderEvidence[] {
  const evidence: TenderEvidence[] = [];
  const patterns: [EvidenceKind, RegExp][] = [
    ["declaration", /izjav[auie]/i],
    ["document", /(?:dostavi|prilož|priloz|obavezn|mora).*(?:obrazac|uvjerenj|potvrd|licenc|izvod|dokument|referenc)|(?:obrazac|uvjerenj|potvrd|licenc|izvod).*(?:dostavi|obavezn|mora)/i],
    ["guarantee", /garancij/i],
    ["deadline", /rok.{0,45}(?:ponud|pitanj|dostav|otvaranj)|(?:ponud|pitanj).{0,35}rok/i],
    ["criterion", /kriterij|najniž[aeu] cijen|ekonomski najpovoljn/i],
    ["requirement", /(?:ponuđač|ponudjac|uslov|uvjet|sposobnost|referenc).*(?:mora|dužan|duzan|minimal|najmanje|dokaz|zahtjev)|(?:mora|dužan|duzan).*(?:ponuđač|ponudjac)/i],
  ];
  for (const doc of readableDocuments(documents)) {
    const structuredPages = Array.isArray(doc.textPages) ? doc.textPages.filter((page: any) => page && Number.isInteger(page.page) && typeof page.text === "string") : [];
    const pages = structuredPages.length ? structuredPages : [{ page: undefined, text: doc.parsedText || "" }];
    for (const page of pages) {
      const lines = page.text.split(/\r?\n|(?<=[.!?;])\s+(?=[A-ZČĆŠŽĐ])/);
      for (const [lineIndex, line] of lines.entries()) {
      const quote = normalize(line);
      // Long paragraphs are not safely reducible to a standalone requirement.
      if (quote.length < 18 || quote.length > 1500) continue;
      for (const [kind, pattern] of patterns) {
        const normalized = matchingText(quote);
        if (["requirement", "document", "declaration"].includes(kind) && /nije obavezn|nisu obavezn|nije potrebno|ne zahtijeva|ne mora|ne traži/i.test(normalized)) continue;
        if (pattern.test(normalized) && !evidence.some(e => e.documentId === doc.id && e.quote === quote && e.kind === kind)) {
          // Portal PDFs often put a date or value on the line below its heading.
          const excerpt = ["deadline", "criterion", "guarantee"].includes(kind) ? normalize(lines.slice(lineIndex, lineIndex + 3).join("\n")) : quote;
          evidence.push({ documentId: doc.id, documentName: doc.name, quote: excerpt.length <= 1500 ? excerpt : quote, kind, pageNumber: page.page });
        }
      }
      if (evidence.length >= 100) return evidence.slice(0, 100);
      }
    }
  }
  return evidence;
}

export function createAnalysisMetadata(documents: EvidenceDocument[], warnings: string[] = []): AnalysisMetadata {
  documents = documents.filter(doc => !doc.supersededBy && !/^(link|html|url|portal|ejn_portal_link)$/i.test(doc.fileType || ""));
  const readable = readableDocuments(documents);
  return {
    provider: "local",
    status: readable.length ? "document_review" : "metadata_only",
    documentCount: documents.length,
    readableDocumentCount: readable.length,
    sourceDocumentIds: readable.map(doc => doc.id),
    truncated: false,
    warnings: [
      ...(readable.length && readable.every(doc => /obavj|original_pdf/i.test(doc.fileType || "")) ? ["Dostupna su samo javna obavještenja. Potpuna tenderska dokumentacija nije potvrđena."] : []),
      ...(readable.length ? ["Izdvojeni navodi su radna lista za provjeru u izvornoj dokumentaciji; potpunost uslova nije potvrđena."] : ["Nema čitljivog teksta dokumentacije. Uslovi, obavezni prilozi i garancije nisu potvrđeni."]),
      ...(documents.length > readable.length ? ["Dio priloga nema izdvojen tekst. Za skenirane dokumente potreban je OCR ili ručna provjera."] : []),
      ...warnings,
    ],
    scoringAvailable: false,
    evidence: collectDocumentEvidence(documents),
  };
}

export function evidenceLabel(evidence: TenderEvidence): string {
  return `${evidence.quote} [${evidence.documentName}${evidence.pageNumber ? `; str. ${evidence.pageNumber}` : ""}; dokument ${evidence.documentId}]`;
}

/** Model-supplied claims are discarded unless an exact quote exists in its cited document. */
export function validateModelEvidence(value: unknown, documents: EvidenceDocument[]): TenderEvidence[] {
  if (!Array.isArray(value)) return [];
  const kinds: EvidenceKind[] = ["requirement", "document", "declaration", "deadline", "guarantee", "criterion"];
  return value.slice(0, 100).flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.quote !== "string" || !kinds.includes(item.kind)) return [];
    const doc = readableDocuments(documents).find(doc => doc.id === item.documentId);
    const quote = normalize(item.quote);
    const requestedPage = Number.isInteger(item.pageNumber) ? Number(item.pageNumber) : undefined;
    const sourcePage = requestedPage && Array.isArray(doc?.textPages) ? (doc.textPages as any[]).find(page => page?.page === requestedPage) : null;
    const sourceText = sourcePage?.text || doc?.parsedText || "";
    if (!doc || quote.length < 18 || quote.length > 1500 || !normalize(sourceText).includes(quote)) return [];
    return [{ documentId: doc.id, documentName: doc.name, quote, kind: item.kind as EvidenceKind, pageNumber: requestedPage }];
  });
}

export function documentContext(documents: EvidenceDocument[], limit = 24000) {
  let remaining = limit;
  const included: EvidenceDocument[] = [];
  const parts: string[] = [];
  let truncated = false;
  for (const doc of readableDocuments(documents)) {
    if (remaining <= 0) { truncated = true; break; }
    const pageText = Array.isArray(doc.textPages) && doc.textPages.length
      ? (doc.textPages as any[]).map(page => `STRANICA ${page.page}\n${page.text}`).join("\n\n")
      : (doc.parsedText || "");
    const snippet = pageText.slice(0, remaining);
    if (snippet.length < (doc.parsedText || "").length) truncated = true;
    parts.push(`DOKUMENT ${doc.id}: ${doc.name}\n${snippet}`);
    included.push({ ...doc, parsedText: snippet });
    remaining -= snippet.length;
  }
  return { text: parts.join("\n\n"), documents: included, truncated };
}

export function formatKnownDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" }) : null;
}

export function buildEvidenceAnalysis(tender: TenderFacts, metadata: AnalysisMetadata) {
  const matching = (kind: EvidenceKind) => metadata.evidence.filter(e => e.kind === kind).map(evidenceLabel);
  const requirements = matching("requirement");
  return {
    summary: `${tender.title}. Ugovorni organ: ${tender.contractingAuth || "nije naveden"}. ${metadata.readableDocumentCount ? `Obrađeno ${metadata.readableDocumentCount} čitljivih dokumenata; izdvojeni navodi zahtijevaju provjeru.` : "Pregled osnovnih podataka; dokumentacija još nije obrađena."}`,
    keyRequirements: requirements,
    eligibilityCriteria: [],
    risks: metadata.warnings.map(risk => ({ risk, severity: "medium" })),
    opportunities: [],
    redFlags: metadata.warnings,
    estimatedWorkload: "Nije procijenjeno",
    suggestedApproach: metadata.readableDocumentCount
      ? "Provjerite svaki izdvojeni navod u izvornom prilogu, potpunost dokumentacije i rokove; zatim dodijelite odgovorne osobe i pripremite ponudu."
      : "Preuzmite tendersku dokumentaciju ili učitajte PDF/DOCX priloge, zatim ponovo pokrenite obradu.",
    // Legacy columns are NOT NULL; 0 is a storage sentinel, never a predicted score.
    relevanceScore: 0,
    relevanceTags: [],
    competitionLevel: "unknown",
    successProbability: 0,
    insuranceRelevance: "Relevantnost i vjerovatnoća uspjeha nisu procijenjene; potreban je pregled predmeta nabavke i kapaciteta ponuđača.",
    requiredDocs: matching("document"),
    participationConditions: { financial: "", technical: "", legal: "", experience: "", _analysis: metadata },
    requiredDeclarations: matching("declaration"),
    awardAnalysis: matching("criterion").join("\n") || tender.awardCriteriaDetails || tender.awardCriteria || "Kriterij nije potvrđen u dostupnim podacima.",
    guaranteeInfo: matching("guarantee").join("\n") || (tender.guaranteeAmount != null
      ? `Iznos iz osnovnih podataka: ${tender.guaranteeAmount} ${tender.currency || "KM"}. Vrstu i uslove provjeriti u dokumentaciji.`
      : "Zahtjev za garanciju nije potvrđen; nedostatak podatka ne znači da garancija nije potrebna."),
    estimatedPrepTime: "Nije procijenjeno",
    analysisVersion: "3-evidence",
  };
}

export interface ExtractedTenderData {
  rokovi: Record<string, string | null>;
  vrijednost: Record<string, string | null>;
  kriteriji: Record<string, any>;
  garancije: Record<string, any>;
  usloviUcesca: Record<string, string[]>;
  izjave: Record<string, any>[];
  troskoviPripreme: Record<string, any>;
  osiguranje: Record<string, any>;
  pitanjaOdgovori: Record<string, any>[];
  annexi: Record<string, any>[];
  _analysis: AnalysisMetadata;
}

export function buildLocalExtraction(tender: TenderFacts, metadata: AnalysisMetadata): ExtractedTenderData {
  const byKind = (kind: EvidenceKind) => metadata.evidence.filter(e => e.kind === kind);
  return {
    rokovi: {
      datumObjave: formatKnownDate(tender.publicationDate),
      rokPrijemPonuda: formatKnownDate(tender.deadline),
      rokPostavljanjaPitanja: formatKnownDate(tender.questionsDeadline),
      rokOdgovoraNaPitanja: null, rokZalbe: null, otvaranjeOfertica: null, rokVazenjaUgovora: null,
    },
    vrijednost: {
      procijenjenaVrijednost: tender.estimatedValue == null ? null : `${tender.estimatedValue} ${tender.currency || "KM"}`,
      napomenaVrijednosti: null,
    },
    kriteriji: { vrstaDodjelea: tender.awardCriteria || null, kriterijumi: [], napomena: tender.awardCriteriaDetails || null, navodi: byKind("criterion").map(evidenceLabel) },
    garancije: {
      garancijaPonude: { zahtijeva: null, iznos: null, postotak: null, rok: null, forma: null },
      garancijaIzvrsenjaUgovora: { zahtijeva: null, iznos: null, postotak: null, rok: null, forma: null },
      navodi: byKind("guarantee").map(evidenceLabel),
    },
    usloviUcesca: { licnaSituacija: [], sposobnostObavljanja: [], ekonomskaFinansijska: [], tehnickaStrucna: [], navodiZaProvjeru: byKind("requirement").map(evidenceLabel) },
    izjave: byKind("declaration").map(e => ({ naziv: e.quote, osnov: null, obavezna: null, napomena: evidenceLabel(e) })),
    troskoviPripreme: { snosiPonudjac: null, napomena: null },
    osiguranje: { vrstePolicaOsiguranja: [], predmetOsiguranja: null, periodPokrica: null, limitiPokrica: null, franshiza: null, posebniUslovi: [] },
    pitanjaOdgovori: [],
    annexi: byKind("document").map(e => ({ naziv: e.quote, opis: evidenceLabel(e), tip: "navod_za_provjeru", obavezan: null })),
    _analysis: metadata,
  };
}
