import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";
import AdmZip from "adm-zip";

interface TenderBidPackParams {
  tender: {
    id: string;
    title: string;
    contractingAuth: string;
    externalId?: string | null;
    estimatedValue?: number | null;
    currency?: string | null;
    deadline?: string | null;
    category?: string | null;
  };
  customOfferAmount?: number;
  signatoryName?: string;
  signatoryTitle?: string;
}

const ASA_COMPANY = {
  name: "ASA CENTRAL OSIGURANJE d.d.",
  address: "Trg solidarnosti 2a / Splitska 9, 71000 Sarajevo, Bosna i Hercegovina",
  jib: "4200213250004",
  pdv: "200213250004",
  regNumber: "065-0-Reg-22-003451 (Općinski sud u Sarajevu)",
  bankAccount: "1610000000000000 (Raiffeisen Bank d.d. BiH)",
  phone: "+387 33 555 555",
  email: "tenderi@asacentral.ba",
  web: "www.asacentral.ba",
  defaultSignator: "Feđa Morankić",
  defaultTitle: "Predsjednik Uprave",
};

export async function generateBidPackZip(params: TenderBidPackParams): Promise<Buffer> {
  const { tender, customOfferAmount, signatoryName, signatoryTitle } = params;
  const zip = new AdmZip();

  const finalAmount = customOfferAmount || tender.estimatedValue || 50000;
  const currency = tender.currency || "KM";
  const signName = signatoryName || ASA_COMPANY.defaultSignator;
  const signTitle = signatoryTitle || ASA_COMPANY.defaultTitle;
  const today = new Date().toLocaleDateString("bs-BA");

  // Helper za kreiranje zaglavlja dokumenta
  const createHeader = (title: string) => [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: ASA_COMPANY.name, bold: true, size: 18, color: "002D82" }),
        new TextRun({ text: `\n${ASA_COMPANY.address}`, size: 16 }),
        new TextRun({ text: `\nJIB: ${ASA_COMPANY.jib} | PDV: ${ASA_COMPANY.pdv}`, size: 16 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "_________________________________________________________________________________", color: "CCCCCC" }),
      ],
    }),
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 300 },
    }),
  ];

  // Helper za potpis
  const createSignature = () => [
    new Paragraph({ spacing: { before: 500 } }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: `Za ponuđača:\n`, bold: true }),
        new TextRun({ text: `${ASA_COMPANY.name}\n\n\n\n` }),
        new TextRun({ text: `___________________________\n`, bold: true }),
        new TextRun({ text: `${signName}\n`, bold: true }),
        new TextRun({ text: `${signTitle}` }),
      ],
    }),
  ];

  // 1. Popratni dopis
  const docCover = new Document({
    sections: [{
      children: [
        ...createHeader("POPRATNI DOPIS UZ PONUDU"),
        new Paragraph({
          children: [
            new TextRun({ text: "UGOVORNI ORGAN: ", bold: true }),
            new TextRun(tender.contractingAuth),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "PREDMET NABAVKE: ", bold: true }),
            new TextRun(tender.title),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "BROJ OBAVJEŠTENJA (EJN): ", bold: true }),
            new TextRun(tender.externalId || "N/A"),
          ],
        }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          text: `Poštovani,\n\nU skladu sa Obavještenjem o nabavci i Tenderskom dokumentacijom za navedeni postupak, dostavljamo Vam našu uredno pripremljenu, potpisanu i ovjerenu ponudu.\n\nNaša ponuda u potpunosti ispunjava sve tehničke, pravne i ekonomske uslove propisane Zakonom o javnim nabavkama BiH i Vašom tenderskom dokumentacijom.`,
        }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          children: [
            new TextRun({ text: "Ukupna ponuđena cijena bez PDV-a: ", bold: true }),
            new TextRun({ text: `${new Intl.NumberFormat("bs-BA").format(finalAmount)} ${currency}\n`, bold: true, color: "002D82" }),
            new TextRun({ text: "Rok važenja ponude: ", bold: true }),
            new TextRun("90 dana od krajnjeg roka za prijem ponuda.\n"),
            new TextRun({ text: "Prilozi: ", bold: true }),
            new TextRun("Obrazac ponude, Obrazac za cijenu, izjave po čl. 45, 47 i 52 ZJN BiH, te prateća dokazna dokumentacija."),
          ],
        }),
        ...createSignature(),
      ],
    }],
  });

  // 2. Aneks 1 - Obrazac ponude
  const docAneks1 = new Document({
    sections: [{
      children: [
        ...createHeader("ANEKS 1 — OBRAZAC ZA DOSTAVLJANJE PONUDE"),
        new Paragraph({ text: "Podaci o postupku javne nabavke:", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun({ text: "Ugovorni organ: ", bold: true }), new TextRun(tender.contractingAuth)] }),
        new Paragraph({ children: [new TextRun({ text: "Predmet nabavke: ", bold: true }), new TextRun(tender.title)] }),
        new Paragraph({ children: [new TextRun({ text: "Broj nabavke: ", bold: true }), new TextRun(tender.externalId || "N/A")] }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({ text: "Podaci o ponuđaču:", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun({ text: "Naziv: ", bold: true }), new TextRun(ASA_COMPANY.name)] }),
        new Paragraph({ children: [new TextRun({ text: "Sjedište i adresa: ", bold: true }), new TextRun(ASA_COMPANY.address)] }),
        new Paragraph({ children: [new TextRun({ text: "JIB: ", bold: true }), new TextRun(ASA_COMPANY.jib)] }),
        new Paragraph({ children: [new TextRun({ text: "PDV broj: ", bold: true }), new TextRun(ASA_COMPANY.pdv)] }),
        new Paragraph({ children: [new TextRun({ text: "Transakcijski račun: ", bold: true }), new TextRun(ASA_COMPANY.bankAccount)] }),
        new Paragraph({ children: [new TextRun({ text: "Kontakt telefon i e-mail: ", bold: true }), new TextRun(`${ASA_COMPANY.phone} | ${ASA_COMPANY.email}`)] }),
        new Paragraph({ children: [new TextRun({ text: "Ovlašteno lice: ", bold: true }), new TextRun(`${signName}, ${signTitle}`)] }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          text: `Pod punom materijalnom i krivičnom odgovornošću izjavljujemo da nudimo pružanje usluga u potpunosti u skladu sa zahtjevima iz tenderske dokumentacije za ukupnu cijenu od ${new Intl.NumberFormat("bs-BA").format(finalAmount)} ${currency} bez PDV-a.`,
        }),
        ...createSignature(),
      ],
    }],
  });

  // 3. Aneks 2 - Cijena ponude
  const docAneks2 = new Document({
    sections: [{
      children: [
        ...createHeader("ANEKS 2 — OBRAZAC ZA CIJENU PONUDE"),
        new Paragraph({ children: [new TextRun({ text: "Predmet nabavke: ", bold: true }), new TextRun(tender.title)] }),
        new Paragraph({ children: [new TextRun({ text: "Naručilac: ", bold: true }), new TextRun(tender.contractingAuth)] }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({ text: "Specifikacija finansijske ponude:", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [
            new TextRun({ text: "1. Ukupna premija / cijena usluga bez popusta: ", bold: true }),
            new TextRun(`${new Intl.NumberFormat("bs-BA").format(Math.round(finalAmount * 1.12))} ${currency}\n`),
            new TextRun({ text: "2. Komercijalni flotni popust: ", bold: true }),
            new TextRun(`${new Intl.NumberFormat("bs-BA").format(Math.round(finalAmount * 0.12))} ${currency}\n`),
            new TextRun({ text: "3. UKUPNA CIJENA PONUDE BEZ PDV-a: ", bold: true, size: 22, color: "002D82" }),
            new TextRun({ text: `${new Intl.NumberFormat("bs-BA").format(finalAmount)} ${currency}\n`, bold: true, size: 22, color: "002D82" }),
            new TextRun({ text: "(Usluge osiguranja su oslobođene plaćanja PDV-a shodno članu 25. stav 1. tačka 1. Zakona o PDV-u BiH).", italics: true }),
          ],
        }),
        ...createSignature(),
      ],
    }],
  });

  // 4. Izjava Član 45 ZJN (Nekažnjavanje)
  const docClan45 = new Document({
    sections: [{
      children: [
        ...createHeader("PISMENA IZJAVA — ČLAN 45. ZAKONA O JAVNIM NABAVKAMA"),
        new Paragraph({
          text: `Ja, niže potpisani ${signName}, u svojstvu zakonskog zastupnika privrednog društva ${ASA_COMPANY.name}, JIB: ${ASA_COMPANY.jib}, pod punom materijalnom i krivičnom odgovornošću,`,
        }),
        new Paragraph({ text: "DAJEM IZJAVU", alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          text: `da ponuđač u ovom postupku javne nabavke:\na) nije u krivičnom postupku osuđen pravosnažnom presudom za krivična djela organizovanog kriminala, korupcije, prevare ili pranja novca;\nb) nije pod stečajem ili u postupku likvidacije;\nc) je ispunio obaveze u vezi s plaćanjem penzijskog i invalidskog osiguranja i zdravstvenog osiguranja;\nd) je ispunio obaveze u vezi s plaćanjem direktnih i indirektnih poreza.\n\nOva izjava se daje u svrhu učešća u postupku javne nabavke: "${tender.title}", evidencijski broj: ${tender.externalId || "N/A"}, ugovorni organ: ${tender.contractingAuth}.`,
        }),
        ...createSignature(),
      ],
    }],
  });

  // 5. Izjava Član 47 ZJN (Ekonomska sposobnost)
  const docClan47 = new Document({
    sections: [{
      children: [
        ...createHeader("PISMENA IZJAVA — ČLAN 47. ZAKONA O JAVNIM NABAVKAMA"),
        new Paragraph({
          text: `Privredno društvo ${ASA_COMPANY.name}, JIB: ${ASA_COMPANY.jib}, sa sjedištem u Sarajevu, ovim putem potvrđuje svoju ekonomsku i finansijsku sposobnost za uredno i nesmetano izvršenje ugovora o javnoj nabavci: "${tender.title}".\n\nDruštvo posjeduje punu solventnost, stabilan koeficijent likvidnosti i deponovana garantna sredstva kod Centralne banke BiH u skladu sa Zakonom o osiguranju. Nijedan račun društva nije bio blokiran u prethodnih 12 mjeseci.`,
        }),
        ...createSignature(),
      ],
    }],
  });

  // 6. Izjava Član 52 ZJN (Sukob interesa)
  const docClan52 = new Document({
    sections: [{
      children: [
        ...createHeader("PISMENA IZJAVA — ČLAN 52. ZAKONA O JAVNIM NABAVKAMA"),
        new Paragraph({
          text: `U postupku javne nabavke: "${tender.title}", raspisane od strane: ${tender.contractingAuth},\n\nIzjavljujemo pod punom krivičnom i materijalnom odgovornošću da privredno društvo ${ASA_COMPANY.name}, kao ni lica ovlaštena za zastupanje, nisu nudila, niti će nuditi mito ili bilo kakvu drugu nezakonitu pogodnost članovima komisije za javne nabavke ili odgovornim licima ugovornog organa, te da ne postoji sukob interesa u smislu člana 52. Zakona o javnim nabavkama BiH.`,
        }),
        ...createSignature(),
      ],
    }],
  });

  // 7. Kontrolna lista prije predaje
  const docChecklist = new Document({
    sections: [{
      children: [
        ...createHeader("KONTROLNA LISTA ZA KOVERTU PONUDE"),
        new Paragraph({ text: "Verifikacija obavezne dokumentacije prije zatvaranja koverte:", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "[  ] 1. Aneks 1 — Obrazac za dostavljanje ponude (potpisan i opečaćen)" }),
        new Paragraph({ text: "[  ] 2. Aneks 2 — Obrazac za cijenu ponude (bez PDV-a za osiguranje)" }),
        new Paragraph({ text: "[  ] 3. Izjava po članu 45. ZJN BiH (ovjerena kod notara ili općine)" }),
        new Paragraph({ text: "[  ] 4. Izjava po članu 47. ZJN BiH (ekonomska sposobnost)" }),
        new Paragraph({ text: "[  ] 5. Izjava po članu 52. ZJN BiH (sukob interesa)" }),
        new Paragraph({ text: "[  ] 6. Rješenje o upisu u sudski registar sa svim izmjenama" }),
        new Paragraph({ text: "[  ] 7. Uvjerenje o registraciji obveznika PDV-a i ID broj" }),
        new Paragraph({ text: "[  ] 8. Dozvola / Rješenje Agencije za nadzor osiguranja BiH" }),
        new Paragraph({ text: "[  ] 9. Garancija za ozbiljnost ponude (ako je tražena tenderskom dokumentacijom)" }),
        new Paragraph({ text: "[  ] 10. Popratni dopis sa popisom svih uvezanih stranica i jemstvenikom" }),
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({ text: `Internu kontrolu izvršio: __________________________   Datum: ${today}` }),
      ],
    }],
  });

  // Generiši binarne buffere i dodaj u ZIP
  zip.addFile("01_Popratni_dopis_ponude.docx", await Packer.toBuffer(docCover));
  zip.addFile("02_Aneks_1_Obrazac_ponude.docx", await Packer.toBuffer(docAneks1));
  zip.addFile("03_Aneks_2_Obrazac_za_cijenu.docx", await Packer.toBuffer(docAneks2));
  zip.addFile("04_Izjava_Clan_45_ZJN_Nekaznjavanje.docx", await Packer.toBuffer(docClan45));
  zip.addFile("05_Izjava_Clan_47_ZJN_Ekonomska_sposobnost.docx", await Packer.toBuffer(docClan47));
  zip.addFile("06_Izjava_Clan_52_ZJN_Sukob_interesa.docx", await Packer.toBuffer(docClan52));
  zip.addFile("07_Kontrolna_lista_prije_kovertiranja.docx", await Packer.toBuffer(docChecklist));

  return zip.toBuffer();
}
