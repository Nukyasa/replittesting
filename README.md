# 🛡️ ASA Tender Intelligence (Tender Manager AI)

Inteligentna platforma za praćenje, analizu i donošenje odluka o javnim nabavkama u Bosni i Hercegovini (EJN), specijalizirana za **Osiguranje** (AO/Kasko, imovina, nezgoda, odgovornost, DZO) i **Tehnički pregled vozila**.

---

## 🚀 Ključne funkcionalnosti

1. **Katalog tendera (`/tenders`)**:
   - Pregled nabavki sa fokusom na osiguranje i tehnički pregled
   - Kopiranje broja obavještenja u 1 klik
   - Odbrojavanje rokova u boji (zeleno > 7 dana, narandžasto hitno, crveno isteklo)
   - Status e-Aukcije, procijenjene vrijednosti i raniji pobjednici
   - Direktno dugme `Dosje >` za rad na ponudi

2. **Historija tendera & Dodijeljeni ugovori (`/history`)**:
   - Arhiva prethodno dodijeljenih ugovora u BiH
   - Pobjedničke kompanije (Euroherc, Sarajevo Osiguranje, Croatia, Triglav, Wiener, Adriatic, ASA Central)
   - Analiza popusta na e-Aukcijama (-13% do -18%)
   - Izvoz podataka u CSV formatu

3. **Praćenje izmjena tenderske dokumentacije (`?tab=izmjene-td`)**:
   - Hronologija izmjena i dopuna TD
   - Vizuelni Diff teksta (stari vs. novi tekst)
   - Zvanična pitanja i odgovori naručioca sa EJN portala

4. **Baza rješenja URŽ BiH (`/resolutions`)**:
   - Preko 1.170 zvaničnih rješenja Ureda za razmatranje žalbi
   - Izdvojeni sporni uslovi u TD i članovi Zakona o javnim nabavkama (ZJN BiH)

5. **Pitaj Asu (AI Asistent)**:
   - 1-klik predefinisana pitanja o servisnoj mreži, referencama i žalbama
   - Citiranje tačnih članova i stranica tenderske dokumentacije

6. **Simulator e-Aukcije & Kalkulator**:
   - Izračun minimalnog zakonskog koraka (0.5% - 1.0%)
   - Granična cijena (walkaway price) i preporučene strategije

---

## 🛠️ Lokalno pokretanje

### Zahtjevi:
- Node.js 24.x
- pnpm (`npm install -g pnpm`)

### Instalacija i pokretanje:
```bash
# 1. Instalacija paketa
pnpm install

# 2. Pokretanje razvojnog okruženja (API i Frontend paralelno)
pnpm --filter api-server dev
pnpm --filter tender-app dev
```

Frontend je dostupan na: `http://localhost:5173`
Backend API je dostupan na: `http://localhost:5000`

---

## ☁️ Postavljanje na Render (onrender.com)

Aplikacija koristi jedan Node servis za API i React frontend. Postojeći `render.yaml` postavlja **besplatnu probnu verziju** s lokalnom PGlite bazom. Render briše tu bazu i uploadovane dokumente pri restartu, uspavljivanju i novom deployu. Ova konfiguracija nije namijenjena trajnom čuvanju poslovnih podataka.

### Opcija 1: Render Blueprint (`render.yaml`) — Preporučeno
1. Povežite svoj GitHub repozitorij na [render.com](https://render.com).
2. Odaberite **New +** -> **Blueprint**.
3. Odaberite repozitorij; Render će automatski pročitati `render.yaml` i konfigurisati Web Service.

### Opcija 2: Ručno kreiranje Web Service-a na Renderu:
- **Environment**: `Node`
- **Build Command**: `pnpm install --frozen-lockfile --prod=false && pnpm --filter @workspace/tender-app build && pnpm --filter @workspace/api-server build && pnpm --filter @workspace/api-server exec puppeteer browsers install chrome && node scripts/init-render-db.mjs`
- **Start Command**: memorijski ograničena Node/PGlite naredba iz `render.yaml`
- **Health Check Path**: `/api/healthz`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000`
  - `JWT_SECRET`: `(unesite nasumični sigurni string ili kliknite generate)`
  - `ADMIN_EMAIL`: `admin@asacentral.ba`
  - `ADMIN_PASSWORD`: nasumična lozinka od najmanje 16 znakova; Blueprint je automatski generiše. Vrijednost je dostupna vlasniku servisa u Render → Environment.
  - `PUPPETEER_CACHE_DIR`: `/opt/render/project/src/.cache/puppeteer`
  - `GROQ_API_KEY` i `ANTHROPIC_API_KEY`: postaviti u Render Environment za AI funkcije.
  - `EJN_USERNAME` i `EJN_PASSWORD`: postaviti u Render Environment za dokumente koji zahtijevaju EJN prijavu.

Produkcija kreira samo administratorski račun, bez demo korisnika i izmišljenih tendera. Postojeće korisnike ne mijenja. Lokalna baza ovog računara i `.env` se ne objavljuju. Za lokalne izolovane provjere može se koristiti `PGLITE_DATA_DIR`.

Ograničenja besplatnog servisa: https://render.com/docs/free

---

## 🔒 Lokalne demo pristupne vjerodajnice

- **Email**: `admin@asacentral.ba`
- **Lozinka**: `Admin1234!`
