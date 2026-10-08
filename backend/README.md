# Kitcha - Backend API

Express 4 + TypeScript + Prisma 5.22 + PostgreSQL. Serves the Kitcha PWA under `/api/v1`. See the [root README](../README.md) for the product overview, deployment overview and the full environment variable table.

## Setup

Requirements: Node.js 22, npm, PostgreSQL 15+.

```bash
docker compose up -d postgres     # optional local Postgres (smart_user / smart_password on :5432)
npm install
cp .env.example .env              # set DATABASE_URL and JWT_SECRET (openssl rand -hex 32)
npx prisma migrate deploy         # apply migrations (`npm run prisma:migrate` when editing the schema)
npm run prisma:seed               # optional demo data: demo@example.com / Demo1234!
npm run dev                       # http://localhost:3001
```

`JWT_SECRET` needs 32+ characters and must not contain words like `secret`, `default` or `change-this`. The seed refuses to run in production or against a non-local `DATABASE_URL` (`ALLOW_SEED=true` overrides the host check). Leave `AI_API_KEY` empty to run without AI; `/health` stays green.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | nodemon + ts-node |
| `npm run build` / `npm start` | Generate Prisma client, compile with tsc, run `dist/index.js` |
| `npm test` / `npm run test:watch` | Jest with coverage / watch mode |
| `npm run lint` / `npm run type-check` / `npm run format` | ESLint / tsc --noEmit / Prettier |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:deploy` | Client generation / dev migration / apply migrations |
| `npm run prisma:seed` / `prisma:studio` | Seed demo data / database GUI |

## Environment

Validated at startup by `src/config/env.schema.ts` (the process exits with a readable error if invalid). The full table lives in the [root README](../README.md#environment-variables); `.env.example` is the template. Key groups:

- Core: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, `NODE_ENV`, `PORT` (injected by Railway in production).
- AI (OpenAI-compatible, default Dahl Inference): `AI_API_KEY`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`, `AI_JSON_MODE`, `AI_USER_DAILY_LIMIT` (20), `AI_GLOBAL_DAILY_LIMIT` (100).
- Food data: `USDA_API_KEY` (optional), `OFF_CONTACT`.
- Integrations: `ZAPIER_WEBHOOK_URL`, `SPOONACULAR_API_KEY` (both optional).

## Structure

```
backend/
├── src/
│   ├── index.ts, app.ts     Bootstrap, middleware order, route mounting
│   ├── config/              env schema, CORS, database, logger
│   ├── constants/           currencies allow-list
│   ├── middleware/          auth, error handler, rate limiters, HTTPS redirect
│   ├── modules/             one folder per feature: routes, controller, service, validation
│   │   ├── auth, users      signup/login/logout/me, profile, preferences, onboarding
│   │   ├── pantry, recipe, mealplan, shopping, analytics, alert, notification, marketprice
│   │   ├── ai               provider client, prompts, dietary rules, quota, cache
│   │   ├── food             Open Food Facts barcode + USDA nutrition
│   │   └── zapier           webhooks and scheduler
│   ├── types/, utils/
├── prisma/                  schema.prisma, migrations/, seed.ts
├── tests/                   Jest + Supertest
├── Dockerfile, entrypoint.sh, docker-compose.yml
```

## API

Base `http://localhost:3001/api/v1`; everything except `/auth/signup` and `/auth/login` needs `Authorization: Bearer <jwt>`.

| Prefix | Notes |
| --- | --- |
| `/auth` | `/signup`, `/login`, `/logout`, `/me` |
| `/users` | profile, `/preferences` (currency, budget, diet), `/onboarding/complete`, `/password`, `/account` |
| `/pantry` | CRUD, `/stats`, `/expiring-soon` |
| `/recipes`, `/mealplans` | CRUD plus stats; `/mealplans/from-ai` |
| `/shopping` | `/list`, `/items`, `/generate`, `/finish`, `/history` |
| `/analytics`, `/alerts`, `/notifications`, `/prices` | budget and spending insights, in-app alerts |
| `/ai` | `/status`, `/suggest-recipes`, `/suggest-substitutions`, `/generate-meal-plan` |
| `/food` | `/barcode/:code`, `/nutrition` |
| `/zapier` | `/events`, `/webhooks`, `/test/:eventType` |

`GET /health` (outside `/api`) is database-free and used by Railway.

## Zapier events

`meal_plan_created`, `item_expiring`, `item_expired`, `stock_low`, `budget_warning`, `budget_exceeded`, `shopping_list_created`, `weekly_summary`. Register a webhook via `POST /zapier/webhooks`, or set `ZAPIER_WEBHOOK_URL`, then verify with `POST /zapier/test/meal_plan_created`.

## Testing

```bash
npm test                    # Jest + coverage
npm test -- --ci            # as in CI
```

CI runs lint, type-check and tests against a Postgres 16 service, then builds the Docker image.

## Deployment (Railway)

- Project with two services: the API (this `Dockerfile`, Node 22 alpine, non-root) and Postgres.
- Manual deploys from this directory: `railway up --service kitcha-api --detach`.
- `entrypoint.sh` runs `prisma migrate deploy` with retries, then starts node as PID 1, so migrations run on every deploy.
- Healthcheck path `/health`. Never set `PORT`; `DATABASE_URL` is `${{Postgres.DATABASE_URL}}`.
- Generate the secret without echoing it: `openssl rand -hex 32 | railway variable set JWT_SECRET --stdin`.
- Keep one replica (the Zapier cron runs in-process). Never seed production.
- Post-deploy check from the repo root: `API=https://<host> scripts/smoke-prod.sh`.
