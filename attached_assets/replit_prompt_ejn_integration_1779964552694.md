# REPLIT PROMPT — ASA Tender Intelligence: Potpuna Integracija EJN API-a

## KONTEKST I CILJ

Postojeći sajt ASA Tender Intelligence treba **potpunu adaptaciju** kako bi koristio živu podatke sa **https://next.ejn.gov.ba** (Elektronski sistem javnih nabavki BiH). Trenutno pola opcija na sajtu ne radi. Zadatak je:

1. Integrisati EJN open data API (`https://open.ejn.gov.ba`) kao primarni izvor podataka
2. Popraviti sve nefunkcionalne sekcije
3. Dodati kompletnu analizu tendera
4. Osigurati da sve stranice/opcije rade ispravno

---

## EJN API — KAKO RADI

EJN koristi **OData REST API** na bazi `https://open.ejn.gov.ba`.

### Ključni endpointi (koristiti direktno u fetch pozivima):

```
Obavještenja (tenderi):
GET https://open.ejn.gov.ba/Announcements?$top=20&$skip=0&$orderby=PublicationDate desc&$format=json

Filtriranje po statusu:
GET https://open.ejn.gov.ba/Announcements?$filter=StatusId eq 1&$top=20&$format=json

Pretraga po tekstu:
GET https://open.ejn.gov.ba/Announcements?$filter=contains(Subject,'voda')&$format=json

Nabavke (procurements):
GET https://open.ejn.gov.ba/Procurements?$top=20&$format=json

Ugovorni organi:
GET https://open.ejn.gov.ba/ContractingAuthorities?$top=20&$format=json

Ponuđači/Dobavljači:
GET https://open.ejn.gov.ba/Suppliers?$top=20&$format=json

Odluke o dodjeli:
GET https://open.ejn.gov.ba/AwardDecisions?$top=20&$format=json

Statistika:
GET https://open.ejn.gov.ba/Statistics?$format=json

Detalji jednog obavještenja (po ID):
GET https://open.ejn.gov.ba/Announcements(ID)?$format=json
```

### OData parametri koje treba koristiti:
- `$top=N` — broj rezultata
- `$skip=N` — paginacija (preskoci)
- `$orderby=PublicationDate desc` — sortiranje
- `$filter=...` — filtriranje (OData sintaksa)
- `$select=Id,Subject,PublicationDate,DeadlineDate,EstimatedValue,CurrencyCode` — odabir polja
- `$format=json` — JSON format (obavezno)
- `$count=true` — dobiti ukupan broj rezultata

### Primjer fetch poziva:
```javascript
const fetchTenders = async (filters = {}) => {
  const params = new URLSearchParams({
    '$top': filters.limit || 20,
    '$skip': filters.skip || 0,
    '$orderby': 'PublicationDate desc',
    '$format': 'json',
    '$count': 'true'
  });
  
  if (filters.search) {
    params.set('$filter', `contains(Subject,'${filters.search}')`);
  }
  
  const res = await fetch(`https://open.ejn.gov.ba/Announcements?${params}`);
  const data = await res.json();
  return data; // data.value = array, data['@odata.count'] = total
};
```

### Ključna polja u Announcement objektu:
- `Id` — jedinstveni ID
- `Subject` — naziv tendera
- `PublicationDate` — datum objave
- `DeadlineDate` — rok za ponude
- `EstimatedValue` — procijenjena vrijednost
- `CurrencyCode` — valuta (BAM, EUR...)
- `ContractingAuthorityName` — naziv ugovornog organa
- `ProcurementType` — tip nabavke
- `StatusId` / `StatusName` — status (1=aktivan, 2=zatvoren, itd.)
- `CpvCode` — CPV kod (kategorija)
- `AnnouncementUrl` — link na EJN portal za detalje

---

## ŠTA TREBA POPRAVITI I IMPLEMENTIRATI

### 1. DASHBOARD (Početna stranica)

Trenutni problem: statistike su hardkodirane ili prazne.

**Riješenje** — povući live podatke:
```javascript
// Ukupan broj aktivnih tendera
fetch('https://open.ejn.gov.ba/Announcements?$filter=StatusId eq 1&$count=true&$top=0&$format=json')

// Ukupna vrijednost tendera ovog mjeseca
fetch('https://open.ejn.gov.ba/Announcements?$filter=month(PublicationDate) eq ' + new Date().getMonth()+1 + '&$format=json')

// Broj ugovornih organa
fetch('https://open.ejn.gov.ba/ContractingAuthorities?$count=true&$top=0&$format=json')
```

Dashboard treba prikazivati:
- Broj aktivnih tendera (live)
- Ukupna procijenjena vrijednost (sumirati EstimatedValue)
- Broj novih tendera danas/ove sedmice
- Broj ugovornih organa
- Grafikon: tenderi po tipu (pie chart)
- Grafikon: trend objava po danima/sedmicama (line chart)
- Lista 5 najnovijih tendera

### 2. STRANICA ZA PRETRAGU TENDERA (`/tenders`)

Trenutni problem: pretraga ne radi, filteri prazni.

**Implementirati**:
```javascript
// Kompleksna pretraga s više filtera
const buildODataFilter = (filters) => {
  const conditions = [];
  if (filters.search) conditions.push(`contains(Subject,'${filters.search}')`);
  if (filters.status) conditions.push(`StatusId eq ${filters.status}`);
  if (filters.authority) conditions.push(`contains(ContractingAuthorityName,'${filters.authority}')`);
  if (filters.dateFrom) conditions.push(`PublicationDate ge ${filters.dateFrom}T00:00:00Z`);
  if (filters.dateTo) conditions.push(`PublicationDate le ${filters.dateTo}T23:59:59Z`);
  if (filters.minValue) conditions.push(`EstimatedValue ge ${filters.minValue}`);
  if (filters.maxValue) conditions.push(`EstimatedValue le ${filters.maxValue}`);
  if (filters.cpv) conditions.push(`startswith(CpvCode,'${filters.cpv}')`);
  return conditions.join(' and ');
};
```

UI za pretragu mora imati:
- Tekstualno polje za pretragu (po nazivu tendera)
- Filter: Status (Aktivan / Zatvoren / Poništen / Svi)
- Filter: Naziv ugovornog organa (autocomplete)
- Filter: Datum od / Datum do (date picker)
- Filter: Vrijednost od / do (number input)
- Filter: CPV kod (kategorija nabavke)
- Filter: Tip nabavke (robe, usluge, radovi)
- Sortiranje: Datum, Vrijednost, Naziv
- Paginacija (20/50/100 po stranici)

Kartica tendera u listi prikazuje:
- Naziv (Subject)
- Ugovorni organ
- Datum objave + rok za ponude (deadline countdown timer!)
- Procijenjena vrijednost u BAM
- CPV kod + kategorija
- Status badge (zeleno=aktivan, crveno=zatvoren)
- Dugme "Detalji" i "EJN Portal" (link na original)

### 3. STRANICA DETALJA TENDERA (`/tenders/:id`)

Trenutni problem: detalji se ne učitavaju.

```javascript
// Fetch detalja
const getTender = async (id) => {
  const res = await fetch(`https://open.ejn.gov.ba/Announcements(${id})?$format=json`);
  return res.json();
};

// Fetch povezanih dokumenata
const getTenderDocuments = async (id) => {
  const res = await fetch(`https://open.ejn.gov.ba/AnnouncementDocuments?$filter=AnnouncementId eq ${id}&$format=json`);
  return res.json();
};
```

Stranica detalja prikazuje:
- Sve detalje tendera (sva polja iz API-a)
- Lista dokumenata sa linkovima za preuzimanje
- Countdown timer do deadline-a
- Mapa lokacije ugovornog organa (ako postoji adresa)
- Dugme "Prati ovaj tender" (notifikacije)
- Dugme "Otvori na EJN Portalu"
- Sekcija: Slični tenderi (isti CPV kod)
- Sekcija: Prethodni tenderi istog ugovornog organa

### 4. ANALIZA TENDERA (`/analysis`) — NOVA STRANICA

Ovo je ključna nova funkcionalnost. Treba implementirati:

```javascript
// Analiza po ugovornim organima (top 10 po broju tendera)
fetch('https://open.ejn.gov.ba/Announcements?$apply=groupby((ContractingAuthorityName),aggregate($count as Count))&$orderby=Count desc&$top=10&$format=json')

// Analiza po CPV kodovima  
fetch('https://open.ejn.gov.ba/Announcements?$apply=groupby((CpvCode),aggregate(EstimatedValue with sum as TotalValue))&$format=json')

// Tenderi po entitetu/kantonu
fetch('https://open.ejn.gov.ba/Announcements?$apply=groupby((EntityName),aggregate($count as Count))&$format=json')
```

**Vizualizacije koje treba implementirati** (koristiti Chart.js ili Recharts):

a) **Pie/Donut Chart**: Raspodjela tendera po tipu (Robe / Usluge / Radovi)

b) **Bar Chart**: Top 10 ugovornih organa po broju tendera i ukupnoj vrijednosti

c) **Line Chart**: Trend objave tendera po danima/sedmicama/mjesecima (slider za period)

d) **Treemap ili Bar**: Top CPV kategorije po vrijednosti

e) **Gauge/KPI Cards**: 
   - Prosječna vrijednost tendera
   - % aktivnih vs zatvorenih
   - Prosjek dana do deadline-a

f) **Heatmap kalendar**: Intenzitet objava po danima u sedmici i satu

g) **Tabela**: Top 20 najvrjednijih tendera sa sortiranjem

**AI Analiza dugme**: Klikne se, šalje agregirane podatke Claude API-u i dobija se tekstualna analiza:
```javascript
const analyzeData = async (tenderData) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analiziraj ove podatke o javnim nabavkama u BiH i daj ključne uvide, trendove i preporuke: ${JSON.stringify(tenderData)}`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
};
```

### 5. PRAĆENJE TENDERA / WATCHLIST (`/watchlist`)

Trenutni problem: funkcija ne radi ili nije implementirana.

Koristiti **localStorage** za čuvanje:
```javascript
const WATCHLIST_KEY = 'asa_watchlist';

const addToWatchlist = (tender) => {
  const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  if (!list.find(t => t.Id === tender.Id)) {
    list.push({ ...tender, addedAt: new Date().toISOString() });
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  }
};

const getWatchlist = () => JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');

// Provjera da li su praćeni tenderi promjenili status
const checkWatchlistUpdates = async () => {
  const list = getWatchlist();
  const updates = [];
  for (const saved of list) {
    const current = await fetch(`https://open.ejn.gov.ba/Announcements(${saved.Id})?$format=json`).then(r => r.json());
    if (current.StatusId !== saved.StatusId) {
      updates.push({ tender: current, change: 'status_changed' });
    }
  }
  return updates;
};
```

Watchlist stranica prikazuje:
- Lista praćenih tendera
- Badge: "Promjena statusa" ako se nešto promijenilo
- Countdown timer za svaki tender koji je aktivan
- Dugme za uklanjanje iz watchliste
- Dugme "Provjeri ažuriranja"

### 6. UGOVORNI ORGANI (`/authorities`)

```javascript
// Lista ugovornih organa
fetch('https://open.ejn.gov.ba/ContractingAuthorities?$top=50&$orderby=Name&$format=json')

// Tenderi određenog ugovornog organa
fetch(`https://open.ejn.gov.ba/Announcements?$filter=ContractingAuthorityId eq ${id}&$top=20&$format=json`)
```

Stranica prikazuje:
- Pretraga ugovornih organa po nazivu
- Kartica sa brojem tendera, ukupnom vrijednošću, zadnjim tenderom
- Klik → profil ugovornog organa sa svim historijskim tenderima

### 7. IZVJEŠTAJI (`/reports`)

Generisanje Excel/CSV izvještaja:
```javascript
// Export u CSV
const exportToCSV = (data) => {
  const headers = ['ID', 'Naziv', 'Ugovorni Organ', 'Datum Objave', 'Rok', 'Vrijednost BAM', 'Status', 'CPV'];
  const rows = data.map(t => [
    t.Id, t.Subject, t.ContractingAuthorityName,
    t.PublicationDate, t.DeadlineDate, t.EstimatedValue,
    t.StatusName, t.CpvCode
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM za Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ejn_tenderi.csv'; a.click();
};
```

### 8. POSTAVKE (`/settings`)

Stranica postavki treba raditi:
- Odabir jezika (BS / EN)
- Tema (Svijetla / Tamna / Sistemska)
- Notifikacijske preference
- API ključ za Anthropic (za AI analizu)
- Filteri po defaultu (npr. samo aktivni tenderi, samo određeni entitet)
- Čuvanje u localStorage

---

## TEHNIČKA ARHITEKTURA

### Struktura projekta:
```
src/
  api/
    ejn.js          ← Sve API pozive prema open.ejn.gov.ba
    anthropic.js    ← Claude AI pozivi za analizu
  components/
    TenderCard.jsx
    TenderTable.jsx
    FilterPanel.jsx
    Charts/
      TrendChart.jsx
      DistributionChart.jsx
      TopAuthoritiesChart.jsx
    Layout/
      Sidebar.jsx
      Header.jsx
  pages/
    Dashboard.jsx
    TenderList.jsx
    TenderDetail.jsx
    Analysis.jsx
    Watchlist.jsx
    Authorities.jsx
    Reports.jsx
    Settings.jsx
  hooks/
    useTenders.js   ← React Query hook za fetchovanje
    useWatchlist.js
    useFilters.js
  utils/
    formatters.js   ← formatiranje datuma, valute
    odata.js        ← OData query builder
```

### Centralni EJN API modul (`src/api/ejn.js`):
```javascript
const BASE_URL = 'https://open.ejn.gov.ba';

const odata = async (endpoint, params = {}) => {
  const defaultParams = { '$format': 'json' };
  const merged = { ...defaultParams, ...params };
  const query = new URLSearchParams(merged).toString();
  
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}?${query}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`EJN API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('EJN API fetch failed:', err);
    throw err;
  }
};

export const ejnApi = {
  // Tenderi/Obavještenja
  getAnnouncements: (params) => odata('Announcements', params),
  getAnnouncementById: (id) => odata(`Announcements(${id})`),
  
  // Nabavke
  getProcurements: (params) => odata('Procurements', params),
  
  // Ugovorni organi
  getAuthorities: (params) => odata('ContractingAuthorities', params),
  
  // Dobavljači
  getSuppliers: (params) => odata('Suppliers', params),
  
  // Odluke
  getAwardDecisions: (params) => odata('AwardDecisions', params),
  
  // Statistika
  getStats: () => odata('Statistics'),
};
```

### Caching strategija:
```javascript
// Koristiti React Query (@tanstack/react-query) za cache
import { useQuery } from '@tanstack/react-query';

const useTenders = (filters) => {
  return useQuery({
    queryKey: ['tenders', filters],
    queryFn: () => ejnApi.getAnnouncements(buildODataParams(filters)),
    staleTime: 5 * 60 * 1000,  // 5 minuta cache
    retry: 2,
  });
};
```

---

## UI/UX ZAHTJEVI

### Dizajn tema:
- Primarna boja: `#1B3A6B` (tamno plava — državni/ozbiljan ton)
- Akcentna boja: `#E8A020` (zlatna — za oznake važnosti)
- Pozadina: `#F5F7FA` ili dark mode `#0F1923`
- Font: IBM Plex Sans (za tabele i podatke) + Sora (za headinge)

### Responsive:
- Sidebar se sklapa na mobilnom
- Tabele postaju kartice na mobilnom
- Filteri se sklanjaju u drawer na mobilnom

### Loading stanja:
- Skeleton loading za kartice (ne spinner)
- Error boundary s prikazom poruke ako EJN API ne odgovara
- Toast notifikacije za akcije

### Internacionalizacija:
- Svi labeli na bosanskom (latinica) kao default
- Opcija za engleski jezik

---

## VAŽNE NAPOMENE

1. **CORS**: EJN API (`open.ejn.gov.ba`) možda ima CORS ograničenja. Ako direktni browser pozivi ne rade, napraviti **proxy na backend strani** (Express.js ruta `/api/ejn/*` koja proxira pozive ka EJN):
```javascript
// server/routes/ejn.js
app.get('/api/ejn/*', async (req, res) => {
  const path = req.path.replace('/api/ejn/', '');
  const query = new URLSearchParams(req.query).toString();
  const response = await fetch(`https://open.ejn.gov.ba/${path}?${query}`);
  const data = await response.json();
  res.json(data);
});
```

2. **Rate limiting**: Ne slati previše API poziva odjednom. Koristiti debounce za pretragu (500ms).

3. **Fallback podatke**: Ako API nije dostupan, prikazati zadnje keširane podatke s napomenom "Podaci su keširani — EJN API nije dostupan".

4. **Linkovi na EJN portal**: Svaki tender treba imati direktan link na original:
   `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/{Id}`

5. **Datumi**: Koristiti `date-fns` biblioteku i bs-BA locale za formatiranje datuma na bosanski.

6. **Vrijednosti**: Formatirati kao `1.234.567,89 BAM` (europski format).

---

## CHECKLIST — ŠEST BITNIH STAVKI

- [ ] Dashboard učitava live podatke s EJN API-a
- [ ] Pretraga tendera radi s filterima (status, datum, vrijednost, naziv)
- [ ] Detalji tendera prikazuju sve informacije + dokumenti + link na EJN
- [ ] Analiza stranica s 5+ interaktivnih grafikona
- [ ] Watchlist čuva i prati tender statusove
- [ ] Export u CSV radi ispravno
- [ ] Postavke stranica funkcionalna (tema, filteri, jezik)
- [ ] Responsive dizajn
- [ ] Error handling za API greške
- [ ] Loading skeleton stanja

---

## POČETNI KORAK

Počni s ovim redoslijedom:

1. Napraviti `src/api/ejn.js` s centralnim API modulom
2. Testirati API pozive (počni s `Announcements?$top=5&$format=json`)
3. Ako CORS problem → implementirati backend proxy
4. Popraviti Dashboard da prikazuje live podatke
5. Popraviti listu tendera s funkcionalnom pretragom
6. Implementirati analizu
7. Ostale stranice

**Sve funkcionalnosti moraju biti žive (live data), ne mock/hardkodirani podaci.**
