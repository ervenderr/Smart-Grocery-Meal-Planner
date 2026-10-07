# Project Research Summary

**Project:** Kitcha (Smart Grocery & Meal Planner), subsequent milestone
**Domain:** Pantry, meal planner, shopping list and budget app. Brownfield, becoming a mobile-first PWA on Railway with free-tier AI and food APIs.
**Researched:** 2026-10-08
**Confidence:** MEDIUM

## Decisions needed from the user before roadmapping

1. **Railway is paid, which conflicts with "free tiers only".** Trial is a one-time $5 credit for 30 days; Free plan gives $1/mo and 0.5 GB RAM (Postgres alone exhausts it). Realistic always-on setup is Hobby at $5/mo, about $7-15/mo total (upper range is a third-party estimate). Recommendation: accept Hobby, set a dashboard usage limit, amend PROJECT.md to "free tiers for AI and food APIs; Railway Hobby accepted". Decision gate at the start of the Deploy phase.
2. **Next.js is pinned to a vulnerable version.** `next` and `eslint-config-next` are pinned at exactly `16.0.2`, flagged for CVE-2025-66478 / CVE-2025-55182 (React2Shell, unauthenticated RCE, CISA KEV). Upgrade to 16.4.0 plus latest React 19.x (`react`/`react-dom` are exact-pinned at 19.2.0). Do this first, before PWA work.
3. **PROJECT.md says Tailwind 3.4, repo has Tailwind 4** (`tailwindcss ^4` + `@tailwindcss/postcss`). Treat 4 as truth and fix PROJECT.md.

## Executive summary

Kitcha is a working Next.js 16 / Express 4 / Prisma 5.22 / Postgres app. This milestone moves the backend from Render to Railway, makes the frontend an installable mobile-first PWA, and hardens the AI and food-data layer on free tiers. The biggest functional gap is the shopping list: it lives in `sessionStorage`, has no backend routes, ignores the pantry, and does no unit conversion.

Sequence by dependency: security fix + Railway deploy first; then mobile shell, AI layer and shopping backend in parallel (separate code trees); then ingredient normalization (five top features depend on it); then service worker/offline (hardest to debug, wait until layouts settle); then barcode and import. Defer household sharing.

## Key findings

### Recommended stack (see STACK.md)
- **Railway Hobby:** one Dockerfile service + Railway Postgres over private URL. No `railway.json`/`railway.toml` (deprecated, end 2026-12-01).
- **Next.js 16.4.0** security upgrade.
- **PWA:** native `app/manifest.ts` + `@serwist/turbopack` 9.5.13, `serwist` 9.5.13, `esbuild ^0.28.2`. Not `next-pwa`. Fallback: `@serwist/next` with `next build --webpack`.
- **Primary LLM:** `@google/genai` 2.28.0 (replaces unsupported `@google/generative-ai`). Default `gemini-3.5-flash-lite` via env var, native `responseSchema`, no `-latest` aliases.
- **Fallback LLM:** Groq `openai/gpt-oss-120b` over axios with strict `json_schema`; also covers EEA/UK/CH where Gemini free use is barred.
- **Validation:** `zod ^4` backend, one schema for both providers and parser.
- **Food data:** Open Food Facts (barcodes; 15 req/min/IP, custom User-Agent, ODbL) and USDA FoodData Central (nutrition, CC0). TheMealDB optional. Drop Spoonacular and Edamam.
- **Barcode:** `barcode-detector` 3.2.2 when scan enters scope.
- **Prisma:** stay on 5.22.

### Expected features (see FEATURES.md)
**Must have:** G1 persistent shopping list; G2 mobile shell + bottom nav; G3 PWA/offline; G4 shopping mode; G5 ingredient normalization + unit conversion; G6 pantry subtraction + staples; G7 expiry-ranked "cook this first" (deterministic, no LLM; the differentiator); G8 onboarding + empty states.
**Should have (v1.x):** G9 barcode scan; G10 URL recipe import; G11 "bought it"/"cooked it" loops; G12-G14 pantry quick-edit, estimate-vs-actual spend, configurable currency.
**Defer:** G17 household sharing (re-keys schema), receipt OCR, delivery integrations, native apps, calorie diary, social, real-time sync, paywalls/ads.

### Architecture approach (see ARCHITECTURE.md)
Vercel frontend with Bearer JWT in localStorage (no cookie/SameSite work) talks to a single-replica Express service on Railway (single replica because Zapier cron runs in-process). AI becomes a thin controller over `AiOrchestrator`: input hash, cache, DB-backed quota, provider chain, Zod validation, one repair retry, cache write only after validation. Providers are dumb adapters. Additive persistence: `AiUsage`, `AiCache`, optional `FoodDataCache`. Frontend: AppShell with bottom nav below `lg`, sidebar at `lg`+; service worker for shell; per-user React Query persistence to IndexedDB for offline data.

### Critical pitfalls (see PITFALLS.md)
1. Healthcheck vs HTTPS redirect, missing `trust proxy`: register `/health` first, DB-free; drop/exempt redirect; `trust proxy` = 1.
2. Service worker stale/cross-user data and ChunkLoadError after deploys: cache shell only, never `Authorization`/`/auth`/`/ai`; clear caches on logout; update prompt + kill-switch SW.
3. AI provider churn: provider/model in config, DB-backed global daily cap, 429 failover, Zod validation, delete dead `src/services/ai.service.ts`.
4. Deploy config traps: `NEXT_PUBLIC_API_URL` inlined at build with localhost fallback; exact-match CORS (`*`, trailing slash fail); don't set `PORT` by hand; private `DATABASE_URL`; migrate without `npx` then `exec node`; guard seed in production; keep third-party keys server-side.
5. iOS/viewport/units: no `beforeinstallprompt` on iOS (manual hint); `h-screen` in 7 places; no float quantities; no flat volume-to-weight factors; count units (pcs, cloves) not convertible.

## Implications for roadmap

Seven phases; 2, 3, 4 can run in parallel.

1. **Security upgrade + Railway foundation:** Next 16.4.0, cost decision, live Railway API + Postgres, `trust proxy`, `/health` before redirect, CORS allowlist, Zod env schema, `exec` entrypoint, delete `render.yaml` (both copies), seed guard, build-time check for `NEXT_PUBLIC_API_URL`, CI, `pg_dump` procedure.
2. **AI layer hardening (backend):** delete dead service, `LlmProvider` + Gemini adapter on `@google/genai`, Zod schemas, `AiCache`/`AiUsage`, QuotaGuard + global cap, Groq fallback, prompt-injection delimiting + allergen post-filter, OFF/USDA adapters with attribution. Order: behaviour-preserving refactor, then cache/quota, then second provider.
3. **Mobile shell (G2, G8, G14):** `manifest.ts`, icons, viewport export, AppShell + bottom nav + More sheet, `h-dvh`, safe areas, 44px targets, bottom sheets, 375px audit, onboarding/empty states, configurable currency.
4. **Shopping list foundation (G1, G4, G13):** `shopping` backend module, UI wired to it, manual add, persisted check-off, category grouping, shopping mode, estimate vs actual.
5. **Normalization + pantry-aware intelligence (G5, G6, G7):** unit registry, canonical names, base-unit/Decimal quantities, merge fix, pantry subtraction, staples, expiry-ranked recipes.
6. **Service worker, offline, install (G3):** Serwist SW, offline page, per-user IndexedDB persistence cleared on logout, offline banner, install prompt, SW update prompt, real-device tests.
7. **Capture loops + import (G9-G12, G15):** barcode scan, bought/cooked loops, URL import, pantry quick-edit, export verification.

### Conflicts between research files, resolved
- `railway.toml`: ARCHITECTURE recommends, STACK verified deprecated. Follow STACK; add none.
- Migrations: keep in entrypoint with local prisma binary and `exec node`.
- Serwist vs hand-written SW: Serwist, behind a spike.
- Offline API data: SW caches shell only; offline data via per-user IndexedDB persistence (ARCHITECTURE/PITFALLS over STACK's NetworkFirst suggestion).
- OFF limits: use 15 req/min reads, 10 search (STACK/FEATURES verified) not ~100 (PITFALLS).

### Research flags
- **Phase 6:** spike `@serwist/turbopack` with `next build` and installed-PWA offline on real iPhone + Android.
- **Phase 2:** read real Gemini free quota in AI Studio; test `responseSchema` nested enums; confirm Groq limits; TheMealDB terms if used.
- **Phase 1:** verify `${{Postgres.DATABASE_URL}}` syntax, domain target port vs injected `PORT`, healthcheck behaviour, cost after one week.
- **Phase 5:** `parse-ingredient` + `convert-units` vs custom registry; Decimal vs base units.
- **Phase 7:** `barcode-detector` on real iPhones; `recipe-scrapers-js` (young 1.0.0).
- Phases 3 and 4 can skip research.

## Confidence assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Verified against official docs/npm on 2026-10-08; weak: unpublished Gemini quotas, third-party Railway cost, untested `@serwist/turbopack` here |
| Features | MEDIUM | Repo audit HIGH; Reddit/app-store reviews unavailable, evidence from HN, vendor forums, aggregators |
| Architecture | MEDIUM-HIGH | Code findings read directly; platform behaviour from training knowledge, STACK wins on conflict |
| Pitfalls | MEDIUM | `[CODE]` items HIGH; vendor/iOS items marked VERIFY |

**Overall: MEDIUM.** Direction is clear; remaining uncertainty is cheap to verify early.

## Gaps to address
- Gemini quota: read in AI Studio; set global cap ~60% of lowest assumed RPD, start near 100/day.
- Railway cost: set usage limit, review after one week.
- Offline writes: default read-only offline with banner; queued writes not researched.
- Render data: unknown whether real data exists; if so restore with `_prisma_migrations` preserved, check Postgres major version.
- Prisma: `^5.7.1` in package.json; confirm lockfile resolves 5.22 and pin exactly.
- EEA/UK/CH users: route to Groq only, or ignore for personal app.
- Philippine product coverage in OFF/USDA likely thin; manual fallback must be first-class.
- PROJECT.md edits: Tailwind 4; Railway cost constraint; Spoonacular/Edamam dropped.

## Sources
- Primary (HIGH): repo code audit; docs.railway.com; nextjs.org PWA guide (v16.4.0); npm registry; ai.google.dev; console.groq.com; Open Food Facts and USDA FDC docs; Plan to Eat help center.
- Secondary (MEDIUM): Serwist Turbopack example; OpenRouter and Cloudflare docs; Hacker News via Algolia; Mealime forum; Zscaler/Bitsight advisories.
- Tertiary (LOW): third-party Gemini RPD figures, Mistral/Cerebras terms, Railway cost threads, competitor ratings, VERIFY-tagged items in ARCHITECTURE/PITFALLS.
