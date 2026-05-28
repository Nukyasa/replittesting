# ASA Tender Intelligence

AI-powered tender management platform for ASA CENTRAL osiguranje d.d. Sarajevo — tracks, scores, and analyzes public tenders across BiH with Anthropic AI (mock fallback when no API key).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/tender-app run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `JWT_SECRET` (set), `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui + Recharts + Zustand + Sonner
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Auth: JWT (bcryptjs + jsonwebtoken) — token in localStorage key `asa_auth_storage`
- AI: @anthropic-ai/sdk (mock fallback when ANTHROPIC_API_KEY not set)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/tenders.ts` — DB schema (7 tables: tenders, ai_analysis, documents, users, user_tenders, notes, notifications, scraper_logs)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — Orval-generated hooks and Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/services/aiAnalyzer.ts` — Anthropic AI + mock fallback
- `artifacts/api-server/src/seed.ts` — DB seed (25 tenders, 3 users, AI analyses)
- `artifacts/tender-app/src/pages/` — React pages (login, dashboard, tenders, tender-detail, analytics, kanban, settings, admin)
- `artifacts/tender-app/src/lib/auth-init.ts` — wires Zustand token → custom-fetch Bearer header

## Architecture decisions

- JWT auth: token stored in Zustand persist store (localStorage key `asa_auth_storage`), injected via `setAuthTokenGetter` callback in custom-fetch
- Mock AI: `aiAnalyzer.ts` checks for `ANTHROPIC_API_KEY`; returns deterministic mock analysis by category when absent — app fully functional without the key
- Scraper: mock scrapers simulate EJN, Reference.ba, and UN portals with random delay/counts; logs stored in DB; real scrapers can replace the mock
- Data format: BiH-specific — KM currency via `bs-BA` locale, DD.MM.YYYY dates, entity codes FBiH/RS/BD/International

## Product

- Dashboard with stat cards, AI daily digest, scraper status, Recharts category chart, recent high-score tenders
- Tender list with left filter sidebar (search, source, entity, category, AI score slider, value range, status), table and card views, pagination
- Tender detail: 5-tab view (Overview, AI Analysis, AI Chat, Documents, Notes) + sticky status sidebar
- Analytics: category bar chart, entity pie chart, 30-day timeline, score distribution, expiring tenders table
- Kanban board for tracking tender workflow (Pratim → U obradi → Prijavljeno → Pobjeda/Gubitak)
- Admin panel for user management
- Settings page with profile, company, notifications, scrapers, system tabs

## User preferences

- Navy #002d82 primary branding, Inter font
- Bosnian language UI throughout
- BiH number formatting: "280.000,00 KM", dates: DD.MM.YYYY.
- No emojis in UI
- Mock AI analysis fallback (user said "zaobidji api key" — skip Anthropic key requirement)

## Seed accounts

- admin@asacentral.ba / Admin1234! (admin)
- nabavka@asacentral.ba / Nabavka2026! (user)
- pravna@asacentral.ba / Pravna2026! (user)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec before touching frontend hooks
- Auth token getter must match the Zustand persist store name (`asa_auth_storage`) — see `auth-init.ts`
- DB seed is idempotent: skips if any user exists
- Scraper route `/api/scraper/stream` is SSE (Server-Sent Events) — don't add auth middleware to it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
