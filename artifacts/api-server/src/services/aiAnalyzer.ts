import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const SYSTEM_PROMPT = `Ti si ekspertni savjetnik za javne nabavke u Bosni i Hercegovini, 
specijalizovan za kompaniju ASA CENTRAL osiguranje d.d. Sarajevo — 
najveće domaće osiguravajuće društvo u BiH sa 500+ zaposlenika, 
121 poslovnicom i ASA Grupacijom kao matičnom kompanijom.

Analiziraš tendere s ciljem da pomogneš ASA CENTRAL-u da identificira 
relevantne prilike za:
- Nabavku IT opreme, softvera i usluga
- Konsultantske i profesionalne usluge  
- Osiguranje voznog parka i imovine (kao ponuđač/executor)
- Infrastrukturne radove i održavanje poslovnica
- Marketinške i komunikacijske usluge
- HR, edukacijske programe i treninge

Relevantni zakoni: Zakon o javnim nabavkama BiH (ZJN 2014, izmjene 2021).
Odgovaraj isključivo u validnom JSON formatu, bez markdowna ili objašnjenja.`;

const COMPANY_PROFILE = {
  name: "ASA CENTRAL osiguranje d.d.",
  sector: "Insurance",
  expertise: [
    "IT systems",
    "insurance software",
    "fleet management",
    "office supplies",
    "consulting",
    "digital transformation",
    "marketing",
    "HR training",
    "facility management",
  ],
};

function getMockAnalysis(tender: {
  title: string;
  category: string;
  estimatedValue?: number | null;
  questionsDeadline?: Date | null;
  hasEAuction?: boolean;
  awardCriteria?: string | null;
  guaranteeAmount?: number | null;
  guaranteeType?: string | null;
}) {
  const categories: Record<string, number> = {
    IT: 85,
    Osiguranje: 90,
    Konsalting: 75,
    Marketing: 70,
    "Nabavka opreme": 60,
    Radovi: 35,
  };
  const score = categories[tender.category] ?? 50;

  return {
    summary: `Tender "${tender.title}" je ${score > 70 ? "visoko relevantan" : "umjereno relevantan"} za ASA CENTRAL. Radi se o javnoj nabavci iz kategorije ${tender.category} koja odgovara poslovnom profilu kompanije.`,
    keyRequirements: [
      "Minimum 3 godine iskustva u oblasti",
      "ISO sertifikacija ili ekvivalent",
      "Finansijska sposobnost - minimum godišnji prihod 200.000 KM",
      "Tehnička i stručna sposobnost",
      "Reference projekata sličnog obima",
    ],
    eligibilityCriteria: [
      "Pravna i poslovna sposobnost - izvod iz sudskog registra",
      "Porezna registracija - uvjerenje o izmirenim porezima",
      "Poreska kartica i PDV broj",
      "Izjava o nekažnjavanju",
    ],
    risks: [
      { risk: "Visoka konkurencija na tržištu", severity: "medium" },
      { risk: "Kratki rok za pripremu ponude", severity: score > 75 ? "low" : "medium" },
      { risk: "Administrativni zahtjevi", severity: "low" },
    ],
    opportunities: [
      "Strateška pozicija ASA GROUP grupe",
      "Dugogodišnje iskustvo u sektoru",
      "Stabilna finansijska osnova",
    ],
    redFlags: score < 50 ? ["Tender nije u core poslovnoj aktivnosti"] : [],
    estimatedWorkload: "2-3 sedmice, 2-3 osobe",
    suggestedApproach: `Preporučuje se formiranje tima koji će uključiti eksperte iz ${tender.category} oblasti. Potrebno je detaljno analizirati tehničke specifikacije i pripremiti konkurentnu ponudu koja ističe prednosti ASA CENTRAL-a.`,
    relevanceScore: score,
    relevanceTags: [tender.category, "ASA GROUP", "Javne nabavke BiH"],
    competitionLevel: score > 80 ? "high" : score > 60 ? "medium" : "low",
    successProbability: Math.round(score * 0.7),
    insuranceRelevance: `ASA CENTRAL kao vodeće osiguravajuće društvo u BiH ${score > 70 ? "ima direktne kapacitete" : "može se uključiti"} u realizaciju ovog tendera kroz svoju mrežu od 121 poslovnice i 500+ zaposlenika.`,
    requiredDocs: [
      "Ponudbeni obrazac",
      "Izjava o nekažnjavanju",
      "Uvjerenje o plaćenim porezima",
      "Izvod iz sudskog registra",
      "Finansijski izvještaji za 2 godine",
      "Reference lista",
      "Garancija za ozbiljnost ponude",
    ],
    participationConditions: {
      financial: "Minimalni godišnji prihod 200.000 KM za posljednje 2 godine",
      technical: "Minimum 3 projekta sličnog obima u posljednje 3 godine",
      legal: "Registracija u sudski registar, PDV broj, uvjerenje o nekažnjavanju",
      experience: "Reference i sertifikati relevantni za oblast nabavke",
    },
    requiredDeclarations: [
      "Izjava o nekažnjavanju (čl. 45. ZJN)",
      "Izjava o izmirenim direktnim i indirektnim porezima",
      "Izjava o poslovnoj sposobnosti (čl. 46. ZJN)",
      "Izjava o prihvatanju uslova tendera",
    ],
    awardAnalysis: tender.awardCriteria
      ? `Kriterij dodjele: ${tender.awardCriteria}. Ponuđači trebaju optimizirati ponudu prema navedenim kriterijima.`
      : "Kriterij dodjele nije specificiran. Vjerovatno najniža cijena.",
    guaranteeInfo: tender.guaranteeAmount
      ? `Garancija za ozbiljnost ponude: ${tender.guaranteeAmount} KM (${tender.guaranteeType || "bankarska garancija"}). Obavezno priložiti uz ponudu.`
      : "Garancija za ozbiljnost ponude nije navedena.",
    estimatedPrepTime: "3-5 dana",
  };
}

export async function analyzeTender(tender: {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  contractingAuth: string;
  estimatedValue?: number | null;
  currency: string;
  deadline: Date;
  questionsDeadline?: Date | null;
  entity: string;
  tenderType: string;
  hasEAuction?: boolean;
  awardCriteria?: string | null;
  awardCriteriaDetails?: string | null;
  guaranteeAmount?: number | null;
  guaranteeType?: string | null;
  tenderPreparationCost?: number | null;
  cpvCodes?: string[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn("ANTHROPIC_API_KEY not set, using mock analysis");
    return getMockAnalysis(tender);
  }

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `Analiziraj ovaj tender iz BiH portala javnih nabavki i izvuci sve ključne informacije.

TENDER PODACI:
Naziv: ${tender.title}
Ugovorni organ: ${tender.contractingAuth}
Datum roka za pitanja: ${tender.questionsDeadline ? tender.questionsDeadline.toLocaleDateString("bs-BA") : "Nije navedeno"}
Rok za prijem ponuda: ${tender.deadline.toLocaleDateString("bs-BA")}
Procijenjena vrijednost: ${tender.estimatedValue ? `${tender.estimatedValue.toLocaleString("bs-BA")} ${tender.currency}` : "Nije navedena"}
Kriterij dodjele: ${tender.awardCriteria || "Nije navedeno"}
Detalji kriterija: ${tender.awardCriteriaDetails || "Nisu navedeni"}
Troškovi pripreme ponude: ${tender.tenderPreparationCost ? `${tender.tenderPreparationCost} ${tender.currency}` : "Nisu navedeni"}
Garancija: ${tender.guaranteeAmount ? `${tender.guaranteeAmount} ${tender.currency} (${tender.guaranteeType || ""})` : "Nije navedena"}
E-aukcija: ${tender.hasEAuction ? "DA" : "NE"}
CPV kategorija: ${tender.cpvCodes?.join(", ") || tender.category}
Entitet: ${tender.entity}
Opis: ${tender.description || "Nije dostupan"}

Odgovori ISKLJUČIVO u JSON formatu (bez Markdown):
{
  "summary": "Kratki sažetak tendera (2-3 rečenice)",
  "relevanceScore": 75,
  "relevanceTags": ["tag1", "tag2"],
  "competitionLevel": "high|medium|low",
  "successProbability": 60,
  "insuranceRelevance": "Objašnjenje relevantnosti za osiguravajuću kuću",
  "keyRequirements": ["zahtjev 1", "zahtjev 2"],
  "eligibilityCriteria": ["kriterij 1", "kriterij 2"],
  "risks": [{"risk": "opis rizika", "severity": "high|medium|low"}],
  "opportunities": ["prilika 1", "prilika 2"],
  "redFlags": ["crvena zastavica 1"],
  "estimatedWorkload": "2-3 sedmice, 2-3 osobe",
  "suggestedApproach": "Preporučeni pristup pripremi ponude",
  "requiredDocs": ["dokument 1", "dokument 2"],
  "participationConditions": {
    "financial": "finansijski uslovi učešća",
    "technical": "tehnički uslovi",
    "legal": "pravni uslovi / izjave",
    "experience": "reference / iskustvo"
  },
  "requiredDeclarations": ["Izjava o nekažnjavanju (čl. 45)", "Izjava o izmirenim porezima"],
  "awardAnalysis": "Analiza kriterija dodjele i kako optimizirati ponudu",
  "guaranteeInfo": "Informacije o garancijama koje trebaju biti dostavljene",
  "estimatedPrepTime": "3-5 dana"
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error({ err }, "AI analysis failed, using mock");
    return getMockAnalysis(tender);
  }
}

export async function chatAboutTender(
  tender: { id: string; title: string; description?: string | null; category: string },
  analysis: {
    summary: string;
    relevanceScore: number;
    keyRequirements: string[];
    requiredDocs: string[];
  } | null,
  message: string,
  history: Array<{ role: string; content: string }>
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return `Trenutno AI chat nije dostupan (ANTHROPIC_API_KEY nije konfigurisan). 

Tender: **${tender.title}**
Kategorija: ${tender.category}

Za aktivaciju AI chat funkcionalnosti, molimo konfigurišite ANTHROPIC_API_KEY.`;
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemContext = `${SYSTEM_PROMPT}

## Kontekst tendera:
Naziv: ${tender.title}
Kategorija: ${tender.category}
Opis: ${tender.description ?? "N/A"}
${analysis ? `AI Relevantnost: ${analysis.relevanceScore}/100
Sažetak analize: ${analysis.summary}` : ""}

Odgovaraj na bosanskom jeziku. Budi koncizan i praktičan.`;

    const messages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemContext,
      messages,
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");
    return content.text;
  } catch (err) {
    logger.error({ err }, "AI chat failed");
    return "Došlo je do greške u AI komunikaciji. Molimo pokušajte ponovo.";
  }
}
