# Architecture Patterns

**Domain:** Brownfield integration of Railway deploy, mobile PWA, and provider-agnostic AI layer into Kitcha (Next.js 16 + Express/Prisma)
**Researched:** 2026-10-08
**Overall confidence:** MEDIUM-HIGH. Codebase findings are HIGH (read directly). Railway and PWA platform behaviours are from training knowledge and flagged where they need verification in-phase.

## Findings From the Existing Code That Drive Everything Below

| Finding | Evidence | Consequence |
|---------|----------|-------------|
| Auth is Bearer JWT in `localStorage['auth-token']`, attached by an Axios interceptor. No cookies. | `frontend/lib/api/client.ts` | Cross-origin Vercel to Railway needs no cookie, SameSite or third-party-cookie work. Keep Bearer. CORS only needs `Authorization` allowed, and `credentials: true` is harmless. |
| `ProtectedRoute` is client-side and the `(app)` layout is `'use client'` with a sidebar and header. | `frontend/app/(app)/layout.tsx` | There is no server-side session, so Next middleware cannot gate routes. The offline shell can render without the network, and auth is decided on the client. |
| CORS is a manual allowlist read from `CORS_ORIGIN` (comma-split). Exact string match only. | `app.ts`, `env.config.ts` | `*` (as in `render.yaml`) does NOT work, because it only matches a literal `"*"` origin. Vercel preview URLs will be rejected. |
| Production HTTPS redirect checks `x-forwarded-proto !== 'https'` and 301s. | `app.ts` | Railway's healthcheck probe hits `/health` over plain HTTP without that header, so it would get a redirect and fail. This blocks first deploy. The app is also missing `app.set('trust proxy', 1)`. |
| No `trust proxy`. `apiLimiter` and `authLimiter` key by `req.ip`. | `app.ts`, `rateLimiter.ts` | Behind Railway's edge, every user shares the proxy IP, so one global bucket of 100 requests per 15 minutes and 5 logins per 15 minutes. `express-rate-limit` v7 also logs a validation error for a missing trust proxy. |
| `aiLimiter` is in-memory, 10 requests per hour per user, and runs after `authenticate`. | `ai.routes.ts`, `rateLimiter.ts` | It resets on every Railway redeploy or restart and is not a real daily quota. It is a burst guard only. The DB-backed quota replaces it as the source of truth. |
| Two AI services exist: `src/services/ai.service.ts` and `src/modules/ai/ai.service.ts`. The controller imports the module one. A grep found no importer of `services/ai.service`. | `ai.controller.ts` | `src/services/ai.service.ts` is almost certainly dead. Delete it. The module copy (about 500 lines, Gemini hard-wired, regex-and-`JSON.parse` parsing, no Zod, `any` everywhere) is the one to refactor. |
| The Dockerfile runs `entrypoint.sh`, which does `prisma migrate deploy` then `npm start`. It sets `PORT=10000` and includes `render.yaml`. | `Dockerfile`, `entrypoint.sh` | Migrations run at container start. This is fine at one replica. Railway injects `PORT`, so do not hard-code 10000. |
| `initializeScheduler()` (Zapier cron) runs in-process. | `index.ts` | A single replica is a hard requirement. Do not scale Railway replicas above 1, or the cron fires twice. |

## Recommended Architecture

```
 Phone (installed PWA / browser)
 +----------------------------------------------------------+
 |  Next.js 16 on Vercel (static shell + client components) |
 |   Service Worker  <-- precache: shell, icons, offline.html|
 |        |            runtime: GET /api/v1/* (SWR / NetFirst)|
 |   React Query (persisted to IndexedDB)  <-- offline reads |
 |   Axios client: Authorization: Bearer <localStorage JWT>  |
 +-------------------------|--------------------------------+
                           | HTTPS, cross-origin, CORS allowlist
                           v
 Railway edge proxy (terminates TLS, sets X-Forwarded-*)
                           |
 +-------------------------v--------------------------------+
 | Express (single replica)                                 |
 |  trust proxy -> /health (before HTTPS redirect)          |
 |  helmet -> cors(allowlist+pattern) -> rate limit -> json |
 |  /api/v1/ai  -> authenticate -> burst limiter            |
 |        |                                                 |
 |   AiController (HTTP only)                               |
 |        v                                                 |
 |   AiOrchestrator  (use-case: build input, cache, quota)  |
 |     |-- QuotaGuard      -> ai_usage table                |
 |     |-- ResponseCache   -> ai_cache table                |
 |     |-- PromptBuilder   (per feature, versioned)         |
 |     |-- LlmProvider (interface) <- adapters: gemini,     |
 |     |      groq/openrouter/mistral...  + fallback chain  |
 |     |-- OutputValidator (Zod schemas per feature)        |
 |     `-- FoodDataProvider (interface) <- adapters:        |
 |            themealdb, openfoodfacts, usda, spoonacular   |
 |        v                                                 |
 |   Prisma -> Railway Postgres (private network URL)       |
 +----------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Talks to | Must NOT |
|-----------|---------------|----------|----------|
| Railway service (backend) | Runs Docker image, injects `PORT` and `DATABASE_URL`, runs migrations, health check | Railway Postgres (private networking), outside providers | Run more than 1 replica (in-process cron) |
| Railway Postgres | System of record plus AI cache and quota tables | Backend only | Be exposed publicly. Use the internal `DATABASE_URL`. Use the public proxy URL only for one-off local admin. |
| `app.ts` platform layer | trust proxy, `/health`, CORS allowlist, HTTPS redirect exemption | All routes | Contain feature logic |
| Frontend app shell `(app)/layout` | Responsive chrome: bottom nav on mobile, sidebar at `lg:`, safe-area padding, install prompt, offline banner | `ProtectedRoute`, route pages | Own data fetching |
| Service worker | Precache shell and static assets, offline fallback page, runtime caching | Network, Cache Storage | Cache authenticated API responses by default, and never cache `/auth/*` or POST/PUT/DELETE |
| React Query persistence | Offline read cache for pantry, recipes, meal plans, shopping lists | IndexedDB, Axios client | Persist AI responses or tokens (see pitfalls) |
| `AiController` | Parse request, call orchestrator, shape response | `AiOrchestrator` | Import any provider SDK |
| `AiOrchestrator` | The only place that sequences quota check, cache lookup, prompt, provider call, Zod validation, cache write, usage increment | QuotaGuard, ResponseCache, `LlmProvider`, `FoodDataProvider`, `PantryService` | Know provider specifics |
| `LlmProvider` adapters | Translate one common `generateJson(request)` call to a vendor API, map vendor errors to a common `ProviderError` (rate-limited, unavailable, invalid) | Vendor HTTP API | Do prompt building or validation |
| Output validators (Zod) | Single source of truth for each AI output shape. Unit normalisation moves here (the existing `normalizeUnit` map becomes a Zod transform). | Orchestrator | Call the network |
| `FoodDataProvider` adapters | Enrich or ground results (nutrition, barcode, recipe lookup) with caching | Vendor HTTP API | Be required for AI to function |

### Interfaces (the load-bearing contracts)

```typescript
// backend/src/modules/ai/providers/llm-provider.ts
export interface LlmRequest {
  readonly system: string;
  readonly prompt: string;
  readonly jsonSchema?: unknown;   // forwarded as native structured output when the vendor supports it
  readonly maxOutputTokens: number;
  readonly temperature: number;
}
export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateJson(req: LlmRequest, signal: AbortSignal): Promise<{ text: string; model: string }>;
}
// ProviderError { kind: 'rate_limited' | 'unavailable' | 'bad_output'; retryable: boolean }

// backend/src/modules/ai/orchestrator.ts
async run<T>(feature: AiFeature, userId: string, input: unknown, schema: z.ZodType<T>): Promise<AiResult<T>>
// order: normalise input -> cacheKey -> cache hit? return (no quota charge)
//        -> quota.reserve(userId) -> providers (chain) -> parse+Zod -> (one repair retry) -> cache.put -> return
```

Provider selection is `AI_PROVIDER_CHAIN=gemini,groq` (env). The orchestrator tries each configured provider in order on `rate_limited` or `unavailable`, never on a valid response. Because the existing `AIService` is a module-level singleton that reads `config.apis.geminiAI` at construct time, the new design should construct providers in one `ai.container.ts` factory so tests can inject fakes.

### Data Flow

**Request path (AI):** PWA, then Axios (Bearer), then Railway edge, then Express (`trust proxy` so the client IP is real), then CORS, then `authenticate`, then burst limiter, then controller, then orchestrator.

1. Orchestrator builds a canonical input (sort and lowercase pantry names, round quantities, drop volatile fields), then `sha256(feature + promptVersion + canonicalInput + dietary flags)` is the cache key.
2. Cache lookup in Postgres (`AiCache`: key, feature, payload JSONB, provider, model, createdAt, expiresAt). A hit returns immediately and does not consume quota.
3. On a miss, `QuotaGuard` does an atomic upsert-increment on `AiUsage(userId, day)` where `day` is a UTC date. Reject with 429 and a `resetAt` if over the limit. Do the increment in a single SQL statement (`INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < limit RETURNING`) so concurrent requests cannot overshoot. Refund the count if every provider fails (the user did not get a result).
4. Provider chain, then JSON extraction, then Zod parse. On a Zod failure, retry once with a "fix this JSON" prompt on the same provider, then fail with 502. Never return `[]` silently as the current parser does, because that hides failures and would cache garbage.
5. Write to cache only after validation passes. TTLs are about 24h for recipe suggestions (pantry-dependent) and 7d for substitutions.
6. The response carries `{ data, meta: { cached, provider, quota: { used, limit, resetAt } } }` so the UI can show "3 of 5 left today".

**Offline path (PWA):** On navigation, the SW serves the precached shell. React Query hydrates from IndexedDB and renders last-known pantry, recipes, plans and lists immediately, then revalidates. Mutations while offline are out of scope for MVP. Show a banner and disable write buttons. Queued writes are a later enhancement.

**Auth path:** Login returns a JWT, which is stored in localStorage and sent as Bearer. This stays as is. XSS is the residual risk, so keep the CSP on the Next side tight. A 401 clears the token and redirects to `/login`. The SW must not intercept or cache this, and must not serve a cached `/api` response after the token is cleared (see PITFALLS).

## Railway Deployment Architecture

- **Services:** one project, two services (`backend` from the Dockerfile with root directory `backend/`, and a Postgres plugin). Wire `DATABASE_URL` via a reference variable to the Postgres service's private URL (`${{Postgres.DATABASE_URL}}`, verify the exact name in the dashboard or CLI). Do not hard-code it.
- **Config as code:** add `backend/railway.toml` (or `railway.json`) with `builder = DOCKERFILE`, `healthcheckPath = "/health"`, `healthcheckTimeout`, and `restartPolicyType = ON_FAILURE`. Delete `render.yaml` (both root and backend copies exist).
- **Migrations:** keep `prisma migrate deploy` in `entrypoint.sh` for now. It is simple and correct at one replica. A Railway pre-deploy command is the cleaner option, but only add it if the entrypoint's failure mode (crash loop on a bad migration) proves annoying. Do not use `migrate dev` or `db push` in production.
- **Required `app.ts` changes before the first deploy** (these are small and blocking):
  1. `app.set('trust proxy', 1)` before any middleware.
  2. Register `/health` BEFORE the HTTPS-redirect middleware, or exempt it. The health check must return 200 over plain HTTP.
  3. Make `/health` include a cheap DB ping (`SELECT 1`) as a separate `/health/ready`. Keep `/health` DB-free so a DB blip does not restart the service.
  4. CORS: replace exact-match with an allowlist plus optional suffix or regex for Vercel previews (for example `CORS_ORIGIN_PATTERN=^https://kitcha-.*\.vercel\.app$`). Add explicit `allowedHeaders: ['Authorization','Content-Type']` and `methods`.
  5. Do not set `PORT` as a Railway variable. Let Railway inject it. `config.port` already reads it, and the app already binds `0.0.0.0`.
- **Env contract:** `DATABASE_URL`, `JWT_SECRET` (32+ chars, validated at boot already), `NODE_ENV=production`, `CORS_ORIGIN`, `FRONTEND_URL`, `GEMINI_AI_API_KEY` plus the optional provider keys, and `AI_DAILY_LIMIT_PER_USER`. Validate them with a Zod schema in `env.config.ts` at boot (fail fast), instead of the current ad-hoc checks.
- **Frontend side:** set `NEXT_PUBLIC_API_URL` in Vercel to the Railway public domain. It is inlined at build time, so a changed backend URL needs a redeploy. Use a stable Railway domain, or a custom domain.
- **Cost guard:** single small replica and no sleep tricks. Railway's free or trial credit model has changed over time (verify current pricing before promising "zero cost" to the user).

## PWA Architecture (Next.js 16 App Router)

- **Manifest:** use the native `app/manifest.ts` (Next metadata file convention). Set `display: 'standalone'`, `start_url: '/dashboard'`, `scope: '/'`, and 192, 512 and maskable icons under `public/`. Add `viewport` with `viewportFit: 'cover'` and `themeColor` in the root layout, plus the Apple touch icon and `appleWebApp` metadata for iOS.
- **Service worker:** hand-written `public/sw.js` registered from a small client component, or Serwist (the maintained successor to next-pwa). Recommendation: **Serwist** if Next 16 build compatibility is confirmed in-phase (check: Turbopack is the default bundler in 16 and Serwist's webpack plugin has historically needed a webpack build), otherwise a hand-written minimal SW. This is the main research flag for the PWA phase. Do not use the unmaintained `next-pwa`.
- **Caching policy:**
  - Precache: shell, `/_next/static/*`, icons, `/offline` page.
  - `/_next/static`: cache-first (hashed, immutable).
  - Navigation: network-first with offline fallback to `/offline`, or to the cached shell.
  - Cross-origin `/api/v1/*` GETs: do NOT put in the SW cache. Offline data is handled by React Query persistence, keyed per user and cleared on logout. This avoids a second cache layer that leaks one user's data to the next and ignores token changes.
  - Never cache POST, PUT, PATCH or DELETE, `/auth/*`, or `/ai/*`.
- **Layout restructure:** keep the route groups. Change `(app)/layout.tsx` to render `<BottomNav/>` (visible below `lg`, fixed, with `pb-[env(safe-area-inset-bottom)]`), and keep `DashboardSidebar` at `lg:` and up. Replace `h-screen` with `h-dvh` (mobile browser chrome breaks `100vh`). Add main-content bottom padding equal to the nav height. The sidebar and header become desktop-only or slimmed. Bottom nav carries 4 to 5 destinations (Dashboard, Pantry, Recipes, Plan, Shopping) and moves the rest (Budget, Analytics, Alerts, Settings, Profile, Help) to a "More" sheet. `(auth)` stays outside the shell.
- **Install prompt:** a client hook that captures `beforeinstallprompt` (Chromium) and a manual "Add to Home Screen" instructions card for iOS Safari (no event exists there). Show it after the second visit or a meaningful action, not at first load. Persist the dismissal.
- **Offline UX:** `useOnlineStatus` plus a banner, and mutation buttons disabled offline.

## Patterns to Follow

### Pattern 1: Orchestrator owns the policy, adapters stay dumb
Caching, quota, validation and fallback live in one place. Adding a provider is one new file implementing `LlmProvider` plus one env entry. Swapping the "winner" of the provider comparison needs no controller or route changes.

### Pattern 2: Schema as contract
One Zod schema per feature (`RecipeSuggestionsSchema`, `SubstitutionsSchema`, `MealPlanSchema`). Derive TS types with `z.infer`, deleting the hand-written interfaces. Where the provider supports native JSON mode or schema output, pass it, and still validate with Zod because providers differ.

### Pattern 3: Quota failure is a normal result
429 with `{ code: 'AI_QUOTA_EXCEEDED', resetAt }`. The frontend renders an empty-state style message instead of an error toast.

### Pattern 4: Stale-while-revalidate on the client
React Query `staleTime` of a few minutes and `gcTime` of 24h or more, with `persistQueryClient` to IndexedDB (via `idb-keyval`), scoped by user ID and wiped on logout.

## Anti-Patterns to Avoid

### Anti-Pattern 1: SW-caching authenticated cross-origin API responses
**Why bad:** Stale or cross-user data after logout, with a token the SW cannot see change. **Instead:** React Query persistence, cleared on logout.

### Anti-Pattern 2: Quota in memory (`express-rate-limit` as the daily quota)
**Why bad:** Resets on each Railway deploy and restart. **Instead:** DB-backed `AiUsage`. Keep `aiLimiter` only as a burst guard, and move its store off IP-keyed fallback.

### Anti-Pattern 3: Caching raw model text or unvalidated output
**Why bad:** A bad answer gets served for 24h. **Instead:** Cache only Zod-validated payloads.

### Anti-Pattern 4: Per-user data in a shared cache key
**Why bad:** Pantry-derived prompts are personal. **Instead:** Key by the canonical input hash (which already encodes the pantry), scope the row to `userId` where the prompt includes personal data, and share globally only for generic lookups (substitution of "butter", food-data API responses).

### Anti-Pattern 5: Provider SDKs imported outside adapters
**Why bad:** Reintroduces lock-in, which is today's state (`@google/generative-ai` in the service). **Instead:** Plain `fetch` adapters are enough for the OpenAI-compatible providers (Groq, OpenRouter, Mistral share a chat-completions shape), so one `OpenAiCompatibleProvider` class with different `baseUrl` and `model` covers three vendors.

## New Persistence (Prisma additions)

| Model | Fields | Notes |
|-------|--------|-------|
| `AiUsage` | `userId`, `day` (date), `count`, unique `(userId, day)` | Atomic upsert. Cascade-delete with User. |
| `AiCache` | `key` (unique), `feature`, `payload` (Json), `provider`, `model`, `userId?`, `expiresAt`, `createdAt`, index on `expiresAt` | Cleanup job: delete where `expiresAt < now()`. Piggy-back on the existing in-process scheduler (daily). |
| `FoodDataCache` (optional) | `source`, `key`, `payload`, `expiresAt` | Only if food APIs get used. Open Food Facts and USDA responses are stable, so use long TTLs. |

One additive migration, and no changes to existing models, so it is safe on the first Railway deploy.

## Build Order (dependencies)

```
1. Railway foundation  ------------------------------+
   (app.ts fixes, railway config, env schema,        |
    Postgres, migrate, CORS, health, CI)             |
        |                                            |
        v                                            v
2. AI layer (backend-only,                  3. PWA/mobile (frontend-only,
   testable locally without Railway)           needs deployed API URL only
   2a delete dead services/ai.service.ts       for real-device testing)
   2b LlmProvider iface + Gemini adapter       3a manifest + icons + viewport
      (behaviour-preserving refactor)          3b layout: bottom nav, h-dvh,
   2c Zod schemas + validator                      safe areas, More sheet
   2d AiCache + AiUsage migration + guard      3c per-screen mobile layouts
   2e 2nd provider + chain + food-data         3d service worker + offline page
   2f frontend: quota meta in UI               3e React Query persistence
                                               3f install prompt
        \________________ both depend on 1 ________/
```

Recommended phase order: **1 Railway, then 3a to 3c (mobile layout) in parallel with 2 (AI), then 3d to 3f (offline and install)**.

Rationale:
- **Railway first.** It is small, it unblocks real-device testing (a PWA needs HTTPS and a real API, since service workers don't register on plain HTTP except localhost), and its trust-proxy fix is a prerequisite for correct per-user rate limiting and any quota logic. Deploying the migration pipeline early also de-risks the later AI table migration.
- **AI and mobile layout are independent** (backend vs frontend, no shared files except `lib/api/ai.ts` response typing), so they can be parallel phases.
- **Service worker last in the PWA work.** It is the hardest to debug and the easiest to get wrong (stale caches). Ship it only after the responsive layouts stabilise, so precache manifests don't churn. Test it only against a production build (`next build && next start`) and not `next dev`.
- **Within AI:** do the behaviour-preserving adapter refactor (2b) before adding providers, so regressions are attributable. Add the cache and quota before the second provider so the comparison is made under the production guard conditions. The provider comparison itself (a research task) should feed 2e rather than gate 2b to 2d.

## Scalability Considerations

| Concern | Today (a handful of users) | 100s of users | Notes |
|---------|---------------------------|---------------|-------|
| Replicas | 1 (required by in-process cron) | Extract the cron to a Railway cron service before scaling | Not needed in this milestone |
| AI quota | Per-user per-day in Postgres | Add a global daily ceiling so total usage stays under the free tier of the vendor | Add a global `AiUsage` row (`userId = null`, or a sentinel) cheaply now |
| Cache size | Negligible | TTL cleanup | Index on `expiresAt` |
| Rate-limit store | In-memory | Needs a shared store if replicas > 1 | Not needed in this milestone |

## Open Items for Phase-Level Research

- Serwist vs hand-written SW under Next 16.0.2 and Turbopack (HIGH risk of rework if wrong).
- Railway specifics to verify with the CLI or docs: reference-variable syntax, the healthcheck host header and how it interacts with the HTTPS redirect, whether pre-deploy commands are available on the current plan, and the current free credit terms.
- Which providers support native JSON schema output and what their free-tier daily limits are (feeds the `LlmRequest.jsonSchema` field and the default quota number). This is a separate AI-comparison research task.
- iOS PWA limits (no `beforeinstallprompt`, storage eviction after inactivity, push needs install). Relevant to the offline expectations and to any later notification work.

## Sources

- Codebase (HIGH): `backend/src/app.ts`, `index.ts`, `config/env.config.ts`, `middleware/rateLimiter.ts`, `modules/ai/*`, `services/ai.service.ts`, `Dockerfile`, `entrypoint.sh`, `render.yaml`, `frontend/lib/api/client.ts`, `frontend/app/(app)/layout.tsx`, `frontend/app/layout.tsx`, `frontend/lib/constants/api-routes.ts`.
- Railway, Next.js PWA, Serwist and iOS PWA behaviour: training knowledge, NOT verified against current docs in this pass (LOW to MEDIUM). Verify in the relevant phase research as listed above.
