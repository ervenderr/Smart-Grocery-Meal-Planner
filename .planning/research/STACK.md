# Technology Stack (Subsequent Milestone: Railway + PWA + Free AI/Food APIs)

**Project:** Kitcha (Smart Grocery & Meal Planner)
**Researched:** 2026-10-08
**Scope:** Additions and changes only. The existing Next.js / Express 4 / Prisma 5.22 / Postgres system is not re-researched.
**Overall confidence:** MEDIUM. Railway, Next.js, Serwist and Groq are well sourced. Gemini free-tier numbers are not published by Google (see AI section), and several provider limits come from third-party summaries.

---

## Headline Decisions

| Question | Decision | Confidence |
|----------|----------|------------|
| Backend host | Railway **Hobby ($5/mo)**, one Dockerfile service plus Railway Postgres. The Free plan ($1/mo credit) cannot realistically hold an always-on API plus Postgres. | MEDIUM |
| PWA | Native `app/manifest.ts` plus **Serwist via `@serwist/turbopack`** for the offline shell. Do not use `next-pwa`. | MEDIUM-HIGH |
| Primary LLM | **Keep Gemini**, but migrate SDK and model. `@google/generative-ai` is unsupported since 2025-11-30, and `gemini-2.5-*` is restricted to accounts that already used it. | HIGH (migration), MEDIUM (quota) |
| Fallback LLM | **Groq `openai/gpt-oss-120b`**. It has published limits, strict schema-constrained JSON, and needs no SDK. | MEDIUM |
| Food data | **Open Food Facts** (barcode), **USDA FoodData Central** (nutrition), **TheMealDB** (optional recipe inspiration). **Drop Spoonacular and Edamam.** | MEDIUM |
| Security | **Upgrade Next.js now.** Pinned `16.0.2` is flagged vulnerable (React2Shell RCE, CISA KEV). | HIGH |

---

## 0. Urgent Fix: Next.js and React Upgrade

`frontend/package.json` pins `next` and `eslint-config-next` at `16.0.2`. npm marks that version deprecated: "This version has a security vulnerability" (CVE-2025-66478, a duplicate of CVE-2025-55182, React2Shell). It is an unauthenticated RCE in React Server Components and is on CISA's Known Exploited Vulnerabilities list. The first patch (16.0.7) was later found incomplete for some React versions, so take the latest.

| Package | Current | Target (npm latest, 2026-10-08) |
|---------|---------|----------------------------------|
| next | 16.0.2 (exact pin) | **16.4.0** |
| eslint-config-next | 16.0.2 | **16.4.0** |
| react / react-dom | 19.2.0 (exact pin) | latest 19.x (npm latest is 19.3.0; Next 16.4 peer range is `^19.0.0`) |

Do this first, before the PWA work, so the Serwist integration is built on the final Next version.

Doc discrepancy: PROJECT.md says "Tailwind 3.4", but `frontend/package.json` has `tailwindcss ^4` plus `@tailwindcss/postcss`. Treat Tailwind 4 as the truth for mobile-first work (CSS-first config, `@theme`).

Sources: npm deprecation message on `next@16.0.2`; Zscaler and Bitsight advisories; https://nextjs.org/docs/app/guides/progressive-web-apps (docs for v16.4.0, lastUpdated 2026-07-30).

---

## 1. Railway Deployment

### Platform facts (verified 2026-10-08)

| Fact | Detail | Source |
|------|--------|--------|
| Trial | One-time $5 credit, up to 30 days, 1 GB RAM, 5 services per project. Unverified accounts are "Limited Trial" with restricted outbound access and ports. | docs.railway.com/reference/pricing/free-trial |
| After trial | Falls to Free plan: $1 credit per month, no rollover, 0.5 GB RAM, 1 vCPU. | same |
| Hobby | $5/mo, which includes $5 of usage. Metered: about $10/GB-RAM/mo, $20/vCPU/mo, $0.15/GB-mo volume, $0.05/GB egress. | docs.railway.com/reference/pricing/plans; third-party estimate |
| Realistic cost | Small Express API plus Postgres is about $7-15/mo. This is a third-party estimate (LOW-MEDIUM). Set a **usage limit** in the dashboard. | station.railway.com threads |
| Healthcheck | Service-level path. Default timeout 300s (`RAILWAY_HEALTHCHECK_TIMEOUT_SEC`). Probes come from host `healthcheck.railway.app`. | docs.railway.com/guides/healthchecks |
| Config as Code | `railway.json` / `railway.toml` is **deprecated**. It is read for legacy services only until **2026-12-01**, and new projects cannot opt in. The replacement is Infrastructure as Code in `.railway/railway.ts`. | docs.railway.com/reference/config-as-code, changelog 2026-08-20 |

### Prescriptive setup

- Deploy with the existing `backend/Dockerfile`. Railway auto-detects a file named exactly `Dockerfile` in the uploaded directory.
- **Do not add `railway.json`.** It is deprecated and dies 2026-12-01. Set everything by CLI or dashboard instead: healthcheck path `/health`, and `RAILWAY_DOCKERFILE_PATH` only if the file is not at the upload root.
- Run `railway up` from inside `backend/` (the upload root is then the backend dir, so no monorepo root-directory setting is needed). Alternatively pass `railway up backend`.
- Keep migrations in `entrypoint.sh` (`prisma migrate deploy`). That is fine for a single replica. Do not use `preDeployCommand` from `render.yaml`, because it lived in the deprecated config file.
- Railway CLI is 5.45.10 locally. Verified commands: `railway init`, `railway add --database postgres`, `railway add --service kitcha-api`, `railway variable set K=V --service ...`, `railway up --detach`, `railway domain`, `railway logs`.
- `DATABASE_URL`: reference the Postgres service from the API service, i.e. `DATABASE_URL=${{Postgres.DATABASE_URL}}`. This is Railway's variable-reference syntax. It is not shown on the Postgres page I fetched, so confirm in the variables docs (MEDIUM). Use the **private** URL. `DATABASE_PUBLIC_URL` exists only after enabling the TCP proxy and bills egress.
- Generate the public URL with `railway domain`, then set `CORS_ORIGIN` / `FRONTEND_URL` to the frontend host (not `*`; `render.yaml` used `*`).

### Code changes needed (small)

| File | Change | Why |
|------|--------|-----|
| `backend/Dockerfile` | Remove `ENV PORT=10000` (or keep and ensure Railway domain targets 10000). | `env.config.ts` hard-requires `PORT`, and Railway injects its own `PORT`. A mismatch between the Dockerfile default and the domain target port causes 502/healthcheck failures. Verify the domain's target port after the first deploy. |
| `backend/entrypoint.sh` | Use `exec node dist/index.js` instead of `npm start`. Call `node_modules/.bin/prisma migrate deploy` instead of `npx prisma`. | SIGTERM reaches Node (clean restarts). Avoids `npx` cache writes as the non-root `nodejs` user (adduser --system has no writable home). |
| `backend/src/index` / app | Confirm `GET /health` returns 200 without auth and does not depend on CORS or host allow-lists. | Railway healthcheck gate. |
| `backend/src/config/env.config.ts` | Comment "Render" -> "Railway". Add `AI_*` and `USDA_API_KEY` env entries. | Hygiene. |
| `backend/render.yaml` | Delete. | Replaced by Railway CLI setup. |
| Prisma | **Stay on 5.22.x.** | npm latest is Prisma 7 / 8-rc. A major upgrade is out of scope for this milestone. |

### Do NOT

- Do not use the Free plan for the API plus DB. $1/mo credit is exhausted by Postgres RAM alone (MEDIUM).
- Do not rely on Trial credits for production. Stateful volumes are deleted 30 days after expiry.
- Do not expose Postgres via TCP proxy "for convenience". Run migrations in the container.
- Do not build on `railway.json` or `railway.toml`.

---

## 2. Mobile-First PWA

### Recommended stack

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js native `app/manifest.ts` | built-in (16.4.0) | Web app manifest | Official Next.js PWA guide recommends it. Typed, no plugin. |
| `@serwist/turbopack` | 9.5.13 | Service worker build and registration | Next 16 builds with Turbopack by default. Serwist has a maintained Turbopack integration and the Next docs link to its Turbopack example. |
| `serwist` | 9.5.13 (match `@serwist/turbopack` exactly) | SW runtime (precache, runtime caching, offline fallback) | Maintained successor to Workbox-style libs. The `preview` tag (10.0.0-preview.14) exists, so do not use it. |
| `esbuild` | ^0.28.2 | Peer dependency of `@serwist/turbopack` | Peer range `>=0.25 <1`. The route handler compiles `app/sw.ts` with it. |
| `barcode-detector` | 3.2.2 | Barcode scan polyfill (ZXing WASM) for the gap-analysis item | Standards-based `BarcodeDetector` API. iOS Safari lacks the native API, so the polyfill is needed. MEDIUM, verify on a real iPhone. |

### Wiring (per the Serwist Turbopack example, verified on GitHub main)

- `next.config.ts`: wrap with `withSerwist` from `@serwist/turbopack`.
- `app/serwist/[path]/route.ts`: `createSerwistRoute({ swSrc: "app/sw.ts", additionalPrecacheEntries: [{ url: "/~offline", revision }], useNativeEsbuild: true })`.
- `app/sw.ts`: `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting, clientsClaim, navigationPreload, runtimeCaching: defaultCache, fallbacks: { entries: [{ url: "/~offline", matcher: ({request}) => request.destination === "document" }] } })`.
- `app/layout.tsx`: wrap children in `<SerwistProvider swUrl="/serwist/sw.js">`. Add `appleWebApp`, `viewport.themeColor`, and apple-touch-icon.
- Add an `app/~offline/page.tsx` static shell.
- Add `public/icons` (192, 512, maskable 512, apple-touch 180).
- Headers: serve the SW with `Cache-Control: no-cache` (Next guide shows this for `/sw.js`). Adjust to `/serwist/sw.js`.
- Scripts: `next dev --turbopack` / `next build --turbopack` (already the default in Next 16).
- Install prompt: the Next guide advises against relying on `beforeinstallprompt` (no iOS Safari support). Show a manual "Share -> Add to Home Screen" hint on iOS and an optional button on Chromium.

### Offline scope (opinionated)

Precache the app shell and `/~offline`. Use `NetworkFirst` for GET `/api` reads of pantry and shopping list, so they show last-known data when offline. Do **not** queue offline mutations in this milestone (that needs a conflict strategy). Auth is JWT, so never cache `Authorization`-bearing responses in a shared cache bucket. Scope runtime caching by route and exclude `/auth`.

### Alternatives rejected

| Option | Verdict | Reason |
|--------|---------|--------|
| `next-pwa` 5.6.0 | No | Last published 2022-08, webpack-only. |
| `@ducanh2912/next-pwa` 10.2.9 | No | Last published 2024-09, webpack plugin. It is the predecessor of Serwist (same author). |
| `@serwist/next` 9.5.13 | Fallback only | Webpack-based. Use only if Turbopack integration breaks, with `next build --webpack`. |
| Hand-written `public/sw.js` | No | Fine for push-only. Hand-rolling precache manifests is error-prone. |
| Next `experimental.useOffline` | Not yet | Experimental connectivity hook (documented in v16.4). May complement Serwist later. Not a service-worker cache. |
| Native app (Expo) | Out of scope | PROJECT.md decision. |

Mobile UI additions need no new libraries. Tailwind 4, Radix, framer-motion and lucide are already present. Use `100dvh`, `env(safe-area-inset-*)`, 44px touch targets, and a fixed bottom nav component.

Confidence: HIGH for manifest; MEDIUM for `@serwist/turbopack`. The example uses `serwist: preview` while npm `latest` is 9.5.13, so pin both to 9.5.13 and smoke-test `next build` early. Flag for a spike.

Sources: https://nextjs.org/docs/app/guides/progressive-web-apps; https://serwist.pages.dev/docs/next/getting-started; github.com/serwist/serwist/tree/main/examples/next-turbo-basic; npm registry (checked 2026-10-08).

---

## 3. Free LLM Providers (JSON-structured recipe and meal-plan generation)

Usage is a few calls per day, so any option fits. The deciding factors are reliability of the limit, structured-output guarantees, terms, and migration cost.

### Comparison table

| Provider / model | Free limits (as checked 2026-10-08) | Structured JSON | Terms / caveats | Verdict |
|------------------|--------------------------------------|-----------------|------------------|---------|
| **Google Gemini API** (`gemini-3.5-flash-lite`, `gemini-3.8-flash`; all Gemini 3.x Flash/Flash-Lite are "free of charge" on the pricing page) | **Not published.** Docs say limits are per project, shown in AI Studio, and "not guaranteed". RPD resets midnight Pacific. Third-party reports: Flash-Lite ~1,000 RPD, Flash as low as ~20-250 RPD after a Dec 2025 cut (LOW). | Yes: `responseMimeType: "application/json"` plus schema (`config.responseSchema`) via `@google/genai`. | Free tier content **may be used to improve products, with human review**. "Do not submit sensitive/personal information." In **EEA/UK/Switzerland** the paid terms apply to all use, and clients there may be served only via Paid Services. 18+ only. | **Primary** (already integrated, lowest migration cost) |
| **Groq** (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) | 30 RPM, **1,000 RPD**, 8K TPM, **200K TPD** per org (Groq docs table; the page displays these as base limits, and the account limits page is authoritative). No card reported (LOW-MEDIUM). | **Best-in-class:** `json_schema` with `strict: true` (constrained decoding) on the three models above. `json_object` on the rest. Strict mode needs all props `required` and `additionalProperties: false`. No streaming with structured outputs. | OpenAI-compatible endpoint. Limits are org-wide. 8K TPM is the practical ceiling, so keep prompts and outputs under about 6K tokens and set a low reasoning effort. | **Fallback** (explicit numbers, schema guarantee) |
| **OpenRouter** `:free` models | 20 RPM; **50 RPD** with <$10 credits purchased, 1,000 RPD with >=$10 (official). The free list is volatile. On 2026-10-08, of 16 `:free` models only 4 advertise `structured_outputs` (apodex-1.1-mini, dots-3-note-preview, liquid lfm-2.5-2.6b, nemotron-3-super-120b-a12b). | Model-dependent | Free models are routed to third-party providers that may log or train. Model IDs churn. | No (churn, 50 RPD) |
| **Mistral La Plateforme (Experiment)** | Third-party: about 1B tokens/mo, but **about 2 RPM** (sources disagree). Needs phone verification. | JSON mode and schema supported (not re-verified) | Experiment plan requires **opting into training on your data**. Limits are not on a first-party page I could fetch. | No (training opt-in, unverified limits) |
| **Cloudflare Workers AI** | **10,000 Neurons/day** free, hard-stops when exceeded (official). | JSON mode via `response_format: json_schema`, but only on a short list (Llama 3.3 70B fp8 fast, Llama 3.1/3 8B, Hermes 2 Pro, DeepSeek R1 distill 32B). Docs say no schema guarantee ("JSON Mode couldn't be met" errors). No streaming. | Requires a Cloudflare account, a different API shape, and weaker JSON reliability. | No |
| **Cerebras** | Sources conflict. Newer ones (cites 2026-09-14 page) say a $5 trial credit, **payment method required**, expires in 30 days, not a permanent free tier. | OpenAI-compatible | Probably not "free forever" any more (LOW). | No |

### Verdict

1. **Keep Gemini as primary.** PROJECT.md says to keep it unless something clearly wins, and nothing wins outright on quality. Gemini is already wired, and the real work is a **mandatory migration**:
   - `@google/generative-ai@0.24.1` is archived and "all support ends 2025-11-30". Move to **`@google/genai@2.28.0`**.
   - The code uses `gemini-2.5-flash` (`src/services/ai.service.ts`) and `gemini-flash-latest` (`src/modules/ai/ai.service.ts`). The deprecations page says 2.5 models are now "limited to users who have used these models in the past" and recommends `gemini-3.5-flash-lite` or `gemini-3.8-flash` for new projects. **A fresh key may get 404 or `limit: 0`.**
   - Default model: `gemini-3.5-flash-lite` (cheapest, highest free allowance, stable). Make it an env var (`GEMINI_MODEL`). Switch to `gemini-3.8-flash` if recipe quality is poor. Do **not** use `-latest` aliases, because their target is undocumented.
   - Use native structured output (`responseMimeType: "application/json"` plus `responseSchema`) instead of the current regex `match(/\[[\s\S]*\]/)` parsing. Validate the result with Zod anyway, since the docs warn that valid JSON can still hold wrong values.
   - `generateContent` is labelled "legacy but fully supported, no deprecation date". The new Interactions API is recommended for new projects. For this milestone, `ai.models.generateContent` is the lower-risk choice. Revisit later.
2. **Add Groq `openai/gpt-oss-120b` as an automatic fallback**, behind a small `LlmProvider` interface (`generateJson(schema, prompt)`). Call it with the existing `axios`/`fetch` against `https://api.groq.com/openai/v1/chat/completions`, with no new SDK. Use it when Gemini returns 429/404/5xx, or for users in the EEA/UK/CH (where Gemini free use is barred by the terms). Strict schema mode makes the fallback more reliable at producing valid JSON than Gemini.
3. **Do not adopt** OpenRouter free, Mistral, Cloudflare, or Cerebras. Each adds either a training opt-in, volatile model lists, weak JSON guarantees, or a card.

### Quota guards and caching (the "tiny usage" architecture)

| Mechanism | Implementation | Why |
|-----------|----------------|-----|
| Response cache | Postgres table `AiCache(key sha256, kind, payload JSON, expiresAt)`. Key = hash of normalized (sorted, lowercased pantry items + diet + kind). TTL 24h for suggestions, 7d for substitutions. | Identical pantry state should not spend quota. Postgres is already there, so no Redis. |
| Per-user limit | Existing `express-rate-limit@8` (already installed) on AI routes, e.g. 10/day/user. | No new dependency. |
| Global daily budget | Counter row (`AiUsage(day, provider, count)`), hard cap about 60% of the lowest assumed RPD (e.g. 100/day). Return 429 with a friendly message and serve cache. | Protects against Gemini's unpublished limits. |
| 429 handling | On provider 429, mark provider "cooling" until next midnight Pacific (Gemini) or next minute (Groq), then fail over. | Gemini RPD resets midnight Pacific. |
| Input minimization | Send names, quantities and diet tags only. No emails, names, or addresses. | Free-tier data may be human-reviewed. |
| Output validation | `zod@^4` in backend (not currently a backend dep). Use `z.toJSONSchema()` to derive the provider schema, so there is one source of truth. | One schema feeds Gemini, Groq and the parser. |

Also dedupe code: `backend/src/services/ai.service.ts` and `backend/src/modules/ai/ai.service.ts` are near-identical copies (different Gemini model strings). Collapse into `modules/ai/` with one provider layer (also needed for the 800-line/small-file rule).

Confidence: HIGH on the SDK deprecation and 2.5 restriction (official pages). MEDIUM on Gemini free quota (unpublished). MEDIUM on Groq numbers (official docs table, with the free-vs-developer labelling ambiguous).

Sources: ai.google.dev/gemini-api/docs/{rate-limits, pricing, models, deprecations, migrate, interactions, structured-output}; ai.google.dev/gemini-api/terms; github.com/google-gemini/deprecated-generative-ai-js; console.groq.com/docs/{rate-limits, structured-outputs}; openrouter.ai/docs/api-reference/limits plus `GET /api/v1/models` (2026-10-08); developers.cloudflare.com/workers-ai/{platform/pricing, features/json-mode}; third-party: benchlm.ai, costbench.com, vorplabs.com (Cerebras, Mistral).

---

## 4. Free Food Data APIs

| API | Free access (verified) | Best use in Kitcha | Constraints | Verdict |
|-----|------------------------|--------------------|-------------|---------|
| **Open Food Facts** | No key. Reads: **15 req/min per IP** (product), **10 req/min** (search). Must send `User-Agent: Kitcha/1.0 (contact-email)`. IP bans for abuse. | Barcode -> product name, brand, category, nutrition, image. | ODbL data, CC BY-SA images (attribute and share-alike on derived DB). Do not use search-as-you-type. Cache every product in Postgres. | **ADOPT** (barcode scan) |
| **USDA FoodData Central** | Free `data.gov` key. **1,000 req/hour per IP**. Data is **CC0**. `/foods/search`, `/food/{fdcId}`. | Per-ingredient calories and macros for meal-plan nutrition. | US-centric ingredients (app uses PHP pricing, so local foods may be missing). `DEMO_KEY` is for exploring only. | **ADOPT** (nutrition) |
| **TheMealDB** | Test key `1`, "will always remain free". Search, lookup, random, single-ingredient `filter.php?i=`. Multi-ingredient filter, "latest", and random-10 are premium. | Seed inspiration recipes and photos. Fits a "what can I make with chicken" flow. | The key `1` is for dev/educational use, and publishing to an app store needs supporter status. Rate limits and image terms are not stated. For a public site, buy the small supporter key or treat this as optional (MEDIUM-LOW). | **OPTIONAL** (low priority) |
| **Spoonacular** | Free plan: **50 points/day**, 1 req/s, 2 concurrent, **backlink required**, may cache user-requested data for **1 hour only**, delete data if you stop. | n/a | A 1-hour cache limit conflicts with the DB-cache design. 50 points is about 5-25 calls. `SPOONACULAR_API_KEY` is already in env config. | **DROP** |
| **Edamam** | The Recipe API page I fetched shows **no free plan** (lowest is $9/mo, 10 calls/min). All plans require attribution, and "only human, end-user driven requests" are allowed. | n/a | Automated and cached usage prohibited, and suspension is immediate. | **DROP** |

Design note: Gemini/Groq handle "create a recipe from my pantry". Open Food Facts and USDA handle **grounded facts** (barcodes, nutrition). Do not ask the LLM to invent calories when USDA can return them. Fetch these server-side from Express (so the OFF per-IP limit applies to Railway's IP, not each user) and cache aggressively. The OFF docs say limits apply per user if requests come from the user's device, and that heavy use should use the bulk dump.

Confidence: HIGH for OFF and USDA (official docs), MEDIUM for TheMealDB (terms not on the page), MEDIUM for Spoonacular and Edamam (official pages, but the Edamam page is partially extracted).

Sources: openfoodfacts.github.io/openfoodfacts-server/api/; fdc.nal.usda.gov/api-guide; themealdb.com/api.php; spoonacular.com/food-api/pricing; developer.edamam.com/edamam-recipe-api.

---

## Recommended Additions Summary

### Backend

| Library | Version | Purpose |
|---------|---------|---------|
| `@google/genai` | 2.28.0 | Replaces `@google/generative-ai` (remove it) |
| `zod` | ^4.6 | AI output validation and JSON-schema generation. Same major as frontend (`^4.1.12`). |
| (none) Groq via `axios` | existing `axios ^1.6.2` | OpenAI-compatible HTTP call, no `groq-sdk` needed |

Keep as-is: Express 4.22.x, Prisma 5.22, helmet 7, express-rate-limit 8, winston. Optionally bump `@prisma/client` to `5.22.0` exactly. `package.json` has `^5.7.1` for both `prisma` and `@prisma/client`, so confirm the lockfile resolves to 5.22.

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| `next` / `eslint-config-next` | 16.4.0 | Security fix (section 0) |
| `@serwist/turbopack` | 9.5.13 | PWA service worker |
| `serwist` | 9.5.13 | SW runtime |
| `esbuild` (dev) | ^0.28.2 | Peer of `@serwist/turbopack` |
| `barcode-detector` | 3.2.2 | Barcode scanning (depends on the gap-analysis outcome) |

## Installation

```bash
# Frontend (run in frontend/)
npm install next@16.4.0 react@latest react-dom@latest
npm install -D eslint-config-next@16.4.0
npm install @serwist/turbopack@9.5.13 serwist@9.5.13
npm install -D esbuild@^0.28.2
npm install barcode-detector@^3.2.2   # only if barcode scan is accepted into scope

# Backend (run in backend/)
npm uninstall @google/generative-ai
npm install @google/genai@2.28.0 zod@^4

# Railway (run in backend/)
railway init
railway add --database postgres
railway add --service kitcha-api
railway variable set NODE_ENV=production JWT_SECRET="$(openssl rand -base64 48)" CORS_ORIGIN=https://<frontend-host> --service kitcha-api
railway variable set GEMINI_AI_API_KEY=... GROQ_API_KEY=... USDA_API_KEY=... --service kitcha-api   # use --stdin for secrets
railway up --detach
railway domain
```

## Open Questions and Flags for Phase Research

- **Gemini real free quota:** open AI Studio for the actual key and record RPM/RPD in docs before setting the global cap.
- **`@serwist/turbopack` stability:** spike `next build` plus an installed-PWA offline test on a real iPhone and Android phone before committing the UI work to it.
- **Railway cost:** after one week on Hobby, check the usage dashboard and set the hard cap. The $10-15 estimate is third-party.
- **Railway `PORT` and domain target port:** verify on the first deploy.
- **Railway IaC:** if you later want declarative config, use `.railway/railway.ts` (GA in TypeScript), not `railway.json`.
- **Gemini `responseJsonSchema` vs `responseSchema`:** the migration doc shows only `responseSchema`. Use that, and test whether nested enums (units list) are honored.
- **TheMealDB commercial terms:** read their Terms of Use before shipping publicly.
