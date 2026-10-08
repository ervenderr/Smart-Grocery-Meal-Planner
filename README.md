<div align="center">

# Kitcha - Smart Grocery and Meal Planner

**A mobile-first PWA that helps you see what is in your kitchen, decide what to cook, and shop without overspending.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38BDF8.svg)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/mobile-dashboard.png" width="220" alt="Dashboard with bottom navigation"><br><sub><b>Dashboard</b><br>Pantry, recipes, plans, budget</sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-pantry.png" width="220" alt="Pantry list with expiry warnings"><br><sub><b>Pantry</b><br>Expiry alerts and categories</sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-shopping.png" width="220" alt="Persistent shopping list grouped by category"><br><sub><b>Shopping list</b><br>Estimated vs actual spend</sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-shopping-mode.png" width="220" alt="Shopping mode with large tap targets"><br><sub><b>Shopping mode</b><br>Big targets, screen stays on</sub></td>
  </tr>
</table>

<details>
<summary><b>More screens</b></summary>
<br>
<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/mobile-mealplans.png" width="220" alt="Meal plans"><br><sub><b>Meal plans</b></sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-recipes.png" width="220" alt="Recipes"><br><sub><b>Recipes</b></sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-more.png" width="220" alt="More sheet"><br><sub><b>More sheet</b></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/screenshots/mobile-settings.png" width="220" alt="Settings with currency picker"><br><sub><b>Settings and currency</b></sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-onboarding.png" width="220" alt="Onboarding step 1"><br><sub><b>Onboarding</b></sub></td>
    <td align="center"><img src="./docs/screenshots/mobile-login.png" width="220" alt="Login"><br><sub><b>Login</b></sub></td>
  </tr>
</table>
</details>

<sub>Screenshots are 390x844 phone captures of the real app running against a local demo database with sample data. AI suggestions are disabled in the captures (no provider key configured).</sub>

</div>

---

## Contents

- [What it does](#what-it-does)
- [Mobile and PWA](#mobile-and-pwa)
- [AI suggestions](#ai-suggestions)
- [Food data](#food-data)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Contributing](#contributing)

## What it does

- **Pantry**: items with category, quantity, unit, location and expiry date. Items expiring soon are flagged on the dashboard and in the pantry.
- **Recipes**: personal recipe library with ingredients, instructions, difficulty, timing and dietary tags.
- **Meal plans**: weekly plans built from your recipes, with cost estimates.
- **Persistent shopping list**: one active list per user, grouped by category. Add items quickly, generate items from a meal plan, check items off with a price, and finish a trip to record it in history. The summary bar compares **estimated vs actual spend**. **Shopping mode** gives large tap targets and keeps the screen awake where the browser supports it.
- **Budget and analytics**: weekly budget, spending trends and savings insights.
- **Per-user currency**: each user picks a currency (default PHP; 16 supported, including USD, EUR, GBP, SGD, JPY). Changing it only changes how amounts are displayed, existing amounts are not converted.
- **Onboarding**: a three-step first-run flow (currency and weekly budget, dietary needs, pantry) that can be skipped.
- **Alerts and notifications**: expiring items and budget thresholds, shown in-app.
- **Zapier**: register webhooks and receive events such as `meal_plan_created`, `item_expiring`, `budget_exceeded`, `shopping_list_created` and `weekly_summary`. Configure with `ZAPIER_WEBHOOK_URL` or the `/zapier` API.

## Mobile and PWA

The UI is designed for phones first and scales up to a desktop sidebar layout.

- Bottom navigation (Home, Pantry, Meals, Shopping, More) with a **More** sheet for Recipes, AI features, Budget, Analytics, Alerts, Settings, Profile and Help.
- Installable: add to home screen on **Android** (browser install prompt) and **iOS** (Share, then Add to Home Screen; the app shows a short hint). It runs standalone with its own icon, from `app/manifest.ts`.
- **No offline mode yet.** The app needs a network connection; there is no service worker caching of data.

## AI suggestions

Recipe suggestions, ingredient substitutions and AI meal plans use **one OpenAI-compatible chat endpoint** chosen entirely by environment variables.

- Default provider: **Dahl Inference** (`https://inference.dahl.global/v1`), model `MiniMaxAI/MiniMax-M2.7`. Point `AI_BASE_URL` and `AI_MODEL` at any compatible provider to switch. There is no Gemini dependency.
- The key stays on the server (`AI_API_KEY`). With no key the API still starts, `/health` stays green, and the AI screens show that suggestions are unavailable.
- **Quotas** per UTC day: 20 requests per user and 100 globally (`AI_USER_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`), plus a short burst limiter.
- **Caching**: identical requests are served from a database cache and do not count against the provider.
- **Dietary rules are enforced in code.** A user's restrictions (vegan, gluten-free and so on) are checked against the returned recipes after the fact, and they are not sent to the provider.

## Food data

- **Open Food Facts** for barcode lookup. Type or paste the barcode number (camera scanning is not implemented). Set `OFF_CONTACT` so requests carry a proper User-Agent.
- **USDA FoodData Central** for nutrition. It needs a free `USDA_API_KEY`; without it, nutrition lookups are unavailable.
- Both sources are shown with attribution in the UI. Open Food Facts data is available under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/); USDA data is public domain.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16.4 (App Router), React 19.3, TypeScript, Tailwind CSS 4, TanStack Query 5, React Hook Form + Zod, Radix UI, Framer Motion, Recharts, Zustand, Axios |
| Backend | Node.js 22, Express 4, TypeScript, Prisma 5.22, PostgreSQL, JWT, bcryptjs, express-validator, Zod (env), Winston |
| AI | OpenAI-compatible provider via env (default Dahl Inference, MiniMaxAI/MiniMax-M2.7) |
| Tests | Jest + Supertest (backend), Vitest (frontend) |
| Hosting | Railway (API + Postgres), Vercel (frontend) |

## Repository layout

```
.
├── backend/    Express API, Prisma schema and migrations, Dockerfile (see backend/README.md)
├── frontend/   Next.js app (see frontend/README.md)
├── scripts/    smoke-prod.sh, a curl-based production smoke test
├── docs/       README screenshots
└── .github/    CI workflow
```

## Local development

Requirements: Node.js 22, npm, and PostgreSQL 15+ (Docker or a local install).

**1. Database.** Either start the Postgres service from the backend compose file:

```bash
cd backend
docker compose up -d postgres
# DATABASE_URL=postgresql://smart_user:smart_password@localhost:5432/smart_grocery_db?schema=public
```

or create an empty database in your own Postgres and use its URL.

**2. Backend** (http://localhost:3001):

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL and a JWT_SECRET (openssl rand -hex 32)
npx prisma migrate deploy      # apply migrations (use `npm run prisma:migrate` while changing the schema)
npm run prisma:seed            # optional: demo@example.com / Demo1234! plus sample recipes
npm run dev
```

The seed refuses to run when `NODE_ENV=production` or when `DATABASE_URL` does not look local. `JWT_SECRET` must be at least 32 characters and must not contain words like `secret` or `default`. Leave `AI_API_KEY` empty to run without AI.

**3. Frontend** (http://localhost:3000):

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
```

Open http://localhost:3000 and sign in with the demo user, or sign up. To preview the mobile layout, use your browser's device toolbar at 390x844 or open the dev server from a phone on the same network (add that origin to `CORS_ORIGIN`).

## Testing

```bash
cd backend  && npm test              # Jest with coverage
cd backend  && npm run type-check && npm run lint
cd frontend && npm test              # Vitest
cd frontend && npm run type-check && npm run lint
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and a build for both packages, plus a Docker build of the API, against a Postgres 16 service. After a deploy, `API=https://<your-api-host> scripts/smoke-prod.sh` runs a curl-based smoke test against the live API (needs `curl` and `jq`; it creates a throwaway `smoke+<epoch>@example.com` user).

## Deployment

### Backend on Railway

- One Railway project with two services: the API (built from `backend/Dockerfile`) and **Postgres**.
- Deploys are **manual**, there is no GitHub auto-deploy. From `backend/`: `railway up --service kitcha-api --detach`.
- The container entrypoint runs `prisma migrate deploy` (retrying while the database comes up) and then starts `node dist/index.js` as PID 1, so **migrations run on every deploy**.
- Healthcheck path: `/health` (does not touch the database).
- `PORT` is injected by Railway, never set it. `DATABASE_URL` is the reference variable `${{Postgres.DATABASE_URL}}`.
- Generate the JWT secret without echoing it: `openssl rand -hex 32 | railway variable set JWT_SECRET --stdin`.
- Keep a single replica: the Zapier scheduler runs in-process.
- Never run the seed against production.

### Frontend on Vercel

- Import the repo with **Root Directory** `frontend`.
- Set `NEXT_PUBLIC_API_URL` to the Railway API origin (no trailing slash) for **both Production and Preview**. It is inlined at build time, so redeploy after changing it.
- Add the Vercel production URL to the API's `CORS_ORIGIN` (and optionally `FRONTEND_URL`). Preview URLs of your project are allowed through `VERCEL_PREVIEW_SCOPE` and `VERCEL_PREVIEW_PROJECT`.

## Environment variables

### Backend

Validated at startup by `backend/src/config/env.schema.ts`; the process exits with a clear message if a required value is missing or weak. Template: `backend/.env.example`.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | `postgres://` or `postgresql://` URL. On Railway: `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | yes | | 32+ characters, must not look like a default value |
| `CORS_ORIGIN` | set in production | `http://localhost:3000` | Comma-separated bare origins, no trailing slash. In production they must be https and not localhost |
| `NODE_ENV` | no | `development` | `development`, `test` or `production` |
| `PORT` | required in production | `3001` in `.env.example` | Provided by the platform (Railway injects it), only set it yourself locally |
| `FRONTEND_URL` | no | | Extra frontend origin merged into the CORS allowlist |
| `VERCEL_PREVIEW_SCOPE`, `VERCEL_PREVIEW_PROJECT` | no | project `kitcha` | Allow this project's Vercel preview URLs |
| `JWT_EXPIRES_IN`, `API_VERSION`, `LOG_LEVEL` | no | `7d`, `v1`, `info` | |
| `AI_API_KEY` | no | | Server-side secret. Empty disables AI without breaking the API |
| `AI_PROVIDER` | no | `dahl` | Label for the provider |
| `AI_BASE_URL` | no | `https://inference.dahl.global/v1` | Any OpenAI-compatible base URL |
| `AI_MODEL` | no | `MiniMaxAI/MiniMax-M2.7` | |
| `AI_TIMEOUT_MS` | no | `40000` | Per-call timeout (1000 to 110000) |
| `AI_MAX_TOKENS` | no | `8000` | Reasoning models emit a think block first |
| `AI_JSON_MODE` | no | `off` | `off` or `json_object` |
| `AI_USER_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT` | no | `20`, `100` | Requests per UTC day |
| `USDA_API_KEY` | no | | Enables USDA nutrition lookups |
| `OFF_CONTACT` | no | this repository URL | URL or email in the Open Food Facts User-Agent |
| `ZAPIER_WEBHOOK_URL` | no | | Default Zapier catch-hook URL |
| `SPOONACULAR_API_KEY` | no | | Optional, legacy |
| `PUBLIC_HOST` | no | `RAILWAY_PUBLIC_DOMAIN` | Canonical host for the production HTTP to HTTPS redirect |

### Frontend

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes for production builds | Backend origin, inlined at build time. Public, never put secrets here |

## API overview

Base URL `/api/v1`. All routes except `auth/*` and `/health` need `Authorization: Bearer <jwt>`.

| Area | Prefix |
| --- | --- |
| Auth | `/auth` (`/signup`, `/login`, `/logout`, `/me`) |
| Users and preferences | `/users` (profile, preferences incl. currency, onboarding/complete, password) |
| Pantry | `/pantry` (CRUD, `/stats`, `/expiring-soon`) |
| Recipes | `/recipes` |
| Meal plans | `/mealplans` |
| Shopping list | `/shopping` (`/list`, `/items`, `/generate`, `/finish`, `/history`) |
| Analytics, alerts, notifications | `/analytics`, `/alerts`, `/notifications` |
| AI | `/ai` (`/status`, `/suggest-recipes`, `/suggest-substitutions`, `/generate-meal-plan`) |
| Food data | `/food` (`/barcode/:code`, `/nutrition`) |
| Zapier | `/zapier` |

Routes, validators and controllers live under `backend/src/modules/`. See [backend/README.md](./backend/README.md) for details.

## Contributing

1. Fork and create a branch (`git checkout -b feat/my-change`).
2. Keep commits conventional (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
3. Run type-check, lint and tests in the package you changed.
4. Open a pull request.
