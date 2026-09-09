import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

/** Produces a review draft; company facts and legal declarations must come from approved source forms. */
export async function generateDocx(type: string, tender: any): Promise<Buffer> {
  const labels: Record<string, string> = { "full-bid": "Nacrt ponude", clan45: "Radni prilog — provjera izjave (oznaka 45)", clan46: "Radni prilog — provjera izjave (oznaka 46)", clan50: "Radni prilog — provjera izjave (oznaka 50)" };
  if (!labels[type]) throw new Error("Nepoznata vrsta nacrta.");
  const fact = (label: string, value: unknown) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(String(value ?? "[DOPUNITI / PROVJERITI]"))] });
  return Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ text: "RADNI NACRT — NIJE ZA PREDAJU", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: labels[type], heading: HeadingLevel.HEADING_2 }),
    new Paragraph("Prije potpisivanja koristiti obrazac iz konkretne tenderske dokumentacije. Ovaj nacrt ne potvrđuje pravnu osnovu, sadržaj izjave ili ispunjenost uslova."),
    fact("Predmet nabavke", tender.title), fact("Ugovorni organ", tender.contractingAuth), fact("Referentni broj", tender.externalId),
    fact("Puni naziv ponuđača", "[DOPUNITI PREMA REGISTRU]"), fact("JIB i adresa", "[DOPUNITI PREMA REGISTRU]"),
    fact("Ovlašteni potpisnik", "[IME, FUNKCIJA I OSNOV OVLAŠTENJA]"),
    fact("Oznaka i stranica izvornog obrasca", "[DOPUNITI IZ DOKUMENTACIJE]"),
    fact("Tekst izjave / specifikacija ponude", "[PREUZETI IZ IZVORNOG OBRASCA I PROVJERITI DOKAZE]"),
    ...(type === "full-bid" ? [fact("Cijena ponude, popust i porezni tretman", "[DOPUNITI NAKON INTERNOG ODOBRENJA KALKULACIJE]")] : []),
    fact("Potrebni dokazi i prilozi", "[POPIS IZ IZVORNOG OBRASCA]"), fact("Interna kontrola", "[PREGLEDAO / DATUM / NAPOMENE]"),
    fact("Mjesto, datum, potpis i ovjera", "[DOPUNITI NAKON PROVJERE]"),
  ] }] }));
}
