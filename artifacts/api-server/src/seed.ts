import { db } from "@workspace/db";
import {
  usersTable,
  tendersTable,
  aiAnalysisTable,
  scraperLogsTable,
  notificationsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { nanoid } from "./lib/nanoid";
import { logger } from "./lib/logger";
import { eq } from "drizzle-orm";

const SEED_USERS = [
  {
    email: "admin@asacentral.ba",
    password: "Admin1234!",
    name: "Admin Korisnik",
    role: "admin",
    department: "IT",
  },
  {
    email: "nabavka@asacentral.ba",
    password: "Nabavka2026!",
    name: "Amir Kovačević",
    role: "user",
    department: "Nabavka",
  },
  {
    email: "pravna@asacentral.ba",
    password: "Pravna2026!",
    name: "Amra Hadžić",
    role: "user",
    department: "Pravna služba",
  },
];

const now = new Date();
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const SEED_TENDERS = [
  {
    source: "ejn",
    title: "Nabavka IT opreme i licenci za 2026. godinu",
    description:
      "Nabavka računarske opreme, servera, mrežne infrastrukture i softverskih licenci za potrebe Federalnog ministarstva finansija. Predmet nabavke obuhvata desktop računare, laptope, štampače, mrežnu opremu i Microsoft licencne pakete.",
    contractingAuth: "FBiH Ministarstvo finansija",
    category: "IT",
    estimatedValue: 380000,
    currency: "KM",
    publicationDate: addDays(now, -10),
    deadline: addDays(now, 25),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["30200000", "48000000"],
  },
  {
    source: "ejn",
    title: "Nabavka usluga osiguranja voznog parka",
    description:
      "Osiguranje voznog parka JP Elektroprivreda BiH d.d. Sarajevo za period 2026-2027. Predmet je autoodgovornost, kasko osiguranje i kolektivno osiguranje putnika za 150+ vozila.",
    contractingAuth: "JP Elektroprivreda BiH d.d.",
    category: "Osiguranje",
    estimatedValue: 520000,
    currency: "KM",
    publicationDate: addDays(now, -5),
    deadline: addDays(now, 18),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["66514110"],
  },
  {
    source: "ejn",
    title: "Konsultantske usluge digitalne transformacije",
    description:
      "Angažovanje konsultanata za izradu strategije digitalne transformacije i implementaciju ERP sistema za Kantonalnu upravu ZDK. Uključuje analizu poslovnih procesa, dizajn IT arhitekture i obuku zaposlenika.",
    contractingAuth: "ZDK Vlada Zeničko-dobojskog kantona",
    category: "Konsalting",
    estimatedValue: 240000,
    currency: "KM",
    publicationDate: addDays(now, -15),
    deadline: addDays(now, 12),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["72224000", "72263000"],
  },
  {
    source: "reference",
    title: "Usluge printanja i arhiviranja dokumenata",
    description:
      "Iznajmljivanje multifunkcionalnih štampača i usluge skeniranja, printanja i arhiviranja dokumentacije za potrebe Grada Sarajevo. Okvirni sporazum na 2 godine.",
    contractingAuth: "Grad Sarajevo",
    category: "Nabavka opreme",
    estimatedValue: 85000,
    currency: "KM",
    publicationDate: addDays(now, -8),
    deadline: addDays(now, 30),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["30120000"],
  },
  {
    source: "ejn",
    title: "Osiguranje imovine i objekata BH Telecoma",
    description:
      "Osiguranje poslovnih objekata, opreme i imovine BH Telecom d.d. na svim lokacijama u BiH. Predmet je osiguranje od požara, prirodnih katastrofa, provalne krađe i odgovornosti prema trećim licima.",
    contractingAuth: "BH Telecom d.d. Sarajevo",
    category: "Osiguranje",
    estimatedValue: 1200000,
    currency: "KM",
    publicationDate: addDays(now, -3),
    deadline: addDays(now, 35),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["66515000", "66515200"],
  },
  {
    source: "ejn",
    title: "Marketing i komunikacijske usluge",
    description:
      "Pružanje usluga marketinga, brendiranja i komunikacije za Federalni zavod za zapošljavanje. Uključuje izradu strategije komunikacije, upravljanje društvenim mrežama, dizajn materijala i media plasman.",
    contractingAuth: "Federalni zavod za zapošljavanje",
    category: "Marketing",
    estimatedValue: 95000,
    currency: "KM",
    publicationDate: addDays(now, -12),
    deadline: addDays(now, 20),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["79340000", "79341000"],
  },
  {
    source: "ejn",
    title: "Edukacija i stručno usavršavanje zaposlenika",
    description:
      "Organizovanje obuka i treninga za zaposlenike KJKP Vodovod i kanalizacija d.o.o. Sarajevo. Program uključuje tehničke obuke, menadžment vještine, jezičke kurseve i certifikacijske programe.",
    contractingAuth: "KJKP Vodovod i kanalizacija d.o.o.",
    category: "Konsalting",
    estimatedValue: 65000,
    currency: "KM",
    publicationDate: addDays(now, -20),
    deadline: addDays(now, 8),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["80000000", "80533000"],
  },
  {
    source: "reference",
    title: "Razvoj softvera za upravljanje bolničkim pacijentima",
    description:
      "Nabavka i implementacija softvera za upravljanje pacijentima, elektronskim kartonima i fakturisanjem usluga za Kantonalnu bolnicu Zenica. Integracija sa postojećim laboratorijskim sistemom.",
    contractingAuth: "Kantonalna bolnica Zenica",
    category: "IT",
    estimatedValue: 320000,
    currency: "KM",
    publicationDate: addDays(now, -7),
    deadline: addDays(now, 45),
    tenderType: "restricted",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["72262000", "72267000"],
  },
  {
    source: "ejn",
    title: "Rekonstrukcija poslovnih prostora Poreske uprave RS",
    description:
      "Izvođenje radova na rekonstrukciji i adaptaciji poslovnih prostora 5 pododjelenja Poreske uprave RS. Uključuje građevinske, elektro i vodoinstalacijske radove.",
    contractingAuth: "Poreska uprava RS",
    category: "Radovi",
    estimatedValue: 450000,
    currency: "KM",
    publicationDate: addDays(now, -30),
    deadline: addDays(now, 15),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["45000000", "45210000"],
  },
  {
    source: "ejn",
    title: "Nabavka kancelarijskog materijala i potrošnog materijala",
    description:
      "Nabavka kancelarijskog materijala, papira, tonera i ostalog potrošnog materijala za potrebe Vlade RS za period jedne godine. Okvirni sporazum sa jednim dobavljačem.",
    contractingAuth: "Vlada RS",
    category: "Nabavka opreme",
    estimatedValue: 120000,
    currency: "KM",
    publicationDate: addDays(now, -25),
    deadline: addDays(now, 5),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["30192000", "30197630"],
  },
  {
    source: "reference",
    title: "Usluge čišćenja i održavanja poslovnih objekata",
    description:
      "Usluge profesionalnog čišćenja, dezinfekcije i održavanja poslovnih prostora Opštine Banja Luka. Predviđeno 15 lokacija, uključujući upravnu zgradu i podružnice.",
    contractingAuth: "Opština Banja Luka",
    category: "Konsalting",
    estimatedValue: 180000,
    currency: "KM",
    publicationDate: addDays(now, -18),
    deadline: addDays(now, 22),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["90910000", "90911200"],
  },
  {
    source: "ejn",
    title: "Vozila za potrebe policije RS",
    description:
      "Nabavka putničkih i terenskih vozila za potrebe Ministarstva unutrašnjih poslova RS. Predmet nabavke: 20 putničkih automobila srednje klase i 10 terenskih vozila.",
    contractingAuth: "MUP RS",
    category: "Nabavka opreme",
    estimatedValue: 780000,
    currency: "KM",
    publicationDate: addDays(now, -6),
    deadline: addDays(now, 40),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["34100000", "34111200"],
  },
  {
    source: "un",
    title: "ICT Infrastructure Upgrade - UNDP Bosnia",
    description:
      "UNDP Bosnia and Herzegovina seeks qualified vendors for ICT infrastructure upgrade including network equipment, servers, and security systems for its Sarajevo headquarters and field offices.",
    contractingAuth: "UNDP Bosnia and Herzegovina",
    category: "IT",
    estimatedValue: 180000,
    currency: "EUR",
    publicationDate: addDays(now, -4),
    deadline: addDays(now, 28),
    tenderType: "open",
    entity: "International",
    status: "open",
    cpvCodes: ["30200000"],
  },
  {
    source: "ejn",
    title: "Osiguranje zdravstvenih radnika",
    description:
      "Kolektivno osiguranje od nesreće i profesionalnih bolesti za zdravstvene radnike Kliničkog centra Sarajevo. Predmet: osiguranje 3500+ zaposlenika.",
    contractingAuth: "Klinički centar Sarajevo",
    category: "Osiguranje",
    estimatedValue: 290000,
    currency: "KM",
    publicationDate: addDays(now, -9),
    deadline: addDays(now, 2),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["66512100", "66512200"],
  },
  {
    source: "ejn",
    title: "Sistem video nadzora i fizičke zaštite",
    description:
      "Nabavka i instalacija sistema video nadzora, alarmnih sistema i usluge fizičke zaštite objekata Univerziteta u Sarajevu. Predviđeno 12 fakultetskih objekata.",
    contractingAuth: "Univerzitet u Sarajevu",
    category: "IT",
    estimatedValue: 215000,
    currency: "KM",
    publicationDate: addDays(now, -14),
    deadline: addDays(now, 33),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["35120000", "79713000"],
  },
  {
    source: "ejn",
    title: "Izgradnja novog poslovnog objekta ZE-DO Kantona",
    description:
      "Projektovanje i izgradnja novog administrativnog objekta za smještaj kantonalnih organa uprave ZDK. Bruto površina ca. 3500 m². Ključ u ruke.",
    contractingAuth: "ZDK Vlada Zeničko-dobojskog kantona",
    category: "Radovi",
    estimatedValue: 3500000,
    currency: "KM",
    publicationDate: addDays(now, -45),
    deadline: addDays(now, -5),
    tenderType: "open",
    entity: "FBiH",
    status: "closed",
    cpvCodes: ["45210000", "45200000"],
  },
  {
    source: "reference",
    title: "Nabavka medicinskih aparata i opreme",
    description:
      "Nabavka dijagnostičke i terapeutske medicinske opreme za Dom zdravlja Tuzla. Predmet: ultrazvučni aparati, EKG uređaji i laboratorijska oprema.",
    contractingAuth: "Dom zdravlja Tuzla",
    category: "Nabavka opreme",
    estimatedValue: 560000,
    currency: "KM",
    publicationDate: addDays(now, -60),
    deadline: addDays(now, -15),
    tenderType: "restricted",
    entity: "FBiH",
    status: "closed",
    cpvCodes: ["33100000"],
  },
  {
    source: "ejn",
    title: "Marketing kampanja turizma RS",
    description:
      "Razvoj i realizacija integrisane marketing kampanje za promociju turizma RS na regionalnom i međunarodnom tržištu za sezonu 2026.",
    contractingAuth: "Turistička organizacija RS",
    category: "Marketing",
    estimatedValue: 420000,
    currency: "KM",
    publicationDate: addDays(now, -90),
    deadline: addDays(now, -30),
    tenderType: "open",
    entity: "RS",
    status: "awarded",
    cpvCodes: ["79342200"],
  },
  {
    source: "ejn",
    title: "Brčko Distrikt - IT sistemi za e-upravu",
    description:
      "Implementacija platforme za e-upravu Brčko Distrikta BiH. Predmet: portal za građane, sistem e-plaćanja i CRM sistem za praćenje zahtjeva.",
    contractingAuth: "Vlada Brčko Distrikta BiH",
    category: "IT",
    estimatedValue: 290000,
    currency: "KM",
    publicationDate: addDays(now, -11),
    deadline: addDays(now, 27),
    tenderType: "open",
    entity: "BD",
    status: "open",
    cpvCodes: ["72000000", "72600000"],
  },
  {
    source: "ejn",
    title: "Nabavka vozila i osiguranje flote Općine Mostar",
    description:
      "Nabavka komunalnih vozila i osiguranje cjelokupne flote Općine Mostar. Uključuje 8 komunalnih vozila i puno kasko osiguranje 45 vozila.",
    contractingAuth: "Grad Mostar",
    category: "Osiguranje",
    estimatedValue: 340000,
    currency: "KM",
    publicationDate: addDays(now, -2),
    deadline: addDays(now, 50),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["66514110", "34100000"],
  },
  {
    source: "reference",
    title: "Usluge revizije i računovodstvenog savjetovanja",
    description:
      "Angažovanje ovlaštene revizorske kuće za godišnju reviziju finansijskih izvještaja i računovodstveno savjetovanje za javno preduzeće.",
    contractingAuth: "JP Ceste FBiH d.o.o.",
    category: "Konsalting",
    estimatedValue: 150000,
    currency: "KM",
    publicationDate: addDays(now, -22),
    deadline: addDays(now, 16),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["79212000", "79211000"],
  },
  {
    source: "ejn",
    title: "Razvoj mobilnih aplikacija za građane RS",
    description:
      "Razvoj i održavanje mobilnih aplikacija za iOS i Android platforme kojima se građanima RS pružaju e-usluge. Uključuje 3 aplikacije i 2 godine podrške.",
    contractingAuth: "Ministarstvo uprave i lokalne samouprave RS",
    category: "IT",
    estimatedValue: 195000,
    currency: "KM",
    publicationDate: addDays(now, -16),
    deadline: addDays(now, 24),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["72212000"],
  },
  {
    source: "un",
    title: "Consultancy Services - Financial Sector Reform BiH",
    description:
      "IFC seeks international consultancy services to support financial sector reform and insurance market development in Bosnia and Herzegovina. Services include regulatory analysis and capacity building.",
    contractingAuth: "IFC / World Bank Group",
    category: "Konsalting",
    estimatedValue: 250000,
    currency: "EUR",
    publicationDate: addDays(now, -1),
    deadline: addDays(now, 42),
    tenderType: "restricted",
    entity: "International",
    status: "open",
    cpvCodes: ["66000000", "72224000"],
  },
  {
    source: "ejn",
    title: "Nabavka i instalacija solarnih panela",
    description:
      "Nabavka i instalacija fotonaponskog sistema na zgradama Opštine Teslić. Predviđena snaga 120 kWp na 6 objekata.",
    contractingAuth: "Opština Teslić",
    category: "Radovi",
    estimatedValue: 280000,
    currency: "KM",
    publicationDate: addDays(now, -13),
    deadline: addDays(now, 31),
    tenderType: "open",
    entity: "RS",
    status: "open",
    cpvCodes: ["09331200", "45261215"],
  },
  {
    source: "ejn",
    title: "Grupno osiguranje zaposlenika Agencije za rad",
    description:
      "Grupno životno osiguranje i osiguranje od nezgode za zaposlenike Agencije za rad i zapošljavanje BiH. Predmet: 450 zaposlenika, period 2 godine.",
    contractingAuth: "Agencija za rad i zapošljavanje BiH",
    category: "Osiguranje",
    estimatedValue: 125000,
    currency: "KM",
    publicationDate: addDays(now, -17),
    deadline: addDays(now, 6),
    tenderType: "open",
    entity: "FBiH",
    status: "open",
    cpvCodes: ["66511000", "66512100"],
  },
];

const AI_ANALYSES = [
  {
    // IT oprema
    summary:
      "Tender za nabavku IT opreme FBiH Ministarstva finansija je visokoprioritetna prilikaza ASA CENTRAL. Predmet obuhvata široki spektar IT opreme i softverskih licenci što direktno odgovara poslovnom profilu kompanije.",
    keyRequirements: [
      "Ovlašteni distributer ili partner proizvođača opreme",
      "Min. 5 godina iskustva u IT nabavkama",
      "ISO 9001 certifikacija",
      "Finansijska sposobnost - prihodi min. 500.000 KM",
      "Garantni rok min. 2 godine na opremu",
    ],
    eligibilityCriteria: [
      "Registracija u sudskom registru kao IT kompanija",
      "Uvjerenje o izmirenim porezima i doprinosima",
      "Izjava o nekažnjavanju direktora",
      "Bančna garancija za ozbiljnost ponude 2%",
    ],
    risks: [
      { risk: "Visoka konkurencija od specijalizovanih IT kompanija", severity: "high" },
      { risk: "Kratki rok isporuke za veliku nabavku", severity: "medium" },
      { risk: "Promjena tehničkih specifikacija", severity: "low" },
    ],
    opportunities: [
      "Pozicija ASA GROUP kao velikog kupca IT opreme",
      "Dugogodišnje partnerstvo s vodećim IT dobavljačima",
      "Mogućnost okvirnog sporazuma za više godina",
    ],
    redFlags: [],
    estimatedWorkload: "3-4 sedmice, 3-4 osobe",
    suggestedApproach:
      "Formirati konzorcijum sa specijalizovanim IT partnerom kao vodećim partnerom. ASA CENTRAL može nastupiti kao podugovarač za dio usluga upravljanja.",
    relevanceScore: 82,
    relevanceTags: ["IT", "Softver", "Oprema", "Ministarstvo"],
    competitionLevel: "high",
    successProbability: 55,
    insuranceRelevance:
      "ASA CENTRAL kroz ASA GROUP ima direktne kanale za nabavku IT opreme. Učešće bi ojačalo poziciju grupe kao preferiranog dobavljača javnim institucijama.",
    requiredDocs: [
      "Ponudbeni obrazac",
      "Izjava o nekažnjavanju",
      "Uvjerenje o plaćenim porezima (FBiH i opštinskom)",
      "Sudski registar - ovjeren",
      "Referenc lista - min 3 projekta sličnog obima",
      "Bankarska garancija za ozbiljnost ponude",
      "Certifikati ovlaštenja proizvođača",
    ],
  },
  {
    // Osiguranje voznog parka
    summary:
      "Ovo je idealan tender za ASA CENTRAL kao vodeće osiguravajuće društvo u BiH. Osiguranje voznog parka JP Elektroprivreda BiH od 150+ vozila direktno je u core poslovnoj aktivnosti kompanije.",
    keyRequirements: [
      "Licenca za obavljanje poslova osiguranja u BiH",
      "Ovlaštenje za autoodgovornost i kasko osiguranje",
      "Mreža servisera i asistenata na putu u FBiH",
      "24/7 kontakt centar za osiguranika",
      "Min. 5 godina poslovanja u osiguranju vozila",
    ],
    eligibilityCriteria: [
      "Licenca Agencije za nadzor osiguranja FBiH",
      "Solventnost i finansijska stabilnost",
      "Registracija za autoodgovornost i kasko",
      "Uvjerenje o izmirenim obavezama",
    ],
    risks: [
      { risk: "Specifični zahtjevi za servisnu mrežu", severity: "low" },
      { risk: "Cijenska konkurencija manjih osiguravajućih društava", severity: "medium" },
    ],
    opportunities: [
      "Core business ASA CENTRAL - direktna relevantnost",
      "Referenca za buduće tendre osiguranja",
      "Potencijal za proširenje na ostala osiguranja u grupi",
    ],
    redFlags: [],
    estimatedWorkload: "1-2 sedmice, 2 osobe",
    suggestedApproach:
      "Nastupiti samostalno kao vodeće osiguravajuće društvo u BiH. Ponuditi kompetitivne premije uz dodatne usluge (online portali, direktna likvidacija šteta) kao diferencirajuće faktore.",
    relevanceScore: 95,
    relevanceTags: ["Osiguranje", "Vozni park", "Kasko", "Autoodgovornost"],
    competitionLevel: "medium",
    successProbability: 78,
    insuranceRelevance:
      "Ovo je primjer tendera gdje ASA CENTRAL ima sve prednosti: licencu, iskustvo, servisnu mrežu i financijsku snagu. Maximalni potencijal za pobjedu uz pravu strategiju cijena.",
    requiredDocs: [
      "Licenca za osiguranje od AZO FBiH",
      "Polica osiguranja - nacrt",
      "Uvjerenje o solventnosti",
      "Referenc lista osiguranja voznih parkova",
      "Opis servisne i asistentske mreže",
      "Finansijski izvještaji 3 godine",
    ],
  },
  {
    // Konsalting digitalizacija
    summary:
      "Tender za konsultantske usluge digitalne transformacije ZDK je umjereno relevantan za ASA CENTRAL. Kompanija ima interna IT iskustva ali nije primarno pozicionirana kao IT konsultant.",
    keyRequirements: [
      "Iskustvo u implementaciji ERP sistema",
      "Certifikovani projektni menadžeri (PMP, PRINCE2)",
      "Referentni projekti u javnom sektoru min. 3",
      "Tim od min. 5 seniora konsultanata",
    ],
    eligibilityCriteria: [
      "Registracija za IT i konsultantske usluge",
      "ISO 9001 certifikacija za usluge",
      "Minimum godišnji prihod 300.000 KM",
    ],
    risks: [
      { risk: "Van core kompetencija ASA CENTRAL", severity: "high" },
      { risk: "Visoki zahtjevi za stručnim osobljem", severity: "medium" },
    ],
    opportunities: [
      "Partnerstvo s vodećim IT konsultantima",
      "Učešće u strateškim projektima vlade",
    ],
    redFlags: ["Tender nije direktno u poslovnoj aktivnosti ASA CENTRAL"],
    estimatedWorkload: "4-6 sedmica, 5+ osoba",
    suggestedApproach:
      "Razmotriti učešće isključivo kroz konzorcijum sa specijalizovanom IT konsultantskom firmom. ASA CENTRAL može pružiti finansijsku osnovu konzorcijuma.",
    relevanceScore: 68,
    relevanceTags: ["Konsalting", "Digitalizacija", "ERP", "Javni sektor"],
    competitionLevel: "medium",
    successProbability: 40,
    insuranceRelevance:
      "Umjerena relevantnost - ASA CENTRAL bi trebao razmotriti učešće u konzorcijumu ali ne kao voditelj. Interna IT iskustva nisu direktno prenosiva na javne ERP projekte.",
    requiredDocs: [
      "Ponudbeni obrazac",
      "CV seniora konsultanata",
      "Certifikati PMP/PRINCE2",
      "Referenc lista sličnih projekata",
      "Metodologija projekta",
      "Finansijski plan projekta",
    ],
  },
];

export async function seedDatabase() {
  logger.info("Starting database seed...");

  const isProduction = process.env.NODE_ENV === "production";
  const productionPassword = process.env.ADMIN_PASSWORD;
  if (isProduction && (!productionPassword || productionPassword.length < 10)) {
    throw new Error("Set ADMIN_PASSWORD to at least 10 characters before starting production.");
  }

  // Keep the production administrator synchronized with Render's generated
  // password. This also repairs databases created by an older deploy after a
  // Blueprint secret is regenerated.
  if (isProduction) {
    const productionEmail = process.env.ADMIN_EMAIL || "admin@asacentral.ba";
    const hash = await bcrypt.hash(productionPassword!, 12);
    const [existingAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, productionEmail))
      .limit(1);

    if (existingAdmin) {
      await db.update(usersTable).set({
        password: hash,
        name: "Administrator",
        role: "admin",
        department: "IT",
      }).where(eq(usersTable.id, existingAdmin.id));
      logger.info({ email: productionEmail }, "Synchronized production administrator");
    } else {
      await db.insert(usersTable).values({
        id: nanoid(),
        email: productionEmail,
        password: hash,
        name: "Administrator",
        role: "admin",
        department: "IT",
        companyTags: ["Insurance", "Procurement"],
      });
      logger.info({ email: productionEmail }, "Created production administrator");
    }
    return;
  }

  // Check if the local demo database is already seeded.
  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    logger.info("Database already seeded, skipping");
    return;
  }

  // Seed local demo users.
  const seedUsers = SEED_USERS;
  const userIds: string[] = [];
  for (const u of seedUsers) {
    const hash = await bcrypt.hash(u.password, 12);
    const id = nanoid();
    await db.insert(usersTable).values({
      id,
      email: u.email,
      password: hash,
      name: u.name,
      role: u.role,
      department: u.department,
      companyTags: ["Insurance", "IT", "Procurement"],
    });
    userIds.push(id);
    logger.info({ email: u.email }, "Seeded user");
  }

  // Seed tenders
  const tenderIds: string[] = [];
  for (const t of SEED_TENDERS) {
    const id = nanoid();
    await db.insert(tendersTable).values({
      id,
      externalId: `EXT-${nanoid(8)}`,
      source: t.source,
      title: t.title,
      description: t.description,
      contractingAuth: t.contractingAuth,
      category: t.category,
      cpvCodes: t.cpvCodes || [],
      estimatedValue: t.estimatedValue,
      currency: t.currency,
      publicationDate: t.publicationDate,
      deadline: t.deadline,
      tenderType: t.tenderType,
      entity: t.entity,
      status: t.status,
      sourceUrl: `https://www.ejn.gov.ba/tender/${nanoid(8)}`,
    });
    tenderIds.push(id);
  }
  logger.info({ count: SEED_TENDERS.length }, "Seeded tenders");

  // Seed AI analyses for first 3 tenders
  for (let i = 0; i < Math.min(AI_ANALYSES.length, tenderIds.length); i++) {
    await db.insert(aiAnalysisTable).values({
      id: nanoid(),
      tenderId: tenderIds[i],
      ...AI_ANALYSES[i],
      keyRequirements: AI_ANALYSES[i].keyRequirements,
      eligibilityCriteria: AI_ANALYSES[i].eligibilityCriteria,
      risks: AI_ANALYSES[i].risks,
      opportunities: AI_ANALYSES[i].opportunities,
      redFlags: AI_ANALYSES[i].redFlags,
      relevanceTags: AI_ANALYSES[i].relevanceTags,
      requiredDocs: AI_ANALYSES[i].requiredDocs,
    });
  }
  logger.info("Seeded AI analyses");

  // Seed scraper logs
  const sources = ["ejn", "reference", "un"];
  for (const source of sources) {
    await db.insert(scraperLogsTable).values({
      id: nanoid(),
      source,
      triggeredBy: "cron",
      startedAt: addDays(now, -1),
      completedAt: addDays(now, -1),
      tendersFound: Math.floor(Math.random() * 15) + 5,
      tendersNew: Math.floor(Math.random() * 8) + 2,
      tendersUpdated: Math.floor(Math.random() * 4),
      status: "completed",
    });
  }
  logger.info("Seeded scraper logs");

  // Seed notifications for each user
  const notifTypes = [
    {
      type: "new_tender",
      title: "Novi tender: Osiguranje voznog parka JP Elektroprivreda",
      message:
        "Objavljen je novi tender koji odgovara vašem profilu - AI relevantnost 95/100",
    },
    {
      type: "deadline_soon",
      title: "Rok uskoro: Edukacija zaposlenika KJKP",
      message: "Tender ističe za 8 dana. Preporučujemo hitno djelovanje.",
    },
    {
      type: "ai_alert",
      title: "AI Upozorenje: Visoka relevantnost",
      message:
        "Identificiran tender sa relevantnošću 95/100 - Osiguranje voznog parka.",
    },
    {
      type: "digest",
      title: "AI Jutarnji izvještaj - danas",
      message:
        "Top 5 tendera za danas: 2 osiguravajuća, 1 IT, 2 konsalting. Ukupna vrijednost: 1.2M KM.",
    },
    {
      type: "scraper_done",
      title: "Sinkronizacija završena",
      message: "Pronađeno 12 novih tendera u zadnja 2 sata (EJN portal).",
    },
  ];

  for (const userId of userIds) {
    for (const n of notifTypes) {
      await db.insert(notificationsTable).values({
        id: nanoid(),
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        read: false,
      });
    }
  }
  logger.info("Seeded notifications");
  logger.info("Database seed complete!");
}
