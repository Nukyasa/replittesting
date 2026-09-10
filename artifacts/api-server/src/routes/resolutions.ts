import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/auth";
import { fetchResolutions, type EjnResolution } from "../services/ejnPublicApi";
import { db, urzDecisionsTable, tendersTable } from "@workspace/db";
import { seedHistoryData } from "../services/historySeed";
import { ilike, or, desc, eq } from "drizzle-orm";

export const resolutionsRouter = Router();
resolutionsRouter.use(authMiddleware);

// GET /api/resolutions — Lista rješenja URŽ iz baze i EJN API-ja
resolutionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const year = req.query.year ? Number(req.query.year) : undefined;
    const type = String(req.query.type || "all");
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    // Provjeri lokalne URŽ presedane iz baze
    const checkCount = await db.select().from(urzDecisionsTable).limit(1);
    if (checkCount.length === 0) {
      await seedHistoryData();
    }

    let localQuery = db.select().from(urzDecisionsTable);
    if (search) {
      localQuery = localQuery.where(
        or(
          ilike(urzDecisionsTable.caseNumber, `%${search}%`),
          ilike(urzDecisionsTable.procedureName, `%${search}%`),
          ilike(urzDecisionsTable.contractingAuth, `%${search}%`),
          ilike(urzDecisionsTable.appellant, `%${search}%`),
          ilike(urzDecisionsTable.sporniUslov, `%${search}%`),
          ilike(urzDecisionsTable.summary, `%${search}%`)
        )
      ) as any;
    }
    const localDecisions = await localQuery.orderBy(desc(urzDecisionsTable.decisionDate));

    const formattedLocal = localDecisions.map((d: any) => ({
      id: d.id,
      number: d.caseNumber,
      date: d.decisionDate.toISOString(),
      type: "URŽ Rješenje",
      procedureName: d.procedureName,
      procedureNumber: d.ejnBroj || d.caseNumber,
      procedureType: "Otvoreni postupak",
      contractingAuthority: d.contractingAuth,
      city: "Sarajevo",
      entity: "BiH",
      category: d.category,
      contractType: "Usluge",
      isAuctionOnline: true,
      awardCriterion: "Najniža cijena",
      hasLots: false,
      outcome: d.outcome,
      outcomeLabel: d.outcomeLabel,
      legalBasis: d.legalBasis,
      sporniUslov: d.sporniUslov,
      summary: d.summary,
      appellant: d.appellant,
      ejnUrl: "https://www.ejn.gov.ba",
    }));

    let items: EjnResolution[] = [];
    let count = 0;
    try {
      const ejnResult = await fetchResolutions({
        top: limit,
        skip,
        search: search || undefined,
        year,
        type: type !== "all" ? type : undefined,
      });
      items = ejnResult.value;
      count = ejnResult.count ?? 0;
    } catch (ejnErr) {
      console.warn("EJN fetchResolutions fallback to local decisions:", ejnErr);
    }

    // Formatiraj EJN podatke
    const formattedEjn = items.map((r: EjnResolution) => ({
      id: String(r.Id),
      number: r.Number || "",
      date: r.Date,
      type: r.Type || "Procedure",
      procedureId: r.ProcedureId,
      procedureName: r.ProcedureName || "—",
      procedureNumber: r.ProcedureNumber || "",
      procedureType: mapProcedureType(r.ProcedureType),
      contractingAuthorityId: r.ContractingAuthorityId,
      contractingAuthority: r.ContractingAuthorityName || "—",
      city: r.ContractingAuthorityCityName || "",
      entity: r.ContractingAuthorityAdministrativeUnitName || "",
      category: r.ContractCategoryName || "",
      contractType: r.ContractType || "",
      isAuctionOnline: !!r.IsAuctionOnline,
      awardCriterion: r.AwardCriterion || "",
      hasLots: !!r.HasLots,
      lastUpdated: r.LastUpdated,
      ejnUrl: r.ProcedureNumber
        ? `https://www.ejn.gov.ba/Announcement/Search?procedureNumber=${encodeURIComponent(r.ProcedureNumber)}`
        : "https://www.ejn.gov.ba/Announcement/Search",
    }));

    // Kombiniraj lokalne pravne presedane na vrhu
    const combined = [...formattedLocal, ...formattedEjn];
    const totalCount = count + formattedLocal.length;

    // Grupiraj statistiku po tipu
    const stats = {
      total: totalCount,
      byType: combined.reduce((acc: Record<string, number>, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json({
      data: combined,
      meta: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      stats,
      source: "urz_registry_and_ejn",
    });
  } catch (err: any) {
    console.error("Error in GET /api/resolutions:", err);
    res.status(500).json({ error: "Greška pri dohvatanju rješenja URŽ", message: err.message });
  }
});

// GET /api/resolutions/stats — Statistika rješenja
resolutionsRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const thisYear = new Date().getFullYear();
    const [current, previous] = await Promise.all([
      fetchResolutions({ top: 0, year: thisYear }),
      fetchResolutions({ top: 0, year: thisYear - 1 }),
    ]);

    res.json({
      thisYear: current.count ?? 0,
      lastYear: previous.count ?? 0,
      source: "ejn_openapi",
    });
  } catch (err: any) {
    console.error("Error in GET /api/resolutions/stats:", err);
    res.status(500).json({ error: "Greška pri dohvatanju statistike", message: err.message });
  }
});

// GET /api/resolutions/:id — Detalji jednog rješenja
resolutionsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Neispravan ID rješenja" });
      return;
    }

    // Dohvati konkretno rješenje po ID-u
    const { value: items } = await fetchResolutions({ top: 1, skip: 0 });
    // Filtriramo na osnovu ID-a — alternativno direktan filter ako API podržava
    const item = items.find((r: EjnResolution) => r.Id === id);

    if (!item) {
      res.status(404).json({ error: "Rješenje nije pronađeno" });
      return;
    }

    res.json({
      id: String(item.Id),
      number: item.Number,
      date: item.Date,
      type: item.Type,
      procedureName: item.ProcedureName,
      procedureNumber: item.ProcedureNumber,
      contractingAuthority: item.ContractingAuthorityName,
      category: item.ContractCategoryName,
      ejnUrl: item.ProcedureNumber
        ? `https://www.ejn.gov.ba/Announcement/Search?procedureNumber=${encodeURIComponent(item.ProcedureNumber)}`
        : "https://www.ejn.gov.ba/Resolution",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Greška pri dohvatanju rješenja", message: err.message });
  }
});

function mapProcedureType(type?: string): string {
  const map: Record<string, string> = {
    OpenProcedure: "Otvoreni postupak",
    CompetitiveRequest: "Zahtjev za ponude",
    DirectAgreement: "Direktni sporazum",
    RestrictedProcedure: "Ograničeni postupak",
    NegotiatedProcedure: "Pregovarački postupak",
    CompetitiveDialogue: "Kompetitivni dijalog",
    InnovationPartnership: "Partnerstvo za inovacije",
  };
  return map[type || ""] || type || "—";
}

// POST /api/resolutions/generate-appeal — Generiše pravni podnesak žalbe URŽ-u
resolutionsRouter.post("/generate-appeal", async (req: Request, res: Response) => {
  try {
    const { tenderId, violationType, customGrounds } = req.body;
    let tender: any = null;
    if (tenderId) {
      const [t] = await db.select().from(tendersTable).where(eq(tendersTable.id, tenderId)).limit(1);
      tender = t;
    }

    const estimatedVal = Number(tender?.estimatedValue) || 100000;
    
    // Zakonska naknada po Članu 108. ZJN BiH
    let feeKm = 500;
    if (estimatedVal > 800000) feeKm = 7500;
    else if (estimatedVal > 500000) feeKm = 5000;
    else if (estimatedVal > 250000) feeKm = 3500;
    else if (estimatedVal > 100000) feeKm = 2000;
    else if (estimatedVal > 50000) feeKm = 1000;

    const precedents = await db.select().from(urzDecisionsTable).limit(5);

    const authorityName = tender?.contractingAuth || "UGOVORNI ORGAN";
    const procedureName = tender?.title || "Nabavka usluga osiguranja / tehničkog pregleda";
    const ejnNumber = tender?.externalId || "EJN-2026";
    const todayStr = new Date().toLocaleDateString("bs-BA");

    const groundsMap: Record<string, { title: string; clan: string; text: string }> = {
      tehnicki_cenzus: {
        title: "Povreda Člana 54. ZJN BiH — Diskriminatorni tehnički uslovi",
        clan: "Član 54. stav (1) i (2) Zakona o javnim nabavkama BiH",
        text: `Ugovorni organ je u tenderskoj dokumentaciji postavio zahtjev koji neopravdano sužava konkurenciju i favorizuje postojećeg pružaoca usluga, čime je direktno postupio suprotno Članu 54. ZJN BiH. Uspostavljeni uslov nema objektivno opravdanje u prirodi predmeta nabavke i onemogućava ravnopravno učešće ASA Central d.d. Sarajevo.`
      },
      servisne_stanice: {
        title: "Povreda principa aktivne konkurencije — Zahtjev za lokacijom stanica tehničkog pregleda",
        clan: "Član 3. i Član 54. ZJN BiH",
        text: `Zahtjev da ponuđač posjeduje isključivo vlastite stanice tehničkog pregleda u tačno određenom uskom radijusu predstavlja eklatantnu diskriminaciju. Prema ustaljenoj praksi URŽ-a, ugovorni organ je dužan omogućiti dokazivanje tehničke osposobljenosti i putem partnerske mreže i ugovora o poslovno-tehničkoj saradnji.`
      },
      previsoke_reference: {
        title: "Povreda Člana 48. ZJN BiH — Nesrazmjerni uslovi tehničke i profesionalne sposobnosti",
        clan: "Član 48. stav (2) Zakona o javnim nabavkama BiH",
        text: `Traženi nivo minimalnog godišnjeg prometa ili ostvarenih premija osiguranja iz prethodnih godina višestruko premašuje procijenjenu vrijednost predmetne nabavke. Uslovi ekonomske i tehničke sposobnosti moraju biti u direktnoj srazmjeri s predmetom nabavke, a ne služiti kao barijera za ulazak novih ponuđača.`
      },
      podugovaranje: {
        title: "Povreda Člana 73. ZJN BiH — Ograničavanje prava na angažovanje podugovarača",
        clan: "Član 73. Zakona o javnim nabavkama BiH",
        text: `Ugovorni organ je suprotno izričitim odredbama Člana 73. ZJN BiH onemogućio ili neopravdano ograničio pravo ponuđača da se osloni na kapacitete trećih lica (podugovarača) u pogledu tehničke opremljenosti i servisne infrastrukture.`
      }
    };

    const chosenGround = groundsMap[violationType] || groundsMap.tehnicki_cenzus;
    const precedentCite = precedents.length > 0 
      ? `Kao dokaz ustaljene prakse URŽ-a u identičnim pravnim situacijama, pozivamo se na Rješenje URŽ-a broj ${precedents[0].caseNumber} od ${new Date(precedents[0].decisionDate).toLocaleDateString("bs-BA")}, u kojem je zauzet jasan stav da: „${precedents[0].summary}“.`
      : `Ovakvo postupanje je u direktnoj suprotnosti sa dosadašnjom praksom Ureda za razmatranje žalbi BiH.`;

    const fullAppealText = `BOSNA I HERCEGOVINA
UREDU ZA RAZMATRANJE ŽALBI BIH
Putem Ugovornog organa: ${authorityName}

ŽALILAC:
ASA CENTRAL OSIGURANJE d.d. Sarajevo
Bulevar Meše Selimovića 16, 71000 Sarajevo
JIB: 4200234560004
Zastupano po: Uprava društva

PREDMET: ŽALBA NA TENDERSKU DOKUMENTACIJU
Naziv postupka: ${procedureName}
Broj obavještenja o nabavci: ${ejnNumber}

Dana ${todayStr} godine, Žalilac blagovremeno, shodno Članu 97. i Članu 101. Zakona o javnim nabavkama BiH ("Sl. glasnik BiH", br. 39/14 i 59/22), izjavljuje žalbu na tendersku dokumentaciju u predmetnom postupku.

I. BLAGOVREMENOST I AKTIVNA LEGITIMACIJA
Žalba se izjavljuje u toku roka za podnošenje ponuda, u skladu sa Članom 101. stav (5) ZJN BiH. Žalilac ima nesporan pravni i ekonomski interes za dodjelu ugovora kao registrovani pružalac usluga osiguranja i tehničkih pregleda motornih vozila u Bosni i Hercegovini.

II. ČINJENIČNI I PRAVNI OSNOV ŽALBE
1. ${chosenGround.title}
Pravni osnov: ${chosenGround.clan}

Obrazloženje:
${chosenGround.text}

${customGrounds ? `Dodatne primjedbe i sporni članovi TD:\n${customGrounds}\n` : ""}
2. Ustaljena praksa URŽ-a:
${precedentCite}

III. DOKAZ O UPLATI NAKNADE ZA POKRETANJE ŽALBENOG POSTUPKA
U skladu sa Članom 108. ZJN BiH, Žalilac uz ovu žalbu prilaže dokaz o uplati propisane naknade za pokretanje žalbenog postupka u iznosu od ${feeKm.toLocaleString("bs-BA")} KM na Jedinstveni račun trezora BiH.

IV. ŽALBENI PRIJEDLOG
Na osnovu svega navedenog, shodno Članu 111. stav (1) ZJN BiH, Žalilac predlaže da Ured za razmatranje žalbi BiH:

1. USVOJI žalbu ASA Central osiguranje d.d. Sarajevo kao u potpunosti osnovanu;
2. PONIŠTI sporne diskriminatorne odredbe tenderske dokumentacije;
3. NALOŽI Ugovornom organu otklanjanje povreda i produženje roka za prijem ponuda;
4. OBAVEŽE Ugovorni organ da Žaliocu nadoknadi troškove žalbenog postupka u iznosu uplaćene naknade od ${feeKm.toLocaleString("bs-BA")} KM.

U Sarajevu, ${todayStr}. godine

Za Žalioca:
ASA Central osiguranje d.d. Sarajevo`;

    return res.json({
      appealText: fullAppealText,
      feeKm,
      relevantDecisions: precedents.map((p: any) => ({
        caseNumber: p.caseNumber,
        summary: p.summary,
        outcome: p.outcomeLabel,
        legalBasis: p.legalBasis
      })),
      authority: authorityName,
      procedure: procedureName,
    });
  } catch (err: any) {
    console.error("Error generating appeal:", err);
    return res.status(500).json({ error: "Greška pri generisanju nacrta žalbe", message: err.message });
  }
});
