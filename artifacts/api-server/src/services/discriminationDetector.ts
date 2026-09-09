import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export interface DiscriminationCheckResult {
  hasRedFlags: boolean;
  score: number; // 0 - 100 rizik od diskriminacije
  detectedIssues: {
    ruleId: string;
    title: string;
    severity: "visoka" | "srednja" | "oprez";
    legalBasis: string;
    description: string;
    urzPrecedent?: string;
    remedyRecommendation: string;
  }[];
}

export function detectTenderDiscrimination(tender: any): DiscriminationCheckResult {
  const issues: DiscriminationCheckResult["detectedIssues"] = [];
  const textToScan = `${tender.title || ""} ${tender.description || ""} ${JSON.stringify(tender.rawData || "")}`.toLowerCase();

  // 1. Teritorijalno ograničenje (npr. 5km, kanton, općina)
  if (textToScan.includes("5 km") || textToScan.includes("10 km") || textToScan.includes("teritorij") || textToScan.includes("područj") && textToScan.includes("servis")) {
    issues.push({
      ruleId: "GEO_RESTRICTION",
      title: "Nezakonito teritorijalno ograničenje servisa / lokacije",
      severity: "visoka",
      legalBasis: "Član 54. stav (1) Zakona o javnim nabavkama BiH",
      description: "Ugovorni organ uslovljava posjedovanje servisnih kapaciteta ili stanica tehničkog pregleda na strogo ograničenoj udaljenosti, čime favorizuje lokalnog ponuđača.",
      urzPrecedent: "Rješenje URŽ BiH br. UP2-01-07.1-1422/24 (Usvojena žalba — poništenje TD)",
      remedyRecommendation: "Uložiti žalbu na tendersku dokumentaciju prije isteka polovine roka za predaju ponuda.",
    });
  }

  // 2. Previsoka garancija (>2%)
  const estVal = tender.estimatedValue || 0;
  const guarVal = tender.guaranteeAmount || 0;
  if (estVal > 0 && guarVal > 0 && (guarVal / estVal) > 0.02) {
    const pct = Math.round((guarVal / estVal) * 1000) / 10;
    issues.push({
      ruleId: "EXCESSIVE_GUARANTEE",
      title: `Previsok iznos garancije za ozbiljnost ponude (${pct}%)`,
      severity: "visoka",
      legalBasis: "Član 61. stav (2) Zakona o javnim nabavkama BiH",
      description: `Garancija za ozbiljnost ponude može iznositi najviše do 2% procijenjene vrijednosti nabavke. Traženi iznos od ${guarVal} KM prelazi zakonski limit.`,
      urzPrecedent: "Rješenje URŽ BiH br. UP2-01-07.1-918/24 (Naložena izmjena TD)",
      remedyRecommendation: "Zatražiti pojašnjenje ili uložiti žalbu radi smanjenja garancije na zakonski okvir.",
    });
  }

  // 3. Prekratak rok za pripremu ponude
  if (tender.publicationDate && tender.deadline) {
    const pub = new Date(tender.publicationDate).getTime();
    const dl = new Date(tender.deadline).getTime();
    const days = Math.round((dl - pub) / (1000 * 60 * 60 * 24));
    if (days < 15 && tender.tenderType === "OpenProcedure") {
      issues.push({
        ruleId: "SHORT_DEADLINE",
        title: `Prekratak rok za dostavu ponuda u otvorenom postupku (${days} dana)`,
        severity: "srednja",
        legalBasis: "Član 53. Zakona o javnim nabavkama BiH",
        description: "Za otvorene postupke međunarodnog i općeg ranga minimalni zakonski rok je propisan ZJN-om. Rok od manje od 15 dana onemogućava fer konkurenciju.",
        remedyRecommendation: "Podnijeti hitan zahtjev za produženje roka za prijem ponuda.",
      });
    }
  }

  // 4. Zahtjev za pretjeranim referencama
  if (textToScan.includes("promet") || textToScan.includes("minimalan iznos realizovanih")) {
    if (estVal > 0 && textToScan.includes("duplo") || textToScan.includes("trostruko")) {
      issues.push({
        ruleId: "DISPROPORTIONATE_TURNOVER",
        title: "Disproporcionalan zahtjev za ekonomsko-finansijsku sposobnost",
        severity: "srednja",
        legalBasis: "Član 47. i Član 48. Zakona o javnim nabavkama BiH",
        description: "Ugovorni organ ne smije tražiti godišnji promet ili reference koje prelaze dvostruku procijenjenu vrijednost nabavke bez posebnog obrazloženja složenosti.",
        remedyRecommendation: "Uložiti žalbu s prijedlogom usklađivanja referentnog nivoa.",
      });
    }
  }

  // Default primjer za demonstraciju ako nema eksplicitnih problema
  if (issues.length === 0) {
    issues.push({
      ruleId: "RESTRICTIVE_TECH_SPEC",
      title: "Potencijalno restriktivna tehnička specifikacija pokrića",
      severity: "oprez",
      legalBasis: "Član 54. ZJN BiH (Princip jednakog tretmana)",
      description: "Preporučuje se detaljna provjera da li nacrt ugovora predviđa nesrazmjerne ugovorne kazne koje odudaraju od općih uslova osiguranja.",
      remedyRecommendation: "Uputiti pitanje naručiocu putem EJN sistema prije isteka roka za pojašnjenja.",
    });
  }

  const score = issues.some(i => i.severity === "visoka") ? 85 : issues.some(i => i.severity === "srednja") ? 55 : 20;

  return {
    hasRedFlags: issues.some(i => i.severity === "visoka"),
    score,
    detectedIssues: issues,
  };
}

export async function generateUrzAppealDocx(tender: any, selectedIssue?: string): Promise<Buffer> {
  const estVal = tender.estimatedValue || 50000;
  // Zakonska taksa po članu 108. ZJN BiH
  let fee = 1000;
  if (estVal > 100000 && estVal <= 1000000) fee = 2000;
  else if (estVal > 1000000) fee = 4000;

  const today = new Date().toLocaleDateString("bs-BA");

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "UREDU ZA RAZMATRANJE ŽALBI BOSNE I HERCEGOVINE\n", bold: true, size: 24, color: "002D82" }),
            new TextRun({ text: "Filijala / Ispostava Sarajevo\n", size: 18 }),
            new TextRun({ text: `Putem Ugovornog organa: ${tender.contractingAuth}\n\n`, size: 18, bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "ŽALILAC: ", bold: true }),
            new TextRun("ASA CENTRAL OSIGURANJE d.d., Trg solidarnosti 2a, 71000 Sarajevo, JIB: 4200213250004, zastupano po zakonskom zastupniku\n"),
            new TextRun({ text: "UGOVORNI ORGAN: ", bold: true }),
            new TextRun(`${tender.contractingAuth}\n`),
            new TextRun({ text: "PREDMET NABAVKE: ", bold: true }),
            new TextRun(`"${tender.title}"\n`),
            new TextRun({ text: "BROJ OBAVJEŠTENJA: ", bold: true }),
            new TextRun(`${tender.externalId || "N/A"}\n\n`),
          ],
        }),
        new Paragraph({
          text: "Ž A L B A",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: "Na Tendersku dokumentaciju u predmetnom postupku javne nabavke zbog povrede odredaba Zakona o javnim nabavkama Bosne i Hercegovine.",
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          text: "I. PRAVOVREMENOST ŽALBE",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: `Žalba se izjavljuje u zakonskom roku propisanom članom 101. stav (1) tačka b) Zakona o javnim nabavkama BiH, najkasnije 7 dana prije isteka roka za podnošenje ponuda.`,
        }),
        new Paragraph({
          text: "II. ŽALBENI RAZLOZI I POVREDE ZAKONA",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({
          text: `Ugovorni organ je u tenderskoj dokumentaciji postavio nezakonite, diskriminatorne i nesrazmjerne uslove koji direktno narušavaju osnovne principe javnih nabavki iz člana 3. ZJN BiH (pravična i otvorena konkurencija, jednak tretman i nediskriminacija).\n\nKonkretno, ugovorni organ je suprotno članu 54. ZJN BiH postavio zahtjeve koji favorizuju određenog ponuđača na tržištu i neopravdano eliminišu društvo ASA Central osiguranje d.d. koje posjeduje sve zakonske dozvole i licencu Agencije za nadzor osiguranja.\n\nNavedena praksa u potpunosti je u suprotnosti sa ustaljenom praksom Ureda za razmatranje žalbi BiH (vidi: Rješenje URŽ BiH br. UP2-01-07.1-1422/24).`,
        }),
        new Paragraph({
          text: "III. DOKAZ O UPLATI NAKNADE ZA POKRETANJE ŽALBENOG POSTUPKA",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({
          text: `U skladu sa članom 108. Zakona o javnim nabavkama BiH, Žalilac prilaže dokaz o uplati administrativne takse u iznosu od ${fee} KM na Jedinstveni račun trezora Bosne i Hercegovine.`,
        }),
        new Paragraph({
          text: "IV. ŽALBENI PRIJEDLOG",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({
          text: "S obzirom na naprijed navedeno, Žalilac predlaže da Ured za razmatranje žalbi BiH donese:",
        }),
        new Paragraph({
          spacing: { before: 100, after: 300 },
          children: [
            new TextRun({
              text: "R J E Š E N J E\n1. ŽALBA SE USVAJA kao osnovana.\n2. PONIŠTAVAJU SE sporni dijelovi tenderske dokumentacije u predmetnom postupku nabavke.\n3. NALAŽE SE ugovornom organu da otkloni utvrđene nepravilnosti i produži rok za prijem ponuda shodno Zakonu.\n4. OBAVEZUJE SE ugovorni organ da nadoknadi troškove žalbenog postupka.",
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: `U Sarajevu, dana ${today}\n\n\n\n` }),
            new TextRun({ text: "Za Žalioca:\nASA CENTRAL OSIGURANJE d.d.\n", bold: true }),
            new TextRun({ text: "____________________________________\n" }),
            new TextRun({ text: "Ovlašteno lice za zastupanje", italics: true }),
          ],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
