import { Document, Packer, Paragraph, Table, TableRow, TableCell, 
         TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";

export async function generateOfferDocument(tender: any): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // HEADER — ASA Central logo tekst i info
        new Paragraph({
          children: [new TextRun({ 
            text: "ASA CENTRAL OSIGURANJE D.D. SARAJEVO",
            bold: true, size: 28
          })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ 
            text: "RADNI NACRT — NIJE ZA PREDAJU",
            size: 20, color: "666666"
          })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: "Provjerite specifikaciju, cijenu, podatke ponuđača, potpisnika i izvorne obrasce. Nacrt ne potvrđuje ispunjenost uslova." }), // draft notice

        // PODACI O TENDERU
        new Paragraph({
          text: "PODACI O TENDERU",
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "Naziv: ", bold: true }),
            new TextRun({ text: tender.title || "" })
          ]
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "Ugovorni organ: ", bold: true }),
            new TextRun({ text: tender.contractingAuth || "" })
          ]
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "Rok za predaju: ", bold: true }),
            new TextRun({ 
              text: tender.deadline 
                ? new Date(tender.deadline).toLocaleDateString('bs-BA')
                : "N/A"
            })
          ]
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "Procijenjena vrijednost: ", bold: true }),
            new TextRun({ 
              text: tender.estimatedValue 
                ? `${tender.estimatedValue.toLocaleString('bs-BA')} KM`
                : "N/A"
            })
          ]
        }),
        new Paragraph({ text: "" }),

        // PONUDA ASA CENTRAL
        new Paragraph({
          text: "PONUDA ASA CENTRAL OSIGURANJE",
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "Iznos iz interne kalkulacije (provjeriti i odobriti): ", bold: true }),
            new TextRun({ 
              text: tender.calculatedPrice 
                ? `${tender.calculatedPrice.toLocaleString('bs-BA')} KM`
                : "_____________________ KM"
            })
          ]
        }),
        new Paragraph({ text: "" }),

        new Paragraph({ text: "" }),

        // POTPIS
        new Paragraph({
          text: "Sarajevo, " + new Date().toLocaleDateString('bs-BA'),
          alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
          children: [new TextRun({ 
            text: "ASA Central Osiguranje d.d. Sarajevo",
            bold: true
          })],
          alignment: AlignmentType.RIGHT
        })
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

