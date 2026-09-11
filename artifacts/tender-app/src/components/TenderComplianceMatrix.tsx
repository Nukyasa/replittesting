import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileCheck,
  Building,
  Shield,
  FileText,
  HelpCircle,
  Scale,
  Calendar,
  Layers,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Save,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

export type ChecklistItemStatus = "ready" | "in_progress" | "missing" | "not_required";

export interface AsaChecklistItem {
  id: string;
  itemNumber?: string;
  section: string;
  title: string; // Traženi dokument ili stavka
  deliverable?: string; // Dokument koji se dostavlja
  tdValue?: string; // Podatak / Zahtjev iz TD
  status: ChecklistItemStatus;
  notes?: string;
  isLegalObligation?: boolean;
}

interface TenderComplianceMatrixProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
  tender?: any;
}

export function TenderComplianceMatrix({
  tenderId,
  tenderTitle,
  contractingAuth,
  tender,
}: TenderComplianceMatrixProps) {
  const storageKey = `asa_tender_checklist_${tenderId}`;

  // Helper za automatsko popunjavanje iz tendera
  const initialData = useMemo(() => {
    const raw = tender?.rawData?.announcement || tender?.rawData || {};
    const lotsCount = Array.isArray(tender?.rawData?.lots) ? tender.rawData.lots.length : undefined;
    const estVal = tender?.estimatedValue ? `${tender.estimatedValue.toLocaleString("bs-BA")} ${tender.currency || "KM"}` : "";
    const isAuction = tender?.hasEAuction ? "DA (Obavezna)" : "NE";
    const awardCrit = tender?.awardCriteria || "Najniža cijena";
    const deadlineStr = tender?.deadline ? formatDate(tender.deadline) : "";

    // Baza stavki po stranicama i sekcijama iz ASA Central PDF-a
    const defaultItems: AsaChecklistItem[] = [
      // ==========================================
      // STRANICA 1: OSNOVNI ELEMENTI POSTUPKA
      // ==========================================
      { id: "osn_predmet", section: "osnovni", title: "Predmet nabavke", tdValue: tenderTitle || raw.ContractSubject || "", status: "ready" },
      { id: "osn_vrijednost", section: "osnovni", title: "Procijenjena vrijednost nabavke", tdValue: estVal || "", status: estVal ? "ready" : "in_progress" },
      { id: "osn_vrsta", section: "osnovni", title: "Vrsta postupka", tdValue: tender?.tenderType ? String(tender.tenderType).toUpperCase() : "Otvoreni postupak", status: "ready" },
      { id: "osn_lotovi", section: "osnovni", title: "Podjela na LOT-ove", tdValue: lotsCount ? `DA (${lotsCount} lotova)` : "NE (Jedinstvena nabavka)", status: "ready" },
      { id: "osn_moj_lot", section: "osnovni", title: "LOT za koji se dostavlja ponuda", tdValue: lotsCount ? "Svi lotovi" : "Kompletan predmet nabavke", status: "ready" },
      { id: "osn_kriterij", section: "osnovni", title: "Kriterij za dodjelu ugovora", tdValue: awardCrit, status: "ready" },
      { id: "osn_eaukcija", section: "osnovni", title: "E-aukcija", tdValue: isAuction, status: "ready" },
      { id: "osn_ugovor", section: "osnovni", title: "Okvirni sporazum / ugovor", tdValue: "Jednokratni ugovor na 12 mjeseci", status: "in_progress" },
      { id: "osn_trajanje", section: "osnovni", title: "Period trajanja ugovora/osiguranja", tdValue: "1 godina (365 dana od stupanja na snagu)", status: "ready" },
      { id: "osn_vazenje", section: "osnovni", title: "Rok važenja ponude", tdValue: "Opcija ponude: minimalno 60 ili 90 dana", status: "ready" },
      { id: "osn_rok_dostave", section: "osnovni", title: "Rok za dostavljanje ponude", tdValue: deadlineStr, status: deadlineStr ? "ready" : "missing" },

      // ==========================================
      // STRANICA 1: SADRŽAJ, PRIPREMA I DOSTAVLJANJE PONUDE
      // ==========================================
      { id: "pripr_sadrzaj", section: "priprema", title: "Sadržaj ponude", tdValue: "Prema popisu i redoslijedu iz TD", status: "in_progress" },
      { id: "pripr_obrazac_ponuda", section: "priprema", title: "Obrazac za ponudu", tdValue: "Aneks ponude popunjen, potpisan i ovjeren", status: "ready" },
      { id: "pripr_obrazac_cijena", section: "priprema", title: "Obrazac za cijenu ponude", tdValue: "Predračun / Aneks cijene sa iskazanim porezom", status: "ready" },
      { id: "pripr_nacrt_ugovora", section: "priprema", title: "Nacrt ugovora / okvirnog sporazuma", tdValue: "Parafiran nacrt ugovora", status: "ready" },
      { id: "pripr_nacin_dostave", section: "priprema", title: "Način dostavljanja ponude", tdValue: "U zatvorenoj i zapečaćenoj koverti sa naznakom NE OTVARAJ", status: "ready" },
      { id: "pripr_adresa", section: "priprema", title: "Adresa za dostavljanje ponude", tdValue: raw.OfferDeliveryAddress || raw.DocumentationTakeOverAddress || contractingAuth, status: "ready" },
      { id: "pripr_broj_primjeraka", section: "priprema", title: "Broj primjeraka ponude", tdValue: "1 original (i kopija ako je TD propisano)", status: "ready" },
      { id: "pripr_elektronska_kopija", section: "priprema", title: "Elektronska kopija ponude", tdValue: "USB stick ili CD u koverti (ukoliko se traži)", status: "in_progress" },
      { id: "pripr_format_medij", section: "priprema", title: "Format elektronske kopije / elektronski medij", tdValue: "PDF format na USB flash memoriji", status: "ready" },
      { id: "pripr_uvezivanje", section: "priprema", title: "Način uvezivanja ponude", tdValue: "Čvrsti uvez jemstvenikom sa naljepnicom i pečatom preko krajeva", status: "ready" },
      { id: "pripr_numeracija", section: "priprema", title: "Numeracija stranica", tdValue: "Sve stranice numerisane u formatu: redni broj (1 do n)", status: "ready" },
      { id: "pripr_paraf_pecat", section: "priprema", title: "Paraf i pečat", tdValue: "Svaka stranica parafirana od ovlaštenog lica i ovjerena", status: "ready" },
      { id: "pripr_pakovanje_lot", section: "priprema", title: "Posebno pakovanje po LOT-ovima", tdValue: lotsCount ? "Zasebne unutrašnje koverte po lotovima" : "Jedinstvena koverta", status: "ready" },
      { id: "pripr_otvaranje", section: "priprema", title: "Mjesto i vrijeme otvaranja ponuda", tdValue: raw.BidOpeningDateTime ? `${formatDate(raw.BidOpeningDateTime)}, ${raw.BidOpeningAddress || ""}` : "Odmah po isteku roka za prijem ponuda", status: "ready" },
      { id: "pripr_izmjena", section: "priprema", title: "Izmjena, dopuna i povlačenje ponude", tdValue: "Dozvoljeno u pisanoj formi prije isteka roka za dostavu", status: "ready" },

      // ==========================================
      // STRANICA 1: 1. KVALIFIKACIJSKI USLOV – LIČNA SPOSOBNOST
      // ==========================================
      {
        id: "c45_1_izjava",
        itemNumber: "1.1",
        section: "c45_licna",
        title: "Izjava, koja se nalazi u prilogu tenderske dokumentacije u formi aneksa, kojom se dokazuje ispunjenost lične sposobnosti.",
        deliverable: "• Izjava iz člana 45. Zakona, koja se odnosi na ličnu sposobnost ponuđača.",
        tdValue: "Aneks iz TD ovjeren kod notara ili općine",
        status: "ready",
      },
      {
        id: "c45_2_sud",
        itemNumber: "1.2",
        section: "c45_licna",
        title: "Uvjerenje nadležnog suda kojim dokazuje da u krivičnom postupku nije izrečena pravosnažna presuda kojom je osuđen za krivično djelo učešća u kriminalnoj organizaciji, za korupciju, prevaru ili pranje novca.",
        deliverable: "• Uvjerenje Suda BiH.\n• Uvjerenje Općinskog suda u Sarajevu.",
        tdValue: "Dostavlja se u roku od 5-7 dana nakon odluke o izboru",
        status: "ready",
      },
      {
        id: "c45_3_stecaj",
        itemNumber: "1.3",
        section: "c45_licna",
        title: "Uvjerenje nadležnog suda ili organa uprave kod kojeg je registrovan kandidat/ponuđač kojim se potvrđuje da nije pod stečajem niti je predmet stečajnog postupka, da nije predmet postupka likvidacije.",
        deliverable: "• Uvjerenje Općinskog suda u Sarajevu.",
        tdValue: "Dostavlja izabrani ponuđač",
        status: "ready",
      },
      {
        id: "c45_4_doprinosi",
        itemNumber: "1.4",
        section: "c45_licna",
        title: "Uvjerenja nadležnih institucija kojim se potvrđuje da je kandidat/ponuđač izmirio dospjele obaveze, a koje se odnose na doprinose za penzijsko i invalidsko osiguranje i zdravstveno osiguranje.",
        deliverable: "• Uvjerenje Uprave za indirektno oporezivanje BiH.",
        tdValue: "Uvjerenje UIO BiH (ne starije od 3 mjeseca)",
        status: "ready",
      },
      {
        id: "c45_5_porezi",
        itemNumber: "1.5",
        section: "c45_licna",
        title: "Uvjerenja od nadležnih institucija da je kandidat/ponuđač izmirio dospjele obaveze u vezi sa plaćanjem direktnih i indirektnih poreza.",
        deliverable: "• Uvjerenje Porezne uprave.",
        tdValue: "Uvjerenje Porezne uprave FBiH",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 2. SPOSOBNOST OBAVLJANJA PROFESIONALNE DJELATNOSTI
      // ==========================================
      {
        id: "c_prof_sudski_registar",
        itemNumber: "2.1",
        section: "c_profesionalna",
        title: "Dokaz o registraciji u odgovarajućem registru.",
        deliverable: "• Aktuelni izvod iz sudskog registra.",
        tdValue: "Aktuelni izvod Općinskog suda u Sarajevu za ASA Central Osiguranje",
        status: "ready",
      },
      {
        id: "c_prof_odobrenje_azobih",
        itemNumber: "2.2",
        section: "c_profesionalna",
        title: "Dokaz o izdatom odobrenju za rad od strane Agencije za nadzor osiguranja u FBiH ili Agencije za osiguranje RS.",
        deliverable: "• Odobrenje za rad od strane Agencije za nadzor osiguranja u FBiH ili Agencije za osiguranje RS.",
        tdValue: "Rješenje / Licenca Agencije za nadzor osiguranja FBiH (AZOBiH)",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 3. EKONOMSKA I FINANSIJSKA SPOSOBNOST
      // ==========================================
      {
        id: "c47_1_izjava",
        itemNumber: "3.1",
        section: "c47_ekonomska",
        title: "Izjava, koja se nalazi u prilogu tenderske dokumentacije u formi aneksa, kojom se dokazuje ispunjenost gore navedenih uslova.",
        deliverable: "• Izjava iz člana 47. Zakona, koja se odnosi na ekonomsku i finansijsku sposobnost ponuđača.",
        tdValue: "Potpisana i ovjerena izjava ponuđača",
        status: "ready",
      },
      {
        id: "c47_2_racuni",
        itemNumber: "3.2",
        section: "c47_ekonomska",
        title: "Dokument banke ili druge finansijske institucije kojim se dokazuje ekonomsko-finansijska sposobnost.",
        deliverable: "• Spisak aktivnih računa izdat od poslovne banke ili Centralne banke.",
        tdValue: "Potvrda Centralne banke BiH o likvidnim računima (bez blokada)",
        status: "ready",
      },
      {
        id: "c47_3_bilansi",
        itemNumber: "3.3",
        section: "c47_ekonomska",
        title: "Poslovni bilansi ili izvodi iz poslovnih bilansa za period do posljednje tri finansijske godine.",
        deliverable: "• Bilans stanja i bilans uspjeha.",
        tdValue: "GFO bilans ovjeren od strane FIA FBiH / APIF",
        status: "ready",
      },
      {
        id: "c47_4_pozitivno",
        itemNumber: "3.4",
        section: "c47_ekonomska",
        title: "Izvještaj o pozitivnom finansijskom poslovanju.",
        deliverable: "• Finansijski izvještaj.",
        tdValue: "Revizorski finansijski izvještaj za prethodnu godinu",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 4. TEHNIČKA I PROFESIONALNA SPOSOBNOST
      // ==========================================
      {
        id: "c48_1_ugovori_reference",
        itemNumber: "4.1",
        section: "c48_tehnicka",
        title: "Spisak izvršenih ugovora koji su u vezi sa predmetnom nabavkom, za period ne duži od tri godine.",
        deliverable: "• Spisak izvršenih ugovora i potvrda o njihovoj realizaciji koju daje druga ugovorna strana.",
        tdValue: "Referentna lista ugovora ASA Central sa potvrdama naručilaca",
        status: "in_progress",
      },
      {
        id: "c48_2_rjesavanje_steta",
        itemNumber: "4.2",
        section: "c48_tehnicka",
        title: "Ostvarena stopa efikasnosti u rješavanju odštetnih zahtjeva.",
        deliverable: "• Potvrda Agencije za nadzor osiguranju FBiH ili Agencije za osiguranje RS.",
        tdValue: "Službena godišnja potvrda AZOBiH o stopi obrade šteta",
        status: "ready",
      },
      {
        id: "c48_3_isplata_steta",
        itemNumber: "4.3",
        section: "c48_tehnicka",
        title: "Ostvarena stopa efikasnosti u isplati odštetnih zahtjeva.",
        deliverable: "• Potvrda Agencije za nadzor osiguranju FBiH ili Agencije za osiguranje RS.",
        tdValue: "Službena potvrda AZOBiH o stopi efikasnosti isplate",
        status: "ready",
      },
      {
        id: "c48_4_roe",
        itemNumber: "4.4",
        section: "c48_tehnicka",
        title: "Ostvarena stopa prinosa na ukupan kapital (ROE).",
        deliverable: "• Bilans stanja i bilans uspjeha.",
        tdValue: "Izvod iz finansijskog izvještaja društva",
        status: "ready",
      },
      {
        id: "c48_5_uslovi_osiguranja",
        itemNumber: "4.5",
        section: "c48_tehnicka",
        title: "Uslovi osiguranja za vrste osiguranja koje su predmet nabavke.",
        deliverable: "• Uslovi ASA CENTRAL OSIGURANJA koji se odnose na vrste osiguranja obuhvaćene predmetom nabavke.",
        tdValue: "Opšti i posebni uslovi ASA Central za traženi paket osiguranja",
        status: "ready",
      },
      {
        id: "c48_6_rjesenje_agencije",
        itemNumber: "4.6",
        section: "c48_tehnicka",
        title: "Rješenje/saglasnost nadležne Agencije na uslove osiguranja.",
        deliverable: "• Rješenje, saglasnost ili drugi akt nadležne Agencije za osiguranje kojim se potvrđuje da su predmetni uslovi osiguranja odobreni, odnosno prihvaćeni za primjenu.",
        tdValue: "Saglasnost Agencije za nadzor osiguranja na tarife i uslove ASA Central",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 5. SUKOB INTERESA ILI KORUPCIJA
      // ==========================================
      {
        id: "c52_korupcija_izjava",
        itemNumber: "5.1",
        section: "c52_korupcija",
        title: "Izjava, koja se nalazi u prilogu tenderske dokumentacije u formi aneksa, kojom se dokazuje ispunjenost uslova po pitanju sukoba interesa ili korupcije.",
        deliverable: "• Izjava iz člana 52. Zakona da ponuđač nije nudio mito niti učestvovao u radnjama koje imaju za cilj korupciju u predmetnoj javnoj nabavci.",
        tdValue: "Ovjerena izjava člana 52. ZJN (Aneks iz TD)",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 6. POVJERLJIVE INFORMACIJE
      // ==========================================
      {
        id: "povj_obrazac",
        itemNumber: "6.1",
        section: "povjerljivo",
        title: "Obrazac, koji se nalazi u prilogu tenderske dokumentacije u formi aneksa, na kojem se navode povjerljive informacije.",
        deliverable: "• Obrazac o povjerljivim informacijama.",
        tdValue: "Aneks povjerljivosti (navesti zaštićene poslovne podatke ili prazan ako nema)",
        status: "ready",
      },

      // ==========================================
      // STRANICA 2: 7. GARANCIJE
      // ==========================================
      {
        id: "gar_ozbiljnost",
        itemNumber: "7.1",
        section: "garancije",
        title: "Garancija za ozbiljnost ponude a čiji se obrazac (forma) nalazi u prilogu tenderske dokumentacije.",
        deliverable: "• Garancija za ozbiljnost ponude, u iznosu koji ne prelazi 1,5% procijenjene vrijednosti ugovora.",
        tdValue: tender?.guaranteeAmount ? `${formatMoney(tender.guaranteeAmount, tender.currency)} (${tender.guaranteeType || "Bankarska garancija"})` : "Provjeriti TD (obično do 1,5% vrijednosti)",
        status: tender?.guaranteeAmount ? "in_progress" : "ready",
      },
      {
        id: "gar_izvrsenje",
        itemNumber: "7.2",
        section: "garancije",
        title: "Garancija za uredno izvršenje ugovora a čiji se obrazac (forma) nalazi u prilogu tenderske dokumentacije.",
        deliverable: "• Garancija za izvršenje ugovora, u iznosu koji ne prelazi 10% vrijednosti ugovora.",
        tdValue: "Izjava uz ponudu ili garancija nakon izbora (do 10% ugovorene vrijednosti)",
        status: "in_progress",
      },

      // ==========================================
      // STRANICE 2 & 3: 8. DODATNE IZJAVE
      // ==========================================
      { id: "izj_8_1", itemNumber: "8.1", section: "dodatne_izjave", title: "Izjava o roku isplate štete.", deliverable: "• Izjava o roku isplate štete, odnosno roku postupanja po odštetnom zahtjevu, ukoliko je tražena tenderskom dokumentacijom.", tdValue: "Rok obrade i isplate šteta: 14 dana od kompletiranja dokumentacije", status: "ready" },
      { id: "izj_8_2", itemNumber: "8.2", section: "dodatne_izjave", title: "Izjava o prihvatanju uslova iz tenderske dokumentacije.", deliverable: "• Izjava ponuđača da prihvata uslove, rokove, tehničku specifikaciju, način izvršenja usluge i ostale zahtjeve propisane tenderskom dokumentacijom, ukoliko je tražena tenderskom dokumentacijom.", tdValue: "Na memorandumu ASA Central ovjerena izjava", status: "ready" },
      { id: "izj_8_3", itemNumber: "8.3", section: "dodatne_izjave", title: "Izjava o uslovima osiguranja za vrste osiguranja koje su predmet nabavke.", deliverable: "• Izjava ponuđača koja se odnosi na primjenu uslova osiguranja za vrste osiguranja obuhvaćene predmetom nabavke.", tdValue: "Primjena važećih uslova ASA Central Osiguranja", status: "ready" },
      { id: "izj_8_4", itemNumber: "8.4", section: "dodatne_izjave", title: "Izjava o periodu važenja ponude.", deliverable: "• Izjava ponuđača da ponuda važi u periodu propisanom tenderskom dokumentacijom, ukoliko period važenja nije već sadržan u obrascu ponude.", tdValue: "Važenje: 60/90 dana od dana otvaranja ponuda", status: "ready" },
      { id: "izj_8_5", itemNumber: "8.5", section: "dodatne_izjave", title: "Izjava o dostavljanju garancije za uredno izvršenje ugovora.", deliverable: "• Izjava/aneks/obrazac kojim ponuđač potvrđuje da će, ukoliko bude izabran, dostaviti garanciju za uredno izvršenje ugovora u roku i na način propisan tenderskom dokumentacijom.", tdValue: "Ovjeren obrazac izjave o dostavljanju garancije", status: "ready" },
      { id: "izj_8_6", itemNumber: "8.6", section: "dodatne_izjave", title: "Izjava o podugovaranju.", deliverable: "• Izjava da ponuđač namjerava ili ne namjerava dio ugovora dati u podugovor, ukoliko je tražena tenderskom dokumentacijom.", tdValue: "Izjava da se usluga izvršava samostalno bez podugovaranja", status: "ready" },
      { id: "izj_8_7", itemNumber: "8.7", section: "dodatne_izjave", title: "Izjava o povjerljivim informacijama.", deliverable: "• Izjava/obrazac o povjerljivim informacijama, odnosno izjava da ponuda ne sadrži povjerljive informacije, ukoliko je tražena tenderskom dokumentacijom.", tdValue: "Ponuda ne sadrži povjerljive informacije osim poslovne tajne", status: "ready" },
      { id: "izj_8_8", itemNumber: "8.8", section: "dodatne_izjave", title: "Izjava o tačnosti i istinitosti dostavljenih podataka.", deliverable: "• Izjava ponuđača da su dostavljeni podaci i dokumenti tačni, potpuni i vjerodostojni, ukoliko je tražena tenderskom dokumentacijom.", tdValue: "Izjava na memorandumu o tačnosti dokumentacije", status: "ready" },
      { id: "izj_8_9", itemNumber: "8.9", section: "dodatne_izjave", title: "Izjava o tehničkoj specifikaciji / prihvatanju traženog obima pokrića.", deliverable: "• Izjava ponuđača da ponuđene usluge osiguranja odgovaraju tehničkoj specifikaciji, traženim pokrićima, osiguranim sumama, franšizama i drugim zahtjevima iz tenderske dokumentacije.", tdValue: "U potpunosti prihvaćena tehnička specifikacija i sume pokrića", status: "ready" },
      { id: "izj_8_10", itemNumber: "8.10", section: "dodatne_izjave", title: "Izjava o roku i načinu plaćanja.", deliverable: "• Izjava ponuđača da prihvata rok, način i uslove plaćanja propisane tenderskom dokumentacijom, ukoliko je takva izjava tražena tenderskom dokumentacijom.", tdValue: "Plaćanje prema ugovoru i uslovima plaćanja iz TD", status: "ready" },
      { id: "izj_8_11", itemNumber: "8.11", section: "dodatne_izjave", title: "Ostale posebne izjave tražene tenderskom dokumentacijom.", deliverable: "• Izjave koje nisu posebno navedene u ovoj check listi, a propisane su tenderskom dokumentacijom, njenim aneksima ili prilozima.", tdValue: "Provjeriti specifične anekse ugovornog organa", status: "in_progress" },
    ];

    return defaultItems;
  }, [tender, tenderTitle, contractingAuth]);

  const [items, setItems] = useState<AsaChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return initialData;
  });

  // Kada se promijeni tenderId ili initialData, sinkroniziraj ako nema pohranjeno
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      } else {
        setItems(initialData);
      }
    } catch {
      setItems(initialData);
    }
  }, [tenderId, initialData, storageKey]);

  // Spremi stanje na promjenu
  const saveItems = (updated: AsaChecklistItem[]) => {
    setItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  const toggleStatus = (id: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const cycle: ChecklistItemStatus[] = ["ready", "in_progress", "missing", "not_required"];
      const nextIdx = (cycle.indexOf(item.status) + 1) % cycle.length;
      return { ...item, status: cycle[nextIdx] };
    });
    saveItems(updated);
  };

  const updateTdValue = (id: string, val: string) => {
    const updated = items.map((item) => (item.id === id ? { ...item, tdValue: val } : item));
    saveItems(updated);
  };

  const handleReset = () => {
    localStorage.removeItem(storageKey);
    setItems(initialData);
    toast.success("Checklista je resetovana na zadane vrijednosti");
  };

  // Statistika
  const readyCount = items.filter((i) => i.status === "ready").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const notReqCount = items.filter((i) => i.status === "not_required").length;
  const applicableTotal = items.length - notReqCount;
  const percentReady = applicableTotal > 0 ? Math.round((readyCount / applicableTotal) * 100) : 100;

  // Proračun zakonskih rokova za Sekciju 9
  const isKonkurentski = (tender?.tenderType || "").toLowerCase().includes("konkurent");
  const pubDate = tender?.publicationDate ? new Date(tender.publicationDate) : null;
  const deadDate = tender?.deadline ? new Date(tender.deadline) : null;

  // Izračunati datumi
  const pojasnjenjeDays = isKonkurentski ? 3 : 10;
  const zalbaTdDays = isKonkurentski ? 5 : 10;
  const zalbaOdlukaDays = isKonkurentski ? 5 : 10;

  const pojasnjenjeDeadline = deadDate ? new Date(deadDate.getTime() - pojasnjenjeDays * 24 * 60 * 60 * 1000) : null;
  const zalbaTdDeadline = pubDate ? new Date(pubDate.getTime() + zalbaTdDays * 24 * 60 * 60 * 1000) : null;

  const [activeTabSection, setActiveTabSection] = useState<"sve" | "osnovni" | "kvalifikacije" | "izjave" | "rokovi">("sve");

  return (
    <div className="space-y-6">
      {/* HEADER KARTICA PREMA ASA CENTRAL INTERNOM DOKUMENTU */}
      <Card className="border border-slate-200 shadow-md overflow-hidden print:border-none print:shadow-none">
        <CardHeader className="bg-gradient-to-r from-[#002d82] to-[#001845] text-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Tenderi – interna check lista
                </span>
                <span className="text-xs text-blue-200">ASA Central Osiguranje d.d.</span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <ClipboardCheck className="w-7 h-7 text-emerald-400" />
                CHECK LISTA – TENDERI
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs leading-relaxed max-w-3xl">
                Pregled osnovnih elemenata postupka, sadržaja i dostavljanja ponude, kvalifikacijskih uslova, garancija, dodatnih izjava i rokova za pojašnjenja i žalbu.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Printaj listu
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-blue-200 hover:text-white hover:bg-white/10 text-xs h-9"
                title="Vrati na zadano"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            </div>
          </div>

          {/* PROGRESS BAR & STATISTIKA */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white/10 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] uppercase font-bold text-blue-200">Spremnost ponude</div>
              <div className="text-2xl font-black text-white mt-0.5">{percentReady}%</div>
              <Progress value={percentReady} className="h-1.5 mt-2 bg-white/20" />
            </div>
            <div className="bg-emerald-500/20 rounded-lg p-3 border border-emerald-400/30">
              <div className="text-[10px] uppercase font-bold text-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Spremno
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-0.5">{readyCount}</div>
              <div className="text-[10px] text-emerald-200/70">Zadovoljene stavke</div>
            </div>
            <div className="bg-amber-500/20 rounded-lg p-3 border border-amber-400/30">
              <div className="text-[10px] uppercase font-bold text-amber-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> U toku
              </div>
              <div className="text-2xl font-black text-amber-300 mt-0.5">{inProgressCount}</div>
              <div className="text-[10px] text-amber-200/70">Priprema u toku</div>
            </div>
            <div className="bg-rose-500/20 rounded-lg p-3 border border-rose-400/30">
              <div className="text-[10px] uppercase font-bold text-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" /> Nedostaje
              </div>
              <div className="text-2xl font-black text-rose-300 mt-0.5">{missingCount}</div>
              <div className="text-[10px] text-rose-200/70">Kritična dopuna</div>
            </div>
            <div className="bg-slate-500/20 rounded-lg p-3 border border-slate-400/30">
              <div className="text-[10px] uppercase font-bold text-slate-200">Ukupno stavki</div>
              <div className="text-2xl font-black text-white mt-0.5">{items.length}</div>
              <div className="text-[10px] text-slate-300">Stranice 1–3</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* FILTER TABS PO SEKCIJAMA */}
      <div className="flex flex-wrap gap-2 border-b pb-3 print:hidden">
        <Button
          variant={activeTabSection === "sve" ? "default" : "outline"}
          size="sm"
          className={activeTabSection === "sve" ? "bg-[#002d82]" : ""}
          onClick={() => setActiveTabSection("sve")}
        >
          Sve sekcije (1–9)
        </Button>
        <Button
          variant={activeTabSection === "osnovni" ? "default" : "outline"}
          size="sm"
          className={activeTabSection === "osnovni" ? "bg-[#002d82]" : ""}
          onClick={() => setActiveTabSection("osnovni")}
        >
          📋 Osnovni elementi i priprema
        </Button>
        <Button
          variant={activeTabSection === "kvalifikacije" ? "default" : "outline"}
          size="sm"
          className={activeTabSection === "kvalifikacije" ? "bg-[#002d82]" : ""}
          onClick={() => setActiveTabSection("kvalifikacije")}
        >
          🛡️ Kvalifikacijski uslovi (čl. 45–50)
        </Button>
        <Button
          variant={activeTabSection === "izjave" ? "default" : "outline"}
          size="sm"
          className={activeTabSection === "izjave" ? "bg-[#002d82]" : ""}
          onClick={() => setActiveTabSection("izjave")}
        >
          📑 Sukob interesa, Garancije &amp; Izjave
        </Button>
        <Button
          variant={activeTabSection === "rokovi" ? "default" : "outline"}
          size="sm"
          className={activeTabSection === "rokovi" ? "bg-[#002d82]" : ""}
          onClick={() => setActiveTabSection("rokovi")}
        >
          ⏱️ Pravni rokovi (Pojašnjenja &amp; Žalbe)
        </Button>
      </div>

      {/* ============================================================== */}
      {/* 1. OSNOVNI ELEMENTI POSTUPKA                                  */}
      {/* ============================================================== */}
      {(activeTabSection === "sve" || activeTabSection === "osnovni") && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              OSNOVNI ELEMENTI POSTUPKA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-3 w-1/3">STAVKA</th>
                    <th className="p-3 w-1/2">PODATAK / ZAHTJEV IZ TD</th>
                    <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.filter((i) => i.section === "osnovni").map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{item.title}</td>
                      <td className="p-3">
                        <Input
                          value={item.tdValue || ""}
                          onChange={(e) => updateTdValue(item.id, e.target.value)}
                          placeholder="Unesite zahtjev iz TD..."
                          className="h-8 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                        />
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================== */}
      {/* 2. SADRŽAJ, PRIPREMA I DOSTAVLJANJE PONUDE                      */}
      {/* ============================================================== */}
      {(activeTabSection === "sve" || activeTabSection === "osnovni") && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              SADRŽAJ, PRIPREMA I DOSTAVLJANJE PONUDE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-3 w-1/3">STAVKA</th>
                    <th className="p-3 w-1/2">PODATAK / ZAHTJEV IZ TD</th>
                    <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.filter((i) => i.section === "priprema").map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{item.title}</td>
                      <td className="p-3">
                        <Input
                          value={item.tdValue || ""}
                          onChange={(e) => updateTdValue(item.id, e.target.value)}
                          placeholder="Unesite zahtjev iz TD..."
                          className="h-8 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                        />
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================== */}
      {/* 3. KVALIFIKACIJSKI USLOVI (ČLAN 45 - 50 ZJN)                    */}
      {/* ============================================================== */}
      {(activeTabSection === "sve" || activeTabSection === "kvalifikacije") && (
        <div className="space-y-6">
          {/* 1. LIČNA SPOSOBNOST */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-700" />
                1. KVALIFIKACIJSKI USLOV – LIČNA SPOSOBNOST
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "c45_licna").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-amber-50/70 border-t border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                <strong>NAPOMENA: </strong>
                Dokumenti iz tač. 1.2, 1.3, 1.4. i 1.5. u pravilu se dostavljaju nakon prijema odluke o izboru najpovoljnijeg ponuđača, osim ako je tenderskom dokumentacijom izričito propisano da se dostavljaju odmah uz ponudu.
              </div>
            </CardContent>
          </Card>

          {/* 2. PROFESIONALNA DJELATNOST */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-700" />
                2. KVALIFIKACIJSKI USLOV – SPOSOBNOST OBAVLJANJA PROFESIONALNE DJELATNOSTI
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "c_profesionalna").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. EKONOMSKA I FINANSIJSKA SPOSOBNOST */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                3. KVALIFIKACIJSKI USLOV – EKONOMSKA I FINANSIJSKA SPOSOBNOST
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "c47_ekonomska").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 4. TEHNIČKA I PROFESIONALNA SPOSOBNOST */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700" />
                4. KVALIFIKACIJSKI USLOV – TEHNIČKA I PROFESIONALNA SPOSOBNOST
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "c48_tehnicka").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SUKOB INTERESA, GARANCIJE & DODATNE IZJAVE                  */}
      {/* ============================================================== */}
      {(activeTabSection === "sve" || activeTabSection === "izjave") && (
        <div className="space-y-6">
          {/* 5. SUKOB INTERESA ILI KORUPCIJA */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                5. DISKVALIFIKACIJA PO OSNOVU SUKOBA INTERESA ILI KORUPCIJE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "c52_korupcija").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 6. POVJERLJIVE INFORMACIJE */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-slate-600" />
                6. POVJERLJIVE INFORMACIJE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "povjerljivo").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 7. GARANCIJE */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                7. GARANCIJE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "garancije").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-amber-50/70 border-t border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                <strong>NAPOMENA: </strong>
                Posebno provjeriti da li je tenderskom dokumentacijom propisano da se uz ponudu dostavlja popunjen obrazac/aneks garancije za uredno izvršenje ugovora, izjava na memorandumu ponuđača ili se sama garancija dostavlja tek naknadno, nakon dodjele ugovora.
              </div>
            </CardContent>
          </Card>

          {/* 8. DODATNE IZJAVE */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                8. DODATNE IZJAVE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3 w-5/12">TRAŽENI DOKUMENT</th>
                      <th className="p-3 w-5/12">DOKUMENT KOJI SE DOSTAVLJA</th>
                      <th className="p-3 w-28 text-center print:hidden">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => i.section === "dodatne_izjave").map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-900">
                          {item.itemNumber && <span className="font-bold mr-1.5 text-blue-800">{item.itemNumber}</span>}
                          <span>{item.title}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-pre-line bg-slate-50/30">
                          {item.deliverable}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <StatusButton status={item.status} onClick={() => toggleStatus(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-amber-50/70 border-t border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                <strong>NAPOMENA: </strong>
                Dodatne izjave se dostavljaju samo ukoliko su izričito propisane tenderskom dokumentacijom, njenim aneksima ili prilozima. U zavisnosti od konkretnog postupka, pojedine izjave mogu biti sadržane u obrascima tenderske dokumentacije, dok se u drugim slučajevima dostavljaju kao posebne izjave na memorandumu ponuđača. Prilikom pripreme ponude potrebno je posebno provjeriti da li je za određenu izjavu propisan obavezni obrazac ili je dovoljno dostaviti izjavu u slobodnoj formi.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. ROKOVI ZA POJAŠNJENJA I IZJAVLJIVANJE ŽALBE (SEKCIJA 9)       */}
      {/* ============================================================== */}
      {(activeTabSection === "sve" || activeTabSection === "rokovi") && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-700" />
                9. ROKOVI ZA POJAŠNJENJA I IZJAVLJIVANJE ŽALBE
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-800 border-purple-200 font-medium">
                Zakon o javnim nabavkama BiH
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-3 w-1/4">RADNJA / SITUACIJA</th>
                    <th className="p-3 w-1/6">VRSTA POSTUPKA</th>
                    <th className="p-3 w-1/4">ROK ZA POSTUPANJE</th>
                    <th className="p-3 w-1/3">NAPOMENA / PRORAČUN DATUMA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Pojašnjenje tenderske dokumentacije</td>
                    <td className="p-3">Otvoreni postupak</td>
                    <td className="p-3 font-medium text-amber-800">Najkasnije 10 dana prije isteka roka za dostavljanje ponuda</td>
                    <td className="p-3 bg-slate-50/30">
                      {pojasnjenjeDeadline ? (
                        <span className="font-bold text-slate-900">
                          Krajnji rok za upit: {formatDate(pojasnjenjeDeadline.toISOString())}
                        </span>
                      ) : (
                        "U napomenu upisati datum objave i krajnji rok za postavljanje pitanja."
                      )}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Pojašnjenje tenderske dokumentacije</td>
                    <td className="p-3">Konkurentski zahtjev</td>
                    <td className="p-3 font-medium text-amber-800">Najkasnije 3 dana prije isteka roka za dostavljanje ponuda</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum objave i krajnji rok za postavljanje pitanja.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na sadržaj obavještenja ili tenderske dokumentacije</td>
                    <td className="p-3">Otvoreni postupak</td>
                    <td className="p-3 font-medium text-rose-800">10 dana od objave obavještenja, odnosno tenderske dokumentacije</td>
                    <td className="p-3 bg-slate-50/30">
                      {zalbaTdDeadline ? (
                        <span className="font-bold text-slate-900">
                          Krajnji rok za žalbu na TD: {formatDate(zalbaTdDeadline.toISOString())}
                        </span>
                      ) : (
                        "U napomenu upisati datum objave i krajnji rok za žalbu."
                      )}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na izmjenu i/ili dopunu tenderske dokumentacije</td>
                    <td className="p-3">Otvoreni postupak</td>
                    <td className="p-3 font-medium text-rose-800">10 dana od objave izmjene i/ili dopune</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum objave izmjene/dopune i krajnji rok za žalbu.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na objavu konkurentskog zahtjeva</td>
                    <td className="p-3">Konkurentski zahtjev</td>
                    <td className="p-3 font-medium text-rose-800">5 dana od objave konkurentskog zahtjeva</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum objave i krajnji rok za žalbu.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na radnje ili propuste u postupku otvaranja ponuda</td>
                    <td className="p-3">Otvoreni postupak / konkurentski zahtjev</td>
                    <td className="p-3 font-medium text-rose-800">5 dana od prijema zapisnika o otvaranju ponuda</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum prijema zapisnika i krajnji rok za žalbu.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na odluku o izboru najpovoljnijeg ponuđača ili odluku o poništenju postupka</td>
                    <td className="p-3">Otvoreni postupak</td>
                    <td className="p-3 font-medium text-rose-800">10 dana od prijema odluke</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum prijema odluke i krajnji rok za žalbu.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold">Žalba na odluku o izboru najpovoljnijeg ponuđača ili odluku o poništenju postupka</td>
                    <td className="p-3">Konkurentski zahtjev</td>
                    <td className="p-3 font-medium text-rose-800">5 dana od prijema odluke</td>
                    <td className="p-3 bg-slate-50/30">U napomenu upisati datum prijema odluke i krajnji rok za žalbu.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FOOTER U PRINT MODU */}
      <div className="hidden print:flex justify-between items-center text-[10px] text-gray-500 pt-4 border-t">
        <span>Tenderi – interna check lista · ASA Central Osiguranje d.d.</span>
        <span>Generisano iz ASA Tender Intelligence sistema</span>
      </div>
    </div>
  );
}

function StatusButton({ status, onClick }: { status: ChecklistItemStatus; onClick: () => void }) {
  if (status === "ready") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 flex items-center justify-center gap-1 mx-auto transition-colors w-full"
        title="Klikni za promjenu statusa"
      >
        <Check className="w-3 h-3 text-emerald-600" /> Spremno
      </button>
    );
  }
  if (status === "in_progress") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-2 py-1 rounded text-[11px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 flex items-center justify-center gap-1 mx-auto transition-colors w-full"
        title="Klikni za promjenu statusa"
      >
        <Clock className="w-3 h-3 text-amber-600" /> U toku
      </button>
    );
  }
  if (status === "missing") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-2 py-1 rounded text-[11px] font-bold bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 flex items-center justify-center gap-1 mx-auto transition-colors w-full"
        title="Klikni za promjenu statusa"
      >
        <AlertCircle className="w-3 h-3 text-rose-600" /> Fali
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 flex items-center justify-center gap-1 mx-auto transition-colors w-full"
      title="Klikni za promjenu statusa"
    >
      Nije traženo
    </button>
  );
}
