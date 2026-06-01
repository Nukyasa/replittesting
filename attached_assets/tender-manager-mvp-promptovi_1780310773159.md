# ASA Tender Intelligence — Kompletni MVP Promptovi v2
**Projekt:** `ejn.almir.zeljkovic` | Stack: Express/TypeScript + React/Vite + Drizzle ORM + PostgreSQL  
**API:** `https://open.ejn.gov.ba` (OData REST, bez auth)  
**Fokus:** Tenderi vezani za OSIGURANJE — real-time, live data, PDF preview

---

## CPV KODOVI ZA OSIGURANJE (koristi u svim filterima)

```
66510000 — Usluge osiguranja (sve vrste)
66512000 — Osiguranje od nezgode i zdravstveno
66512100 — Osiguranje od nezgode
66512200 — Medicinsko osiguranje
66513000 — Pravno osiguranje i svo ostalo
66514000 — Osiguranje robe, imovine i gubitka
66514100 — Osiguranje motornih vozila
66514110 — Automobilsko osiguranje (KASKO/AO)
66514120 — Osiguranje željezničkih vozila
66514130 — Osiguranje vazduhoplova
66514140 — Osiguranje plovila
66515000 — Osiguranje od požara i šteta
66515100 — Osiguranje od požara
66515200 — Osiguranje imovine
66515400 — Osiguranje od gubitka
66516000 — Osiguranje od odgovornosti
66516100 — Automobilsko osiguranje od odgovornosti
66517000 — Reosiguranje
66518000 — Posredovanje u osiguranju (brokeri)
66519000 — Procjena štete i aktuarski poslovi
```

---

## PROMPT 1 — EJN Insurance Filter + Backend Scraper Upgrade

```
Zadatak: Izmijeni EJN scraper da FILTRIRA SAMO tendere vezane za osiguranje i real-time ih 
vuče sa EJN API-a. Ovo je osnova cijelog projekta.

FAJLOVI: artifacts/api-server/src/services/ejnScraper.ts

1. DODAJ insurance filter konstantu na vrh fajla (ODMAH ispod importa):

const INSURANCE_CPV_PREFIXES = [
  '6651', '6652', '6653', '6654', '6655', '6656', '6657', '6658', '6659',
  '66000', '66100', '66200', '66300', '66400', '66500', '66600', '66700',
];

const INSURANCE_KEYWORDS = [
  'osiguranje', 'osiguranja', 'osiguravajuć', 'insurance', 'reosiguranje',
  'kasko', 'autoodgovornost', 'automobilsk', 'polica osiguranja', 'premija',
  'osiguran', 'zaštita od', 'pokrić', 'odštet', 'šteta', 'nezgod',
  'životno osiguranje', 'zdravstveno osiguranje', 'osiguranje imovine',
  'osiguranje voznog parka', 'osiguranje fleet', 'osiguranje flote',
  'kolektivno osiguranje', 'grupno osiguranje', 'osiguranje zaposlenika',
];

function isInsuranceTender(item: EjnAnnouncement): boolean {
  // Provjera CPV koda
  const cpv = (item.CpvCode || '').replace(/\./g, '').replace(/\s/g, '');
  const cpvMatch = INSURANCE_CPV_PREFIXES.some(prefix => cpv.startsWith(prefix));
  if (cpvMatch) return true;

  // Provjera naziva tendera
  const subject = (item.Subject || '').toLowerCase();
  const cpvName = (item.CpvName || '').toLowerCase();
  const combined = `${subject} ${cpvName}`;
  const keywordMatch = INSURANCE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
  if (keywordMatch) return true;

  return false;
}

2. U funkciji runEjnScraper(), ODMAH nakon što dobiješ items array iz API-a, dodaj filter:

// FILTRIRANJE — samo tenderi vezani za osiguranje
const insuranceItems = items.filter(isInsuranceTender);
logger.info({ total: items.length, insurance: insuranceItems.length }, 'Insurance filter applied');

// Dalje procesiranje samo insuranceItems (ne items)
for (const item of insuranceItems) {
  // ... ostatak koda ostaje isti
}

3. PROŠIRI OData upit da povuče VIŠE podataka odjednom (dodaj $filter za CPV):

const EJN_INSURANCE_FILTER = "startswith(CpvCode,'665') or startswith(CpvCode,'661') or startswith(CpvCode,'662') or startswith(CpvCode,'663') or startswith(CpvCode,'664') or startswith(CpvCode,'660') or contains(tolower(Subject),'osiguranj') or contains(tolower(Subject),'kasko') or contains(tolower(Subject),'insurance')";

// U fetch pozivu:
const params = new URLSearchParams({
  '$top': String(top),
  '$skip': String(skip),
  '$orderby': 'PublicationDate desc',
  '$format': 'json',
  '$filter': EJN_INSURANCE_FILTER,  // ← DODAJ OVO
});

4. DODAJ NOVU BACKEND RUTU za real-time EJN insurance pretragu:
   Fajl: artifacts/api-server/src/routes/ejn.ts

// Real-time insurance tenderi direktno sa EJN API-a (ne iz DB)
ejnRouter.get('/insurance-live', async (req, res) => {
  const top = req.query['$top'] || '20';
  const skip = req.query['$skip'] || '0';
  const search = req.query.search as string || '';
  
  const filterParts = [
    "startswith(CpvCode,'665') or startswith(CpvCode,'661') or contains(tolower(Subject),'osiguranj') or contains(tolower(Subject),'kasko')"
  ];
  
  if (search) {
    filterParts.push(`contains(tolower(Subject),'${search.toLowerCase()}')`);
  }
  
  const params = new URLSearchParams({
    '$top': String(top),
    '$skip': String(skip),
    '$orderby': 'PublicationDate desc',
    '$format': 'json',
    '$count': 'true',
    '$filter': filterParts.join(' and '),
  });
  
  const url = `https://open.ejn.gov.ba/Announcements?${params}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ASA-Tender-Intelligence/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'EJN API nije dostupan' });
  }
});

5. POVEĆAJ CRON učestalost na svakih 30 minuta (index.ts):
   Promijeni: '0 */2 * * *' → '*/30 * * * *'
   Ovo osigurava da svaki novi osiguravajući tender bude u sistemu za max 30 min.

6. Pokrenuti ručno: POST /api/scraper/run — pokreni odmah nakon deploya.
```

---

## PROMPT 2 — Real-time Live Feed (WebSocket ili Polling)

```
Zadatak: Napravi real-time live feed koji prikazuje NOVE tendere čim stignu, bez refresha stranice.

BACKEND — Server-Sent Events (SSE) ruta:
Fajl: artifacts/api-server/src/routes/scraper.ts
(scraperEvents EventEmitter već postoji u ovom fajlu)

Dodaj SSE endpoint koji emituje događaje kad stigne novi tender:

scraperRouter.get('/live-feed', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Pošalji heartbeat svake 30s da veza ostane živa
  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\ndata: {}\n\n');
  }, 30000);

  // Slušaj na nove tendere
  const onNewTender = (data: { tender: any; isInsurance: boolean }) => {
    if (data.isInsurance) {
      res.write(`event: new_insurance_tender\ndata: ${JSON.stringify(data.tender)}\n\n`);
    }
  };

  const onScraperProgress = (data: any) => {
    res.write(`event: scraper_progress\ndata: ${JSON.stringify(data)}\n\n`);
  };

  scraperEvents.on('new_tender', onNewTender);
  scraperEvents.on('progress', onScraperProgress);

  req.on('close', () => {
    clearInterval(heartbeat);
    scraperEvents.off('new_tender', onNewTender);
    scraperEvents.off('progress', onScraperProgress);
  });
});

U ejnScraper.ts, kad se ubaci novi tender, emituj event:
scraperEvents.emit('new_tender', { tender: savedTender, isInsurance: true });

FRONTEND — Live Feed komponenta:
Fajl: artifacts/tender-app/src/components/LiveFeed.tsx

import { useEffect, useState, useRef } from 'react';

interface LiveTender {
  id: string;
  title: string;
  contractingAuth: string;
  estimatedValue?: number;
  currency: string;
  deadline: string;
  receivedAt: string;
}

export const LiveFeed = () => {
  const [liveTenders, setLiveTenders] = useState<LiveTender[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('asa_auth_token');
    // SSE s auth headera ne podržava, pa šalji token kao query param
    const es = new EventSource(`/api/scraper/live-feed?token=${token}`);
    eventSourceRef.current = es;

    es.addEventListener('open', () => setConnected(true));
    
    es.addEventListener('new_insurance_tender', (e) => {
      const tender = JSON.parse(e.data);
      setLiveTenders(prev => [{
        ...tender,
        receivedAt: new Date().toISOString()
      }, ...prev].slice(0, 20)); // drži zadnjih 20
      setLastActivity(new Date());
      
      // Browser notifikacija ako je browser tab u pozadini
      if (document.hidden && Notification.permission === 'granted') {
        new Notification('Novi tender za osiguranje!', {
          body: tender.title,
          icon: '/favicon.ico'
        });
      }
    });

    es.addEventListener('scraper_progress', (e) => {
      const data = JSON.parse(e.data);
      if (data.tendersNew > 0) setLastActivity(new Date());
    });

    es.addEventListener('error', () => setConnected(false));

    return () => es.close();
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Status header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">
            {connected ? 'LIVE — Praćenje insurance tendera' : 'Prekinuta veza — rekonektujem...'}
          </span>
        </div>
        {lastActivity && (
          <span className="text-xs text-gray-500">
            Zadnja aktivnost: {lastActivity.toLocaleTimeString('bs-BA')}
          </span>
        )}
      </div>

      {/* Feed lista */}
      {liveTenders.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          Čekam nove tendere za osiguranje...
          <br />
          <span className="text-xs">Novi tenderi se pojavljuju svakih 30 minuta</span>
        </div>
      ) : (
        <div className="divide-y max-h-80 overflow-y-auto">
          {liveTenders.map((t, i) => (
            <div key={i} className={`p-3 hover:bg-blue-50 cursor-pointer transition-colors ${i === 0 ? 'bg-yellow-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {i === 0 && <span className="text-xs font-bold text-orange-600 uppercase">Novo</span>}
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.contractingAuth}</p>
                </div>
                <div className="text-right shrink-0">
                  {t.estimatedValue && (
                    <p className="text-xs font-semibold text-blue-800">
                      {new Intl.NumberFormat('de-DE').format(t.estimatedValue)} {t.currency}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(t.receivedAt).toLocaleTimeString('bs-BA')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Dodaj <LiveFeed /> na Dashboard stranicu u desnoj koloni.
Zatraži dozvolu za browser notifikacije pri prvom učitavanju:
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
```

---

## PROMPT 3 — Dashboard sa Live Insurance Statistikama

```
Zadatak: Dashboard koji prikazuje ISKLJUČIVO insurance tendere sa real-time EJN podacima.

Fajl: artifacts/tender-app/src/pages/Dashboard.tsx

INSURANCE CPV filter za sve API pozive:
const INSURANCE_FILTER = "startswith(CpvCode,'665') or startswith(CpvCode,'661') or contains(tolower(Subject),'osiguranj') or contains(tolower(Subject),'kasko')";

1. KPI KARTICE — 4 kartice, sve s insurance filterom:

const [stats, setStats] = useState({
  activeInsurance: 0,
  totalValue: 0,
  expiringIn7Days: 0,
  newThisWeek: 0,
});

useEffect(() => {
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
  const sevenDays = new Date(Date.now() + 7*24*60*60*1000).toISOString();

  Promise.all([
    // Aktivni insurance tenderi
    fetch(`/api/ejn/Announcements?$filter=(${INSURANCE_FILTER}) and StatusId eq 1&$count=true&$top=0&$format=json`).then(r=>r.json()),
    // Top 50 za vrijednost
    fetch(`/api/ejn/Announcements?$filter=(${INSURANCE_FILTER}) and StatusId eq 1 and EstimatedValue gt 0&$top=50&$select=EstimatedValue,CurrencyCode&$format=json`).then(r=>r.json()),
    // Ističu u 7 dana
    fetch(`/api/ejn/Announcements?$filter=(${INSURANCE_FILTER}) and StatusId eq 1 and DeadlineDate le ${sevenDays}&$count=true&$top=0&$format=json`).then(r=>r.json()),
    // Novi ove sedmice
    fetch(`/api/ejn/Announcements?$filter=(${INSURANCE_FILTER}) and PublicationDate ge ${weekAgo}T00:00:00Z&$count=true&$top=0&$format=json`).then(r=>r.json()),
  ]).then(([active, values, expiring, recent]) => {
    const totalValue = (values.value || []).reduce((s: number, t: any) => s + (t.EstimatedValue || 0), 0);
    setStats({
      activeInsurance: active['@odata.count'] || 0,
      totalValue,
      expiringIn7Days: expiring['@odata.count'] || 0,
      newThisWeek: recent['@odata.count'] || 0,
    });
  });
}, []);

KPI kartice prikaz:
- "Aktivni insurance tenderi" — plava (#1B3A6B)
- "Ukupna procijenjena vrijednost" — zlatna (#E8A020), format: "1.234.567 BAM"
- "Ističu u 7 dana" — crvena ako > 0, naranžasta inače
- "Novi ove sedmice" — zelena

2. GRAFIKON — Insurance tenderi po tipu (Pie chart):
fetch('/api/ejn/Announcements?$filter=('+INSURANCE_FILTER+') and StatusId eq 1&$top=100&$select=ProcurementType,CpvCode,CpvName&$format=json')
Grupiraj po CpvName ili ProcurementType, prikaži Pie chart s recharts.

3. LISTA — 5 najnovijih insurance tendera:
fetch('/api/ejn/Announcements?$filter=('+INSURANCE_FILTER+')&$top=5&$orderby=PublicationDate desc&$format=json')
Svaki red: Naziv | Ugovorni organ | Rok | Vrijednost | Status badge | "→ Detalji"

4. LIVEFEED komponenta (desna kolona):
import { LiveFeed } from '../components/LiveFeed';
<LiveFeed />

5. CRON STATUS kartica (mala, dno stranice):
fetch('/api/scraper/logs?limit=1').then prikaži:
- "Zadnji scrape: 23. maj u 14:30 — 12 novih insurance tendera"
- "Sljedeći scrape: za 28 minuta"
- Zelena tačka = radi | Crvena = greška

6. SKELETON LOADING za sve sekcije dok se podaci učitavaju.
7. ERROR BOUNDARY — ako EJN ne odgovara, prikaži "EJN API nedostupan" s Retry dugmetom.

Dizajn: #1B3A6B prim, #E8A020 accent, IBM Plex Sans font, rounded-lg kartice.
```

---

## PROMPT 4 — Lista Insurance Tendera + Pretraga

```
Zadatak: Stranica za pretragu ISKLJUČIVO insurance tendera s real-time EJN filterima.

Fajl: artifacts/tender-app/src/pages/TenderList.tsx
Ruta: /tenders

INSURANCE FILTER se primjenjuje uvijek — korisnik ne može ga isključiti, 
samo može dodatno sužavati unutar insurance kategorije.

const BASE_INSURANCE_FILTER = "(startswith(CpvCode,'665') or startswith(CpvCode,'661') or contains(tolower(Subject),'osiguranj') or contains(tolower(Subject),'kasko'))";

INSURANCE PODKATEGORIJE (filter dropdown):
const INSURANCE_SUBCATEGORIES = [
  { label: 'Sve kategorije', filter: '' },
  { label: 'Kasko i AO vozila', filter: "startswith(CpvCode,'66514')" },
  { label: 'Osiguranje imovine', filter: "startswith(CpvCode,'66515')" },
  { label: 'Kolektivno/zdravstveno', filter: "startswith(CpvCode,'66512')" },
  { label: 'Odgovornost prema trećim', filter: "startswith(CpvCode,'66516')" },
  { label: 'Reosiguranje', filter: "startswith(CpvCode,'66517')" },
  { label: 'Brokerske usluge', filter: "startswith(CpvCode,'66518')" },
  { label: 'Ostale insurance usluge', filter: "startswith(CpvCode,'66510')" },
];

OData FILTER BUILDER (kombinira uvijek insurance + korisnikove filtere):
const buildFilter = (f: Filters): string => {
  const parts = [BASE_INSURANCE_FILTER];
  if (f.search) parts.push(`contains(tolower(Subject),'${f.search.toLowerCase()}')`);
  if (f.status) parts.push(`StatusId eq ${f.status}`);
  if (f.subcategory) parts.push(f.subcategory);
  if (f.dateFrom) parts.push(`PublicationDate ge ${f.dateFrom}T00:00:00Z`);
  if (f.dateTo) parts.push(`PublicationDate le ${f.dateTo}T23:59:59Z`);
  if (f.minValue) parts.push(`EstimatedValue ge ${f.minValue}`);
  if (f.maxValue) parts.push(`EstimatedValue le ${f.maxValue}`);
  return parts.join(' and ');
};

FETCH s paginacijom:
const fetchTenders = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      '$top': String(pageSize),
      '$skip': String((page-1) * pageSize),
      '$count': 'true',
      '$orderby': sortBy,
      '$format': 'json',
      '$filter': buildFilter(filters),
    });
    const res = await fetch(`/api/ejn/Announcements?${params}`);
    const data = await res.json();
    setTenders(data.value || []);
    setTotal(data['@odata.count'] || 0);
  } finally {
    setLoading(false);
  }
};

KARTICA TENDERA prikazuje:
- CPV badge (npr "66514110 — Automobilsko osiguranje") u plavoj boji
- Naziv tendera (bold, max 2 linije)
- Ugovorni organ (italic)
- Datum objave | Rok (s CountdownTimer komponentom — crveno ako < 7 dana)
- Vrijednost: formatirana kao "123.456,00 BAM"
- Status badge: zeleno=Aktivan, crveno=Zatvoren, sivo=Poništen
- Dugme "★ Prati" (watchlist)
- Dugme "→ Detalji"
- Dugme "EJN ↗" (vanjski link)

HEADER stranice: "Tenderi za osiguranje — X pronađenih"
Badge ispod: "Filtriraju se samo tenderi s CPV kodom 665xx i ključnim riječima osiguranje"

Debounce pretragu 500ms.
Sortiranje: Najnoviji | Rok ↑ | Vrijednost ↑ | Vrijednost ↓
Paginacija: << < 1 2 3 > >> + "Prikazano 1-20 od 134 tendera"
```

---

## PROMPT 5 — Detalji Tendera + Historija Promjena + PDF

```
Zadatak: Stranica detalja tendera s prikazom historije promjena (tenderChanges) i PDF generacijom.

Fajl: artifacts/tender-app/src/pages/TenderDetail.tsx
Ruta: /tenders/:id

1. DUAL FETCH — EJN live + DB historija promjena:

useEffect(() => {
  const { id } = params; // route param (može biti EJN int ID ili naš UUID)
  
  // Pokušaj prvo kao EJN numerički ID (real-time)
  if (/^\d+$/.test(id)) {
    fetch(`/api/ejn/Announcements(${id})?$format=json`)
      .then(r => r.json())
      .then(setTender);
    fetch(`/api/ejn/AnnouncementDocuments?$filter=AnnouncementId eq ${id}&$format=json`)
      .then(r => r.json())
      .then(d => setDocuments(d.value || []));
    // Historija promjena iz našeg DB-a
    fetch(`/api/tenders/ejn-${id}/changes`)
      .then(r => r.json())
      .then(setChanges);
  } else {
    // UUID iz naše DB — fetch iz DB-a
    fetch(`/api/tenders/${id}`)
      .then(r => r.json())
      .then(data => { setTender(data.tender); setChanges(data.changes || []); });
  }
  
  // Slični insurance tenderi (isti CPV prefix)
  if (tender?.CpvCode) {
    const prefix = tender.CpvCode.slice(0, 5);
    fetch(`/api/ejn/Announcements?$filter=startswith(CpvCode,'${prefix}') and StatusId eq 1&$top=3&$format=json`)
      .then(r => r.json())
      .then(d => setSimilar((d.value || []).filter((t: any) => t.Id !== Number(id))));
  }
}, [id]);

2. DODAJ API RUTU za changes:
   Fajl: artifacts/api-server/src/routes/tenders.ts

router.get('/:id/changes', authMiddleware, async (req, res) => {
  // Traži po externalId ili id
  const tender = await db.select({ id: tendersTable.id })
    .from(tendersTable)
    .where(or(eq(tendersTable.id, req.params.id), eq(tendersTable.externalId, `EJN-${req.params.id}`)))
    .limit(1);
  
  if (!tender[0]) return res.json([]);
  
  const changes = await db.select().from(tenderChangesTable)
    .where(eq(tenderChangesTable.tenderId, tender[0].id))
    .orderBy(desc(tenderChangesTable.detectedAt))
    .limit(20);
  
  res.json(changes);
});

3. STRANICA prikazuje sve sekcije:

a) HEADER:
   - Naziv (h1, bold)
   - Status badge (Aktivan/Zatvoren/Poništen)
   - CPV badge: "66514110 — Automobilsko osiguranje"
   - Dugme "📄 Generiši PDF" | "★ Prati" | "↗ EJN Portal"

b) INFO GRID (2 kolone):
   Ugovorni organ | Datum objave | Rok za ponude (s CountdownTimer) | Vrijednost BAM
   Tip nabavke | CPV kod | E-aukcija | Kriterij dodjele | Garancija

c) COUNTDOWN TIMER:
const CountdownTimer = ({ deadline }) => {
  const [t, setT] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) return setT('ISTEKLO');
      const d = Math.floor(diff/86400000);
      const h = Math.floor((diff%86400000)/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      setT(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  const isUrgent = new Date(deadline).getTime() - Date.now() < 7*24*60*60*1000;
  return <span className={`font-mono font-bold ${isUrgent ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>{t}</span>;
};

d) DOKUMENTI (ako postoje):
   Lista s ikonama + dugme Download/Preuzmi

e) HISTORIJA PROMJENA (nova sekcija):
   Timeline prikaz promjena iz tenderChangesTable:
{changes.map(change => (
  <div key={change.id} className="flex gap-3 pb-4 border-b last:border-0">
    <div className="w-2 h-2 mt-2 rounded-full bg-orange-400 shrink-0" />
    <div>
      <p className="text-sm font-medium">
        {change.fieldName === 'status' ? '🔄 Status promijenjen' :
         change.fieldName === 'deadline' ? '📅 Rok promijenjen' :
         change.fieldName === 'estimatedValue' ? '💰 Vrijednost promijenjena' :
         `✏️ ${change.fieldName} promijenjen`}
      </p>
      <p className="text-xs text-gray-500">
        Prije: <span className="line-through">{change.oldValue}</span>
        {' → '} Poslije: <span className="font-semibold text-gray-800">{change.newValue}</span>
      </p>
      <p className="text-xs text-gray-400">{new Date(change.detectedAt).toLocaleString('bs-BA')}</p>
    </div>
  </div>
))}
Ako nema promjena: "Nema zabilježenih promjena"

f) SLIČNI INSURANCE TENDERI (3 kartice):
   Istog CPV prefiksa, status aktivan

4. PDF GENERACIJA — kompletan, profesionalan PDF:
Instaliraj: npm install jspdf (ako nije)

const generatePDF = async () => {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, M = 20;
  let y = 0;

  // Plavi header banner
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, W, 42, 'F');
  doc.setFillColor(232, 160, 32);
  doc.rect(0, 42, W, 2, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('ASA CENTRAL osiguranje d.d.', M, 16);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Tender Intelligence — Izvještaj o Tenderu', M, 26);
  doc.text(new Date().toLocaleDateString('bs-BA'), W-M, 26, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`EJN ID: ${tender.Id}`, M, 36);
  doc.text(`Generirano: ${new Date().toLocaleString('bs-BA')}`, W-M, 36, { align: 'right' });
  y = 54;

  // Status i CPV badge
  const statusColor: [number,number,number] = tender.StatusId === 1 ? [34,197,94] : [239,68,68];
  doc.setFillColor(...statusColor);
  doc.roundedRect(M, y, 32, 8, 2, 2, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(tender.StatusName || 'N/A', M+2, y+5.5);
  
  if (tender.CpvCode) {
    doc.setFillColor(27,58,107);
    doc.roundedRect(M+36, y, 80, 8, 2, 2, 'F');
    doc.setTextColor(255,255,255);
    doc.text(`CPV: ${tender.CpvCode} — ${(tender.CpvName||'').slice(0,35)}`, M+38, y+5.5);
  }
  y += 14;

  // Naziv tendera
  doc.setTextColor(27,58,107); doc.setFontSize(13); doc.setFont('helvetica','bold');
  const titleLines = doc.splitTextToSize(tender.Subject || 'Bez naziva', W-2*M);
  doc.text(titleLines, M, y);
  y += titleLines.length * 7 + 8;

  // Detalji tabela
  doc.setFontSize(9);
  const fields = [
    ['Ugovorni organ', tender.ContractingAuthorityName || 'N/A'],
    ['Datum objave', tender.PublicationDate ? new Date(tender.PublicationDate).toLocaleDateString('bs-BA') : 'N/A'],
    ['Rok za predaju ponude', tender.DeadlineDate ? new Date(tender.DeadlineDate).toLocaleDateString('bs-BA') + (new Date(tender.DeadlineDate) < new Date() ? ' [ISTEKLO]' : '') : 'N/A'],
    ['Procijenjena vrijednost', tender.EstimatedValue ? `${new Intl.NumberFormat('de-DE').format(tender.EstimatedValue)} ${tender.CurrencyCode||'BAM'}` : 'N/A'],
    ['Tip nabavke', tender.ProcurementType || 'N/A'],
    ['Kriterij dodjele', tender.AwardCriteria || 'N/A'],
    ['E-aukcija', tender.HasEAuction ? 'Da' : 'Ne'],
    ['Garancija', tender.RequiredGuaranteeAmount ? `${new Intl.NumberFormat('de-DE').format(tender.RequiredGuaranteeAmount)} ${tender.CurrencyCode||'BAM'} (${tender.RequiredGuaranteeType||'N/A'})` : 'N/A'],
    ['Trošak pripreme ponude', tender.TenderPreparationCost ? `${new Intl.NumberFormat('de-DE').format(tender.TenderPreparationCost)} BAM` : 'N/A'],
  ];

  fields.forEach(([label, value], i) => {
    if (y > 265) { doc.addPage(); y = 20; }
    const bg: [number,number,number] = i%2===0 ? [245,247,250] : [255,255,255];
    doc.setFillColor(...bg);
    const valLines = doc.splitTextToSize(String(value), W-M-72);
    const rowH = Math.max(valLines.length*5+4, 9);
    doc.rect(M, y-3, W-2*M, rowH, 'F');
    doc.setTextColor(120); doc.setFont('helvetica','bold');
    doc.text(label + ':', M+2, y+2);
    doc.setTextColor(30); doc.setFont('helvetica','normal');
    doc.text(valLines, M+70, y+2);
    y += rowH + 1;
  });

  // Historija promjena
  if (changes && changes.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 6;
    doc.setFillColor(27,58,107); doc.rect(M, y, W-2*M, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Historija promjena', M+3, y+5);
    y += 10;
    changes.slice(0,5).forEach(ch => {
      if (y > 270) return;
      doc.setTextColor(0); doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text(`• ${new Date(ch.detectedAt).toLocaleDateString('bs-BA')} — ${ch.fieldName}: "${ch.oldValue}" → "${ch.newValue}"`, M+3, y);
      y += 6;
    });
  }

  // EJN link
  y += 5;
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setTextColor(27,58,107); doc.setFontSize(8);
  const ejnUrl = `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/${tender.Id}`;
  doc.text('EJN Portal link:', M, y);
  doc.textWithLink(ejnUrl, M, y+5, { url: ejnUrl });

  // Footer na svakoj stranici
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.line(M, 285, W-M, 285);
    doc.text('ASA CENTRAL osiguranje d.d. — Tender Intelligence', M, 290);
    doc.text(`${i}/${pages}`, W-M, 290, { align: 'right' });
  }

  doc.save(`insurance-tender-${tender.Id}-${new Date().toISOString().split('T')[0]}.pdf`);
};
```

---

## PROMPT 6 — Notifikacije UI (Bell + Dropdown)

```
Zadatak: Dodaj Notifikacije bell ikonu u header s dropdown-om koji prikazuje notifikacije 
iz DB-a. Backend notifikationsRouter već postoji i radi.

Fajl: artifacts/tender-app/src/components/NotificationBell.tsx

import { useState, useEffect, useRef } from 'react';

interface Notification {
  id: string;
  type: 'deadline' | 'new_tender' | 'status_change';
  title: string;
  message: string;
  tenderId?: string;
  read: boolean;
  createdAt: string;
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${localStorage.getItem('asa_auth_token')}` }
    });
    if (res.ok) setNotifications(await res.json());
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh svaku minutu
    return () => clearInterval(interval);
  }, []);

  // Zatvori dropdown klikom izvan
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('asa_auth_token')}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('asa_auth_token')}` }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (type: string) => type === 'deadline' ? '⏰' : type === 'new_tender' ? '🔔' : '🔄';

  return (
    <div className="relative" ref={ref}>
      {/* Bell dugme */}
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold text-sm text-gray-800">Notifikacije</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Označi sve kao pročitano
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Nema notifikacija</div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50' : ''}`}
              >
                <div className="flex gap-2">
                  <span className="text-lg">{getIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-gray-900`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('bs-BA')}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

INTEGRACIJA u Header:
U fajlu gdje je definisan Header/Navbar — dodaj <NotificationBell /> desno od navigacije.
Import: import { NotificationBell } from '../components/NotificationBell';

BACKEND UPGRADE — dodaj notifikaciju za nove insurance tendere:
U ejnScraper.ts, u sendHighRelevanceNotifications funkciji, filtriraj da šalješ samo insurance:
Dodaj provjeru: const isInsurance = isInsuranceTender(tender); 
Pošalji notifikaciju samo ako isInsurance === true, s title: "Novi insurance tender!"
```

---

## PROMPT 7 — Login/Register UI (Auth stranice)

```
Zadatak: Napravi Login i Register stranice. Backend auth rute već postoje i rade 
(POST /api/auth/login, POST /api/auth/register).

FAJLOVI:
- artifacts/tender-app/src/pages/Login.tsx
- artifacts/tender-app/src/pages/Register.tsx  
- artifacts/tender-app/src/hooks/use-auth.ts (vjerovatno postoji, provjeri)
- artifacts/tender-app/src/lib/auth-init.ts (postoji)

1. AUTH CONTEXT — provjeri da li use-auth.ts postoji:
Ako ne postoji, napravi:

// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

interface User { id: string; email: string; name: string; role: string; }
interface AuthCtx { user: User | null; token: string | null; login: (email: string, password: string) => Promise<void>; logout: () => void; loading: boolean; }

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('asa_auth_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user) setUser(data.user); else logout(); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Greška pri prijavi');
    localStorage.setItem('asa_auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('asa_auth_token');
    setToken(null); setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth mora biti unutar AuthProvider'); return ctx; };

2. LOGIN STRANICA (Login.tsx):
- Logo/brand: "ASA Tender Intelligence" + podnaslov "Sistem za praćenje insurance tendera"
- Email input (type="email")
- Password input (type="password") s show/hide toggle
- Dugme "Prijavi se" (loading state dok čeka API)
- Error poruka ispod dugmeta (crvena)
- Link "Još nemaš račun? Registracija"
- Dizajn: Split-screen — lijevo plava (#1B3A6B) s logom i opisom, desno bijeli login form
- Nakon uspješne prijave → navigate('/dashboard')
- Default test credentials u placeholder: almir.zeljkovic@asa.ba

3. REGISTER STRANICA (Register.tsx):
- Ime i prezime
- Email
- Password + Confirm password (validacija da se podudaraju)
- POST /api/auth/register — dodaj ovu rutu u auth.ts ako ne postoji:

authRouter.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Sva polja su obavezna' });
  if (password.length < 6) return res.status(400).json({ error: 'Lozinka mora imati min 6 znakova' });
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) return res.status(409).json({ error: 'Email je već registrovan' });
  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ id: nanoid(), name, email, password: hashed, role: 'user' }).returning();
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser });
});

4. PROTECTED ROUTE wrapper:
// src/components/ProtectedRoute.tsx
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Učitavam...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

5. ROUTER UPDATE (App.tsx):
Omotaj sve stranice osim /login i /register u <ProtectedRoute>.

6. LOGOUT dugme u headeru: useAuth().logout() + navigate('/login')
```

---

## PROMPT 8 — Error Boundary + Global Error Handling

```
Zadatak: Dodaj Error Boundary koji hvata React greške i prikazuje user-friendly poruku,
plus globalni handler za failed EJN API pozive.

1. ERROR BOUNDARY KOMPONENTA:
Fajl: artifacts/tender-app/src/components/ErrorBoundary.tsx

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-64 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Nešto je pošlo po krivu</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            {this.state.error?.message || 'Neočekivana greška. Pokušaj osvježiti stranicu.'}
          </p>
          <div className="flex gap-3">
            <button onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Pokušaj ponovo
            </button>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Osvježi stranicu
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

2. INTEGRACIJA — omotaj svaku stranicu:
// App.tsx ili router
<Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
// ... isto za sve ostale rute

3. EJN API WRAPPER s retry logikom:
Fajl: artifacts/tender-app/src/api/ejn.ts

const MAX_RETRIES = 2;
const RETRY_DELAY = 1500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const ejnFetch = async (path: string, params: Record<string,string> = {}, retries = MAX_RETRIES): Promise<any> => {
  const defaults = { '$format': 'json' };
  const q = new URLSearchParams({ ...defaults, ...params }).toString();
  const url = `/api/ejn/${path}${q ? '?' + q : ''}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.status === 502 || res.status === 503) {
        if (attempt < retries) { await sleep(RETRY_DELAY * (attempt + 1)); continue; }
        throw new Error('EJN API nije dostupan. Pokušaj ponovo za nekoliko minuta.');
      }
      if (!res.ok) throw new Error(`API greška: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(RETRY_DELAY * (attempt + 1));
    }
  }
};

4. TOAST NOTIFIKACIJE za greške (koristiti postojeći use-toast.ts):
Kad ejnFetch baci grešku, hvataj je i prikaži toast:

try {
  const data = await ejnFetch('Announcements', params);
  setTenders(data.value || []);
} catch (err) {
  toast({ title: 'Greška', description: err.message, variant: 'destructive' });
  setTenders([]); // prikaži praznu listu, ne ruši stranicu
}

5. OFFLINE DETECTION:
window.addEventListener('offline', () => toast({ title: 'Nema internet veze', variant: 'destructive' }));
window.addEventListener('online', () => toast({ title: 'Veza obnovljena ✓', variant: 'success' }));
Dodaj ovo u App.tsx useEffect.
```

---

## PROMPT 9 — Cron Status Dashboard + Scraper Monitoring

```
Zadatak: Dodaj vidljivost cron job statusa — kad je zadnji scrape bio, koliko tendera je nađeno,
da li cron radi. Scraper logs table već postoji u DB.

BACKEND — Provjeri da postoji /api/scraper/logs ruta u scraper.ts.
Ako ne postoji, dodaj:

scraperRouter.get('/logs', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const logs = await db.select().from(scraperLogsTable)
    .orderBy(desc(scraperLogsTable.startedAt))
    .limit(limit);
  
  // Dodaj procjenu sljedećeg pokretanja (svakih 30 minuta)
  const lastLog = logs[0];
  const nextRun = lastLog 
    ? new Date(new Date(lastLog.startedAt).getTime() + 30 * 60 * 1000)
    : new Date(Date.now() + 30 * 60 * 1000);
  
  res.json({ logs, nextRun: nextRun.toISOString() });
});

FRONTEND — CronStatusCard komponenta:
Fajl: artifacts/tender-app/src/components/CronStatusCard.tsx

export const CronStatusCard = () => {
  const [data, setData] = useState<{ logs: ScraperLog[]; nextRun: string } | null>(null);
  const [timeToNext, setTimeToNext] = useState('');

  useEffect(() => {
    const fetchLogs = () => fetch('/api/scraper/logs?limit=5', {
      headers: { Authorization: `Bearer ${localStorage.getItem('asa_auth_token')}` }
    }).then(r => r.json()).then(setData);
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, []);

  // Countdown do sljedećeg scrape-a
  useEffect(() => {
    if (!data?.nextRun) return;
    const timer = setInterval(() => {
      const diff = new Date(data.nextRun).getTime() - Date.now();
      if (diff <= 0) { setTimeToNext('Upravo sad...'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeToNext(`za ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.nextRun]);

  const lastLog = data?.logs[0];
  const isHealthy = lastLog?.status === 'completed' && 
    new Date(lastLog.startedAt).getTime() > Date.now() - 2 * 60 * 60 * 1000; // unutar 2h

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Status EJN Scrapera</h3>
        <div className={`flex items-center gap-1.5 text-xs ${isHealthy ? 'text-green-600' : 'text-red-500'}`}>
          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isHealthy ? 'Aktivan' : 'Problem'}
        </div>
      </div>

      {lastLog && (
        <div className="space-y-1.5 text-xs text-gray-600 mb-3">
          <div className="flex justify-between">
            <span>Zadnji scrape:</span>
            <span className="font-medium">{new Date(lastLog.startedAt).toLocaleString('bs-BA')}</span>
          </div>
          <div className="flex justify-between">
            <span>Insurance tendera:</span>
            <span className={`font-bold ${(lastLog.tendersNew || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {lastLog.tendersNew || 0} novih
            </span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`font-medium ${lastLog.status === 'completed' ? 'text-green-600' : lastLog.status === 'failed' ? 'text-red-600' : 'text-orange-500'}`}>
              {lastLog.status === 'completed' ? 'Uspješno' : lastLog.status === 'failed' ? 'Greška' : 'U toku...'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sljedeći scrape:</span>
            <span className="font-medium text-blue-700">{timeToNext}</span>
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          const res = await fetch('/api/scraper/run', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('asa_auth_token')}` }
          });
          if (res.ok) toast('Scrape pokrenut ✓');
        }}
        className="w-full py-1.5 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium"
      >
        ▶ Pokreni ručno
      </button>

      {/* Historija zadnjih 5 scrape-ova */}
      {data?.logs && data.logs.length > 1 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-400 mb-2">Historija</p>
          {data.logs.slice(1).map((log, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5">
              <span className="text-gray-500">{new Date(log.startedAt).toLocaleDateString('bs-BA')}</span>
              <span className={log.status === 'completed' ? 'text-green-600' : 'text-red-500'}>
                {log.tendersNew || 0} novih
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Dodaj <CronStatusCard /> na Dashboard (dno desne kolone, ispod LiveFeed).
```

---

## PROMPT 10 — Ugovorni Organi (Insurance Buyers profili)

```
Zadatak: Stranica za pretragu ugovornih organa koji OBJAVLJUJU insurance tendere.

Fajl: artifacts/tender-app/src/pages/Authorities.tsx
Ruta: /authorities

FETCH — Ugovorni organi koji su objavljivali insurance tendere:
// Povuci insurance tendere i grupiraj po ugovornom organu
const fetchAuthorities = async () => {
  const res = await fetch('/api/ejn/Announcements?$filter=(startswith(CpvCode,\'665\') or contains(tolower(Subject),\'osiguranj\'))&$top=500&$select=ContractingAuthorityName,ContractingAuthorityCityName,StatusId,EstimatedValue,CurrencyCode,PublicationDate,Id&$format=json');
  const data = await res.json();
  const tenders = data.value || [];
  
  // Grupiraj po ugovornom organu
  const authMap: Record<string, {
    name: string; city: string; count: number; totalValue: number;
    lastTenderDate: string; activeTenders: number; tenderIds: number[];
  }> = {};
  
  tenders.forEach((t: any) => {
    const key = t.ContractingAuthorityName;
    if (!authMap[key]) authMap[key] = { name: key, city: t.ContractingAuthorityCityName, count: 0, totalValue: 0, lastTenderDate: t.PublicationDate, activeTenders: 0, tenderIds: [] };
    authMap[key].count++;
    authMap[key].totalValue += t.EstimatedValue || 0;
    authMap[key].tenderIds.push(t.Id);
    if (t.StatusId === 1) authMap[key].activeTenders++;
    if (t.PublicationDate > authMap[key].lastTenderDate) authMap[key].lastTenderDate = t.PublicationDate;
  });
  
  return Object.values(authMap).sort((a,b) => b.count - a.count);
};

PRIKAZ:
- Pretraga po nazivu ugovornog organa (filter lokalni, ne API)
- Kartica svakog organa:
  - Naziv (bold) + Grad
  - Broj insurance tendera | Ukupna vrijednost BAM
  - Aktivnih tendera (badge zelena)
  - Zadnji tender: datum
  - Dugme "Pregledaj tendere →" → navigate('/tenders') s filterom na ovaj organ
- Sortiranje: Po broju tendera | Po ukupnoj vrijednosti | Naziv A-Z
- TOP 3 kartice posebno istaknute (zlatna bordura)
```

---

## PROMPT 11 — Watchlist + Batch PDF Export

```
Zadatak: Watchlist za insurance tendere s batch PDF exportom.

Fajl: artifacts/tender-app/src/pages/Watchlist.tsx
Ruta: /watchlist

1. STORAGE:
const WATCHLIST_KEY = 'asa_insurance_watchlist_v2';
(iste funkcije add/remove/isWatched kao u prethodnim promptovima)

2. PROVJERA AŽURIRANJA (checkUpdates):
Za svaki praćeni tender, pozovi live EJN API i provjeri promjene:
- StatusId promijenjen → badge "STATUS PROMIJENJEN" + naranžasta kartica
- DeadlineDate promijenjen → badge "ROK PROMIJENJEN" + crvena kartica
- EstimatedValue promijenjen → badge "VRIJEDNOST PROMIJENJENA"

3. BATCH PDF EXPORT:
Instaliraj: npm install jspdf (ako nije)

const exportWatchlistPDF = () => {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    const W = 297, M = 15;
    
    // Header
    doc.setFillColor(27,58,107); doc.rect(0,0,W,32,'F');
    doc.setFillColor(232,160,32); doc.rect(0,32,W,2,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('ASA CENTRAL osiguranje — Watchlist', M, 14);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Praćeni insurance tenderi: ${watchlist.length} | Generirano: ${new Date().toLocaleString('bs-BA')}`, M, 24);
    
    let y = 42;
    // Tabela header
    doc.setFillColor(232,160,32);
    doc.rect(M, y, W-2*M, 8, 'F');
    doc.setTextColor(27,58,107); doc.setFontSize(8); doc.setFont('helvetica','bold');
    const cols = [8, 75, 55, 25, 28, 35, 30, 22]; // column widths
    const headers = ['ID', 'Naziv tendera', 'Ugovorni organ', 'Dodano', 'Rok', 'Vrijednost BAM', 'Status', 'Promjena'];
    let x = M+2;
    headers.forEach((h,i) => { doc.text(h, x, y+5); x+=cols[i]; });
    y += 10;
    
    watchlist.forEach((t, i) => {
      if (y > 185) { doc.addPage(); y = 20; }
      const bg: [number,number,number] = t.hasUpdate ? [255,243,205] : i%2===0 ? [245,247,250] : [255,255,255];
      doc.setFillColor(...bg); doc.rect(M, y, W-2*M, 7, 'F');
      doc.setTextColor(0); doc.setFont('helvetica','normal'); doc.setFontSize(7);
      const cells = [
        String(t.Id||''),
        (t.Subject||t.title||'').slice(0,44),
        (t.ContractingAuthorityName||t.contractingAuth||'').slice(0,30),
        t.addedAt ? new Date(t.addedAt).toLocaleDateString('bs-BA') : '',
        t.DeadlineDate||t.deadline ? new Date(t.DeadlineDate||t.deadline).toLocaleDateString('bs-BA') : '',
        t.EstimatedValue||t.estimatedValue ? new Intl.NumberFormat('de-DE').format(t.EstimatedValue||t.estimatedValue) : 'N/A',
        t.StatusName||t.status||'',
        t.hasUpdate ? '⚠ DA' : 'Ne',
      ];
      x = M+2;
      cells.forEach((c,i) => { doc.text(String(c), x, y+4.5); x+=cols[i]; });
      y += 8;
    });
    
    const pages = doc.getNumberOfPages();
    for (let i=1; i<=pages; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`ASA CENTRAL osiguranje — ${i}/${pages}`, W/2, 205, { align: 'center' });
    }
    
    doc.save(`insurance-watchlist-${new Date().toISOString().split('T')[0]}.pdf`);
  });
};

Dugme na vrhu stranice: "📄 Export Watchliste u PDF" → exportWatchlistPDF()
```

---

## PROMPT 12 — Settings (API ključ, Tema, Insurance profil)

```
Zadatak: Settings stranica s insurance-specifičnim podešavanjima.

Fajl: artifacts/tender-app/src/pages/Settings.tsx
Ruta: /settings

SEKCIJE:

1. KOMPANIJSKI PROFIL (nova sekcija):
- Naziv kompanije: "ASA CENTRAL osiguranje d.d." (read-only, prikazano)
- Praćene CPV kategorije: multiselect checkbox za odabir koje CPV podkategorije pratiti
  (Kasko/AO, Imovinska, Kolektivna, Odgovornost, Reosiguranje, Brokerske)
- Minimalna vrijednost tendera za notifikaciju: number input (default: 50000 BAM)
- Geografski fokus: FBiH / RS / BD / Sve (radio buttons)

2. AI INTEGRACIJA:
- Anthropic API ključ: password input
- Dugme "Test" → kratki test call pa prikaži "✓ API ključ validan"
- Napomena: "Ključ se čuva lokalno u browseru"

3. NOTIFIKACIJE:
- Email notifikacije: toggle (backend ne podržava još, prikaži "Coming soon")
- Browser notifikacije: toggle → pozovi Notification.requestPermission()
- Deadline upozorenje: X dana prije (default 7, slider 1-30)
- Notify samo za vrijednost > X BAM (number input)

4. PODRAZUMIJEVANI FILTERI:
- Default stranica za tendere: Status Aktivan / Svi
- Broj po stranici: 20 / 50 / 100
- Sortiranje: Najnoviji / Rok / Vrijednost

5. OPASNA ZONA:
- "Obriši Watchlist" s confirm dialogom
- "Resetuj sve postavke"

Sve čuvati u localStorage key 'asa_settings_v2'.
Toast "Postavke sačuvane ✓" nakon save.
```

---

## REDOSLJED PRIMJENE (VAŽNO — NE MIJENJAJ)

| Korak | Prompt | Zašto je ovaj redosljed |
|-------|--------|------------------------|
| 1 | **PROMPT 1** — Insurance Filter + Scraper | Osnova — bez ovoga sve vuče pogrešne tendere |
| 2 | **PROMPT 8** — Error Boundary | Mora biti rano — štiti od crash-eva |
| 3 | **PROMPT 7** — Auth UI | Login mora raditi prije svega |
| 4 | **PROMPT 3** — Dashboard live | Prva stvar koju korisnik vidi |
| 5 | **PROMPT 4** — Lista tendera | Core funkcionalnost |
| 6 | **PROMPT 2** — Real-time Live Feed | Dependira na PROMPT 1 scraper |
| 7 | **PROMPT 5** — Detalji + PDF | Dependira na listu |
| 8 | **PROMPT 6** — Notifikacije bell | Backend već postoji |
| 9 | **PROMPT 9** — Cron Status | Monitoring za admin |
| 10 | **PROMPT 11** — Watchlist + Batch PDF | Dependira na detalje |
| 11 | **PROMPT 10** — Ugovorni organi | Analitička stranica |
| 12 | **PROMPT 12** — Settings | Na kraju |

---

## QUICK VALIDATION CHECKLIST

Nakon svakog prompta testiraj u browser console:

```javascript
// Test 1: Insurance filter radi
fetch('/api/ejn/Announcements?$filter=startswith(CpvCode,\'665\') or contains(tolower(Subject),\'osiguranj\')&$top=5&$format=json')
  .then(r=>r.json()).then(d=>console.log('Insurance tenderi:', d.value?.length, d.value?.[0]?.Subject))

// Test 2: Proxy radi
fetch('/api/ejn/Announcements?$top=1&$format=json').then(r=>console.log('Proxy status:', r.status))

// Test 3: Auth radi  
fetch('/api/auth/me', {headers:{Authorization:`Bearer ${localStorage.getItem('asa_auth_token')}`}})
  .then(r=>r.json()).then(console.log)

// Test 4: Notifikacije
fetch('/api/notifications', {headers:{Authorization:`Bearer ${localStorage.getItem('asa_auth_token')}`}})
  .then(r=>r.json()).then(d=>console.log('Notifikacije:', d.length))

// Test 5: Scraper logs
fetch('/api/scraper/logs?limit=3', {headers:{Authorization:`Bearer ${localStorage.getItem('asa_auth_token')}`}})
  .then(r=>r.json()).then(console.log)
```

Sve 5 testova mora proći ✓ — tek onda idi na sljedeći prompt.
