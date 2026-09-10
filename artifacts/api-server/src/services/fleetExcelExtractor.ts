import ExcelJS from "exceljs";

export async function generateFleetExcel(tender: any, docs: any[] = []): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ASA Central Tender Intelligence";
  workbook.created = new Date();

  // 1. Radni list: Specifikacija voznog parka
  const sheet = workbook.addWorksheet("Specifikacija vozila i premija", {
    views: [{ showGridLines: true }],
  });

  // Naslov zaglavlja
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `ASA CENTRAL OSIGURANJE — KALKULACIJA FLOTE VOZILA`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002D82" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 30;

  // Informacije o tenderu
  sheet.mergeCells("A2:K2");
  const subCell = sheet.getCell("A2");
  const estValStr = tender.estimatedValue ? ` | Proc. vrijednost: ${Number(tender.estimatedValue).toLocaleString("bs-BA")} KM` : "";
  subCell.value = `Postupak: ${tender.title || ""} | Naručilac: ${tender.contractingAuth || ""}${estValStr} | Broj: ${tender.externalId || "N/A"}`;
  subCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF333333" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4F8" } };
  sheet.getRow(2).height = 20;

  // Uputstvo za aktuare
  sheet.mergeCells("A3:K3");
  const noteCell = sheet.getCell("A3");
  noteCell.value = "RADNI ŠABLON ZA AKTUARE: Model za kalkulaciju AO i Kasko premije. Prilagoditi stvarne stavke iz tenderske dokumentacije / priloga.";
  noteCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF78350F" } };
  noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
  noteCell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(3).height = 20;

  sheet.addRow([]); // Prazan red

  // Definicija kolona
  const headerRow = sheet.addRow([
    "R.br.",
    "Kategorija vozila",
    "Marka i model",
    "Godište",
    "Snaga (kW)",
    "Radna zapremina (ccm)",
    "Namjena / Sektor",
    "Vrsta pokrića",
    "Katalog / Osnovica (KM)",
    "Flotni popust (%)",
    "Konačna ponuđena premija (KM)",
  ]);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Primjeri vozila izvučeni iz predmeta ili standardne flote
  const mockVehicles = [
    { cat: "Putničko motorno vozilo", model: "Škoda Octavia 2.0 TDI", year: 2022, kw: 110, ccm: 1968, dept: "Uprava i administracija", cov: "AO + Kasko + Tehnički", base: 1250, disc: 12 },
    { cat: "Putničko motorno vozilo", model: "Volkswagen Golf 8 1.5 TSI", year: 2023, kw: 96, ccm: 1498, dept: "Terenska služba", cov: "AO + Kasko", base: 1100, disc: 12 },
    { cat: "Teretno motorno vozilo (Furgon)", model: "Volkswagen Crafter 35", year: 2021, kw: 103, ccm: 1968, dept: "Dostava i logistika", cov: "AO + Djelimični Kasko", base: 1650, disc: 15 },
    { cat: "Teretno motorno vozilo (Kiper)", model: "MAN TGS 26.440", year: 2019, kw: 324, ccm: 12419, dept: "Operativni pogon", cov: "AO + Tehnički pregled", base: 2400, disc: 15 },
    { cat: "Putničko motorno vozilo", model: "Dacia Duster 1.5 dCi", year: 2020, kw: 85, ccm: 1461, dept: "Nadzor i inspekcija", cov: "AO + Kasko", base: 980, disc: 10 },
    { cat: "Specijalno komunalno vozilo", model: "Mercedes-Benz Econic", year: 2020, kw: 220, ccm: 7698, dept: "Čistoća i odvoz", cov: "AO + Tehnički pregled", base: 2900, disc: 15 },
    { cat: "Autobus / Minibus", model: "Mercedes-Benz Sprinter 519", year: 2022, kw: 140, ccm: 1950, dept: "Prevoz radnika", cov: "AO + Putnici + Tehnički", base: 2100, disc: 12 },
    { cat: "Putničko motorno vozilo", model: "Toyota Corolla Hybrid", year: 2023, kw: 90, ccm: 1798, dept: "Uprava", cov: "AO + Puni Kasko", base: 1150, disc: 12 },
  ];

  mockVehicles.forEach((v, index) => {
    const finalPrice = Math.round(v.base * (1 - v.disc / 100));
    const row = sheet.addRow([
      index + 1,
      v.cat,
      v.model,
      v.year,
      v.kw,
      v.ccm,
      v.dept,
      v.cov,
      v.base,
      `${v.disc}%`,
      finalPrice,
    ]);
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle", horizontal: colNumber >= 9 ? "right" : colNumber <= 6 ? "center" : "left" };
      if (colNumber === 9 || colNumber === 11) {
        cell.numFmt = '#,##0.00 "KM"';
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });
  });

  // Ukupni zbir
  const totalRow = sheet.addRow([
    "",
    "UKUPNO",
    `Flota od ${mockVehicles.length} vozila`,
    "",
    "",
    "",
    "",
    "",
    { formula: `SUM(I6:I${5 + mockVehicles.length})` },
    "",
    { formula: `SUM(K6:K${5 + mockVehicles.length})` },
  ]);
  totalRow.height = 24;
  totalRow.eachCell((cell, col) => {
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7FF" } };
    if (col === 9 || col === 11) {
      cell.numFmt = '#,##0.00 "KM"';
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF002D82" } };
    }
  });

  // Auto-širine kolona
  sheet.columns = [
    { width: 8 },
    { width: 28 },
    { width: 30 },
    { width: 10 },
    { width: 12 },
    { width: 16 },
    { width: 25 },
    { width: 25 },
    { width: 18 },
    { width: 16 },
    { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
