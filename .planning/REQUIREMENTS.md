# Requirements: Kitcha v2

**Defined:** 2026-10-08
**Core Value:** Someone standing in a kitchen or grocery aisle with a phone can quickly see what they have, what to cook, and what to buy, without wasting food or money.

## v1 Requirements

### Platform & Deploy (DEP)

- [x] **DEP-01**: Frontend runs on a patched Next.js (16.4.0+) with matching React and eslint-config-next, and builds cleanly
- [x] **DEP-02**: Backend API is live on Railway (Hobby) with Railway Postgres, deployed via the Railway CLI, with a spend cap set
- [x] **DEP-03**: Railway healthcheck passes: `/health` responds 200 without DB access and is not redirected to HTTPS
- [x] **DEP-04**: Rate limits apply per real client IP behind Railway's proxy (`trust proxy` configured)
- [x] **DEP-05**: Backend accepts requests only from an allowlist of frontend origins (including Vercel preview pattern) and fails fast on missing/invalid env vars
- [x] **DEP-06**: Migrations run on deploy without `npx`, and the app runs as PID 1 via `exec node` so it shuts down cleanly
- [x] **DEP-07**: Frontend production build fails if `NEXT_PUBLIC_API_URL` is missing; deployed frontend talks to the Railway API end to end (register, login, pantry CRUD)
- [x] **DEP-08**: The seed script refuses to run against production; `render.yaml` is removed; `.env.example` documents every variable
- [x] **DEP-09**: CI runs lint, type-check and tests for backend and frontend on every push

### AI Suggestions (AI)

- [x] **AI-01**: AI features use one OpenAI-compatible provider configured by env (`AI_PROVIDER`/`AI_BASE_URL`/`AI_MODEL`/`AI_API_KEY`, Dahl default) behind an `LlmProvider` interface; `@google/generative-ai` and the dead duplicate `src/services/ai.service.ts` are removed (revised per 02-CONTEXT)
- [x] **AI-02**: Every AI response is validated against a Zod schema (one repair retry) before it reaches the user or the cache
- [x] **AI-03**: Identical AI requests are served from a Postgres cache without calling the provider
- [x] **AI-04**: A per-user and global daily AI quota (DB-backed) blocks calls past the cap with a clear message
- [x] **AI-05**: When the provider errors, times out or returns unusable output after one repair, the user gets a clear "unavailable" message, quota is refunded, and a missing key never breaks startup or /health (graceful degradation, no failover; revised per 02-CONTEXT)
- [x] **AI-06**: Pantry and recipe text is delimited in prompts, and dietary/allergen filters are enforced in code on AI output
- [x] **AI-07**: Open Food Facts and USDA FoodData lookups run server-side with required User-Agent, rate-limit handling, cache, and attribution shown in the UI

### Mobile Shell (MOB)

- [x] **MOB-01**: On phones, navigation is a bottom bar with a "More" sheet; the sidebar appears only at `lg` and up
- [x] **MOB-02**: Every screen is usable at 375px width with no horizontal scroll, 44px minimum touch targets, and safe-area padding
- [x] **MOB-03**: Layouts use dynamic viewport height (`dvh`) so mobile browser chrome doesn't clip content
- [x] **MOB-04**: App has a web manifest and icons so it can be added to the home screen on Android and iOS, with a hint explaining how on iOS
- [x] **MOB-05**: New users see a short onboarding (budget, dietary needs, first pantry items) and every list screen has a useful empty state
- [x] **MOB-06**: Currency is configurable per user instead of hard-coded

### Shopping List (SHOP)

- [x] **SHOP-01**: Shopping lists are stored in the backend (new `shopping` module wired to the existing model) and survive reload and device changes
- [x] **SHOP-02**: User can add, edit, remove and check off items manually, and check-offs persist
- [x] **SHOP-03**: User can generate a list from a meal plan and it is saved as a list
- [x] **SHOP-04**: Items are grouped by store category, and a shopping mode keeps the screen awake with large check targets
- [x] **SHOP-05**: User sees estimated vs actual spend for a list

### Pantry-aware Intelligence (INT)

- [x] **INT-01**: Ingredients are parsed into quantity, unit and canonical name; quantities are stored without float drift
- [x] **INT-02**: Generated lists merge the same ingredient across recipes and convert compatible units (count units are never converted to volume/weight)
- [x] **INT-03**: Generated lists subtract what the pantry already has
- [x] **INT-04**: User can mark staples (salt, oil...) that are excluded from generated lists
- [x] **INT-05**: A "Cook this first" view ranks the user's own recipes by how many soon-to-expire pantry items they use, with no AI call

### Capture Loops (CAP)

- [ ] **CAP-01**: User can scan a barcode with the phone camera (library fallback on iOS) to prefill a pantry item from Open Food Facts
- [ ] **CAP-02**: When scan fails, permission is denied or the product is unknown, user can enter the item manually with the barcode kept
- [ ] **CAP-03**: Checking off a shopping item can add it to the pantry ("bought it")
- [ ] **CAP-04**: Marking a recipe or meal as cooked deducts its ingredients from the pantry ("cooked it")
- [ ] **CAP-05**: User can quick-edit pantry quantity (+/-) and expiry from the list without opening a form

## v2 Requirements

### Offline & Install

- **OFF-01**: Serwist service worker precaches the app shell and shows an offline page (needs `@serwist/turbopack` spike on real phones)
- **OFF-02**: Read-only offline data via per-user IndexedDB persistence, cleared on logout
- **OFF-03**: In-app install prompt (Android) and update-available prompt

### Import & Sharing

- **IMP-01**: Import a recipe from a URL
- **HH-01**: Household sharing (requires schema re-key)
- **OFF-04**: Queued offline writes with conflict handling

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | PWA covers mobile-first at far lower cost |
| Paid LLM or data APIs | Side project, free tiers only (Railway Hobby is the single accepted cost) |
| OpenRouter, Mistral, Cerebras, Spoonacular, Edamam | Free tiers too limited, training-data terms or ToS conflicts (see research/STACK.md) |
| Receipt OCR, grocery delivery integrations | High cost, low fit for a side project |
| Calorie diary, social features, real-time sync, ads/paywalls | Not part of core value |
| Horizontal scaling, queues | Single replica is required (in-process Zapier cron) and traffic is tiny |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-01..09 | Phase 1 | Complete |
| AI-01..07 | Phase 2 | Complete (browser UAT deferred) |
| MOB-01..06 | Phase 3 | Complete (real-phone walkthrough deferred) |
| SHOP-01..05 | Phase 4 | Complete (real-phone check deferred) |
| INT-01..05 | Phase 5 | Complete (real-phone check deferred) |
| CAP-01..05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-10-08*
