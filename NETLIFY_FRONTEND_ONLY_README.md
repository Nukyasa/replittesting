# Netlify hostovanje (Frontend-only) – `artifacts/tender-app`

Ovaj projekt u frontend kodu koristi relativne API pozive poput `fetch("/api/auth/login", ...)`.
To znači da `/api/*` mora biti proxy/an odgovarajući backend endpoint na istoj domeni.

## 1) Priprema frontend-a

A) Iz `artifacts/tender-app` deploy-uj samo static build.

- **Build command:**
  - opcija 1 (preporuka): `pnpm build`
  - ako Netlify ne prepoznaje workspaces, koristi eksplicitno: `pnpm run build --config vite.config.ts`

- **Publish directory:**
  - `artifacts/tender-app/dist/public`

## 2) `/api/*` proxy (neophodno)
Frontend traži `/api/*` na istoj domeni kao i frontend.

Zato postoje dvije varijante:

### Varijanta A (preporuka): Backend van Netlify-a + proxy/rewrite na Netlify-u
1. Hostuj backend (`artifacts/api-server/`) negdje drugdje (Render/Fly/Railway/Heroku) na URL kao npr.:
   - `https://YOUR_BACKEND_HOST`

2. Na Netlify-u dodaj rewrite tako da:
   - `https://tvoja-domena.com/api/*` → `https://YOUR_BACKEND_HOST/api/*`

Netlify rewrite se podešava kroz `netlify.toml` (vidi sljedeći odjeljak), ili kroz UI (Redirects/Rewrites).

### Varijanta B: Backend također serverless (Netlify Functions)
Ovo zahtijeva značajnije prepakivanje Express servera u serverless funkcije.
Za ovakav projekat obično nije najbrže.

## 3) `netlify.toml` primjer (proxy /api)
Kreiraj `netlify.toml` u root-u repoa (pored `package.json`) i zamijeni `YOUR_BACKEND_HOST`.

```toml
[[redirects]]
from = "/api/*"
to = "https://YOUR_BACKEND_HOST/api/:splat"
status = 200
force = true
```

## 4) Env varijable
U tvom Vite `vite.config.ts` postoji `BASE_PATH` i `PORT` logika, ali frontend API pozive radi hardcodirano na `"/api/..."` (barem za login).
Zato env varijable za API nisu potrebne sve dok rewrite/proxy za `/api/*` radi.

## 5) Test nakon deploy-a
- Otvori Netlify site
- Klikni Login
- Treba da se poziv ide na `/api/auth/login`
- U Network tab-u browsera provjeri da request stvarno ide backend-u (preko rewrite-a)


