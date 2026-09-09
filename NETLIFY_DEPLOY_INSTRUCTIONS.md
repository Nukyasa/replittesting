# Netlify deploy (Frontend) – `artifacts/tender-app`

## 0) Preduslov
Frontend koristi relativne API pozive, npr.:
- `fetch("/api/auth/login", ...)`

Znači na Netlify domeni mora postojati endpoint `/api/*` koji vodi na stvarni backend.
Najlakše: backend hostovati negdje drugdje (Render/Fly/Railway/Heroku) na javnom HTTPS URL-u.

## 1) Pripremi frontend build

default folder: `artifacts/tender-app`

U Netlify UI izaberi:
- **Build command:** `pnpm --filter ./artifacts/tender-app build`
  - ako Netlify ne prepoznaje workspaces, koristi alternativu: `cd artifacts/tender-app && pnpm build`
- **Publish directory:** `artifacts/tender-app/dist/public`

## 2) Konfiguruj `netlify.toml`
U root repo-a već postoji `netlify.toml`.

U tom fajlu zamijeni:
- `https://YOUR_BACKEND_HOST/api/:splat`
sa stvarnim backend hostom.

Primjer:
- ako je backend na `https://tender-api.onrender.com`, u `netlify.toml` stavi:
  - `https://tender-api.onrender.com/api/:splat`

## 3) SPA routing
`netlify.toml` već sadrži pravilo da se sve rute vraćaju na `index.html`.
To je potrebno zbog Wouter (client-side routing) modula.

## 4) Deploy
1. Netlify → New site from Git
2. Build settings (Build command + Publish directory) prema sekciji 1
3. Sačuvaj
4. Sačekaj build logove

## 5) Provjera
- Nakon deploy-a otvori site → Login
- U DevTools → Network provjeri da request ide na:
  - `https://tvoja-domena.com/api/auth/login`
- Onda response treba doći iz tvog backenda (preko rewrite-a)

## Napomena
Ako backend zahtijeva environment varijable (DB URL, JWT secret, itd.), njih rješavaš na backend hostingu.
Netlify samo proxy-ja `/api/*`.

