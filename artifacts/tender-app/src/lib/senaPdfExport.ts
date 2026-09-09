import { jsPDF } from "jspdf";

export interface SenaPdfData {
  tenderId: string;
  title: string;
  noticeNumber?: string;
  contractingAuth: string;
  estimatedValue?: number | null;
  currency?: string;
  deadline?: string | null;
  chancePct: number | null;
  confidence: string;
  confidenceLabel: string;
  decisionRecommendation: string;
  decisionLabel: string;
  decisionReason: string;
  currentDecision?: string; // "go" | "no_go" | null
  recordedReason?: string;
  recordedBy?: string;
  priceRange?: {
    min: number;
    median: number;
    max: number;
    sampleCount: number;
    recommended: {
      aggressive: { amount: number; discountPct: number; label: string; desc: string };
      market: { amount: number; discountPct: number; label: string; desc: string };
      conservative: { amount: number; discountPct: number; label: string; desc: string };
    };
  } | null;
  signals: {
    positive: { title: string; description: string; source: string }[];
    risks: { title: string; description: string; source: string }[];
  };
  pillars: {
    compliance: { question: string; verdict: string; details: string[] };
    buyer: { question: string; verdict: string; details: string[] };
    competition: { question: string; verdict: string; details: string[] };
    investment: { question: string; verdict: string; details: string[] };
  };
}

export function exportSenaOnePagerPdf(data: SenaPdfData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const money = (val?: number | null) =>
    val ? new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val) + " KM" : "—";

  // HEADER BANNER
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ASA INTELLIGENCE · JEDNOSTRANI MEMORANDUM ZA UPRAVU", margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Podaci od 2014. · Svaka procjena ima naveden izvor · ASA CENTRAL Osiguranje", margin, 18);
  doc.text(new Date().toLocaleDateString("bs-BA"), pageWidth - margin - 20, 18);

  let y = 30;

  // OSNOVNI PODACI O NABAVCI
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const splitTitle = doc.splitTextToSize(data.title, contentWidth - 45);
  doc.text(splitTitle, margin, y);

  // Status Odluke na vrhu desno
  const decisionText = data.currentDecision === "go" ? "ODLUKA: IDEMO" : data.currentDecision === "no_go" ? "ODLUKA: NE IDEMO" : "PREDLOG: ZA ODLUKU";
  const decisionBg = data.currentDecision === "go" ? [16, 185, 129] : data.currentDecision === "no_go" ? [225, 29, 72] : [245, 158, 11];
  doc.setFillColor(decisionBg[0], decisionBg[1], decisionBg[2]);
  doc.roundedRect(pageWidth - margin - 40, y - 5, 40, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(decisionText, pageWidth - margin - 20, y + 1.5, { align: "center" });

  y += (splitTitle.length * 5) + 3;

  // Meta traka: Naručilac, Broj obavještenja, Vrijednost, Rok
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, "FD");

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("UGOVORNI ORGAN:", margin + 4, y + 5);
  doc.text("BROJ OBAVJEŠTENJA:", margin + 65, y + 5);
  doc.text("PROC. VRIJEDNOST:", margin + 115, y + 5);
  doc.text("ROK ZA PONUDE:", margin + 150, y + 5);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(data.contractingAuth, 58)[0] || "—", margin + 4, y + 10);
  doc.text(data.noticeNumber || "—", margin + 65, y + 10);
  doc.text(money(data.estimatedValue), margin + 115, y + 10);
  doc.text(data.deadline ? new Date(data.deadline).toLocaleDateString("bs-BA") : "Nije objavljen", margin + 150, y + 10);

  y += 18;

  // 3 KOLONE: ŠANSA, PREPORUČENE PONUDE, HISTORIJA
  const colW = (contentWidth - 6) / 3;

  // Kolona 1: Šansa
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, colW, 36, 1.5, 1.5, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("01 PROCJENA ŠANSE", margin + 4, y + 6);
  doc.setFontSize(22);
  if (data.chancePct !== null && data.chancePct >= 65) {
    doc.setTextColor(16, 185, 129); // emerald
  } else if (data.chancePct !== null && data.chancePct >= 40) {
    doc.setTextColor(217, 119, 6); // amber
  } else {
    doc.setTextColor(100, 116, 139); // slate
  }
  doc.text(data.chancePct !== null ? `${data.chancePct}%` : "—", margin + 4, y + 18);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Pouzdanost: ${data.confidenceLabel}`, margin + 4, y + 23);
  const reasonLines = doc.splitTextToSize(data.decisionReason, colW - 8);
  doc.text(reasonLines.slice(0, 2), margin + 4, y + 28);

  // Kolona 2: 3 Preporučene Ponude
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + colW + 3, y, colW, 36, 1.5, 1.5, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("02 TRI PREPORUČENE PONUDE", margin + colW + 7, y + 6);

  if (data.priceRange?.recommended) {
    const rec = data.priceRange.recommended;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Agresivna:", margin + colW + 7, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text(`${money(rec.aggressive.amount)} (-${rec.aggressive.discountPct}%)`, margin + colW + 27, y + 13);

    doc.setFont("helvetica", "normal");
    doc.text("Preporučena:", margin + colW + 7, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`${money(rec.market.amount)} (-${rec.market.discountPct}%)`, margin + colW + 27, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Konzervativna:", margin + colW + 7, y + 27);
    doc.setFont("helvetica", "bold");
    doc.text(`${money(rec.conservative.amount)} (-${rec.conservative.discountPct}%)`, margin + colW + 27, y + 27);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Uzorak: ${data.priceRange.sampleCount} ranijih dodjela`, margin + colW + 7, y + 33);
  } else {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("Nema dovoljno ranijih dodjela", margin + colW + 7, y + 18);
  }

  // Kolona 3: Odluka i Potpis
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + (colW * 2) + 6, y, colW, 36, 1.5, 1.5, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("03 POTVRDA ODLUKE UPRAVE", margin + (colW * 2) + 10, y + 6);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Evidentirao: ${data.recordedBy || "Tim za tendere"}`, margin + (colW * 2) + 10, y + 13);
  doc.text(`Status: ${data.currentDecision ? (data.currentDecision === "go" ? "ODOBRENO UČEŠĆE" : "ODBIJENO UČEŠĆE") : "NA ČEKANJU"}`, margin + (colW * 2) + 10, y + 18);

  doc.setDrawColor(148, 163, 184);
  doc.line(margin + (colW * 2) + 10, y + 29, margin + (colW * 2) + colW - 6, y + 29);
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Potpis / Parafa odgovorne osobe", margin + (colW * 2) + 10, y + 33);

  y += 41;

  // 4 STUBA ANALIZE (01 Podudarnost, 02 Kupac, 03 Konkurencija, 04 Ulaganje)
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ČETIRI STUBA ANALIZE (METODOLOGIJA SENA.BA)", margin, y);
  y += 3;

  const pillarW = (contentWidth - 6) / 2;
  const pillarsList = [
    { num: "01", name: "Podudarnost", p: data.pillars.compliance },
    { num: "02", name: "Kupac", p: data.pillars.buyer },
    { num: "03", name: "Konkurencija", p: data.pillars.competition },
    { num: "04", name: "Ulaganje", p: data.pillars.investment },
  ];

  for (let i = 0; i < pillarsList.length; i++) {
    const item = pillarsList[i];
    const px = margin + (i % 2 === 0 ? 0 : pillarW + 6);
    const py = y + (Math.floor(i / 2) * 25);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(px, py, pillarW, 22, 1, 1, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.num} ${item.name}`, px + 3, py + 5);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ishod: ${item.p.verdict}`, px + pillarW - 25, py + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const q = doc.splitTextToSize(item.p.question, pillarW - 6);
    doc.text(q.slice(0, 1), px + 3, py + 10);

    const det = item.p.details[0] || "—";
    const dLine = doc.splitTextToSize(`• ${det}`, pillarW - 6);
    doc.text(dLine.slice(0, 2), px + 3, py + 15);
  }

  y += 55;

  // POZITIVNI SIGNALI (+) & RIZICI (!) SA TAČNIM CITATIMA
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DOKAZANI SIGNALI I RIZICI SA IZVORIMA IZ DOKUMENTACIJE", margin, y);
  y += 4;

  const sigW = (contentWidth - 6) / 2;

  // Pozitivni signali
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, sigW, 46, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text("+ POZITIVNI SIGNALI", margin + 4, y + 6);

  let sy = y + 12;
  const pos = data.signals.positive.slice(0, 3);
  if (pos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text("Nema posebnih pozitivnih signala u bazi.", margin + 4, sy);
  } else {
    for (const s of pos) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text(`• ${s.title}`, margin + 4, sy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(s.description, sigW - 8);
      doc.text(descLines.slice(0, 1), margin + 4, sy + 4);
      doc.setTextColor(148, 163, 184);
      doc.text(`Izvor: ${s.source}`, margin + 4, sy + 8);
      sy += 11;
    }
  }

  // Rizici
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(margin + sigW + 6, y, sigW, 46, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text("! RIZICI I PREPREKE", margin + sigW + 10, y + 6);

  let ry = y + 12;
  const risks = data.signals.risks.slice(0, 3);
  if (risks.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text("Nisu utvrđeni kritični rizici u tenderskoj dokumentaciji.", margin + sigW + 10, ry);
  } else {
    for (const r of risks) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(159, 18, 57);
      doc.text(`• ${r.title}`, margin + sigW + 10, ry);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(r.description, sigW - 8);
      doc.text(descLines.slice(0, 1), margin + sigW + 10, ry + 4);
      doc.setTextColor(148, 163, 184);
      doc.text(`Izvor: ${r.source}`, margin + sigW + 10, ry + 8);
      ry += 11;
    }
  }

  y += 50;

  // FOOTER DISCLAIMER
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("SENA.BA METODOLOGIJA: Svaka procjena temelji se isključivo na provjerenim izvorima iz EJN-a i tenderske dokumentacije.", margin, y);
  doc.text("Obrazac je signal za oprez prije pripreme — ne optužba. Dokument generisan iz sistema Tender Manager AI.", margin, y + 3.5);

  const cleanFilename = `ASA_Memorandum_${(data.noticeNumber || data.tenderId).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(cleanFilename);
}
