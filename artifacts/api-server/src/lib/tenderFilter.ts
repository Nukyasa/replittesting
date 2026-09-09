/**
 * Checks if a tender is actually related to insurance services.
 * Filters out general procurements (like office supplies, IT equipment, telephony)
 * that happen to mention a pension or health insurance fund in the title.
 */
export function isRealInsuranceTender(title: string, categoryName: string): boolean {
  const t = title.toLowerCase();
  const cat = categoryName.toLowerCase();
  if (/^(kupovina|iznajmljivanje|lizing|radovi)$/i.test(cat) || /(?:сс|ss|signaln|сигналн).{0,15}(?:osiguranj|осигура)/i.test(t)) return false;

  // 1. Exclude list: stem-based exclusions to handle Slavic grammatical cases
  const excludeStems = [
    "uredsk", "kancelarij", "potrošn", "potrosn", "telefonsk", "cisco", "računar", "racunar", "softver", "licenc",
    "internet", "zaštitar", "zastitar", "fizičk", "fizick", "tehničk", "tehnick", "bankarsk", "kredit",
    "depozit", "račun", "racun", "garancij", "platn", "goriv", "naft", "struj", "električ", "elektric",
    "čišćenj", "ciscenj", "higijen", "održavan", "odrzavan", "poprav", "servis", "namešt", "namješt",
    "toner", "ribon", "papir", "printer", "tiskarsk", "štamp", "stamp", "klimat", "grijanj", "grejanj",
    "građevin", "gradevin", "rekonstrukcij", "sanacij", "krečenj", "krecenj", "zakup", "najam", "unajmlj"
  ];

  // 2. Strict check for insurance keywords (both Latin and Cyrillic)
  const insuranceKeywords = [
    "insurance", "osiguranje", "osiguranja", "osiguranju", "kasko", "osiguranih", "osigurane", "osiguranik", "osiguranika",
    "осигурање", "осигурања", "осигурању", "каско", "осигураних", "осигуране", "осигураник", "осигураника"
  ];

  const hasInsuranceWord = insuranceKeywords.some(kw => t.includes(kw));

  // The title MUST contain at least one insurance keyword to be considered
  if (!hasInsuranceWord) {
    return false;
  }

  // Check if it has any exclude keyword stem
  const hasExclude = excludeStems.some(stem => t.includes(stem));

  if (hasExclude) {
    // If it has both an exclude keyword and an insurance word, let's verify if it is indeed about insurance:
    // e.g. "nabavka usluga osiguranja vozila i kasko osiguranja" -> OK
    const positivePhrases = [
      "usluga osiguranja", "usluge osiguranja", "kasko osiguranje", "kolektivno osiguranje",
      "osiguranje vozila", "osiguranje imovine", "osiguranje radnika", "grupno osiguranje",
      "životno osiguranje", "zivotno osiguranje", "osiguranje zaposlenih", "osiguranje od nezgode",
      "osiguranje od odgovornosti", "osiguranje lica", "osiguranje osoba", "osiguranje motornih",
      "usluge osiguranja motornih", "usluge osiguranja imovine", "osiguranje od požara", "osiguranje od pozara",
      "услуге осигурања", "услуга осигурања", "осигурање возила", "осигурање имовине", "осигурање радника",
      "колективно осигурање", "каско осигурање"
    ];
    const hasPositivePhrase = positivePhrases.some(phrase => t.includes(phrase));
    if (!hasPositivePhrase) {
      return false;
    }
  }

  // Exclude health insurance / pension fund general procurements that do not contain actual insurance services
  if (t.includes("za potrebe zavoda") || t.includes("za potrebe federalnog zavoda") || t.includes("za potrebe javne ustanove")) {
    const positivePhrases = [
      "usluga osiguranja", "usluge osiguranja", "kasko", "osiguranje vozila", "osiguranje imovine",
      "osiguranje radnika", "osiguranje zaposlenih", "osiguranje od nezgode", "osiguranje od odgovornosti",
      "osiguranje lica", "osiguranje osoba",
      "услуге осигурања", "услуга осигурања", "осигурање возила", "осигурање имовине", "осигурање радника"
    ];
    if (!positivePhrases.some(phrase => t.includes(phrase))) {
      return false;
    }
  }

  return true;
}
