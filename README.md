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
- Node.js 18+ ili 20+
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

Aplikacija je u potpunosti pripremljena za Render kao jedan ujedinjeni servis (servira i API i React frontend).

### Opcija 1: Render Blueprint (`render.yaml`) — Preporučeno
1. Povežite svoj GitHub repozitorij na [render.com](https://render.com).
2. Odaberite **New +** -> **Blueprint**.
3. Odaberite repozitorij; Render će automatski pročitati `render.yaml` i konfigurisati Web Service.

### Opcija 2: Ručno kreiranje Web Service-a na Renderu:
- **Environment**: `Node`
- **Build Command**: `pnpm install --frozen-lockfile=false && pnpm run build && pnpm --filter api-server build`
- **Start Command**: `pnpm --filter api-server start`
- **Health Check Path**: `/api/health`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000`
  - `JWT_SECRET`: `(unesite nasumični sigurni string ili kliknite generate)`
  - `DATABASE_URL`: *(Opcionalno — ako ne unesete vanjski Postgres, sistem automatski koristi ugrađeni PGlite)*

---

## 🔒 Zadane pristupne vjerodajnice

- **Email**: `admin@asacentral.ba`
- **Lozinka**: `Admin1234!`
