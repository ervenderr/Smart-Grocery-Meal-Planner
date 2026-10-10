# Phase 7: Store Readiness - Research

**Researched:** 2026-10-10
**Domain:** Express/Prisma account lifecycle, AI consent gating, legal pages (Next.js 16 App Router), App Store review artifacts
**Confidence:** HIGH for code-level findings (read from repo, one verified experimentally), MEDIUM for Apple policy wording (from `.planning/research-v2/04`, not re-fetched)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Account deletion (STORE-01):** add a real hard-delete route (the existing `DELETE /users/account` only deactivates; `deleteAccount()` in users.service.ts has no route; route validation requires a password the frontend never sends - fix end to end). Re-auth by password in body. Delete in ONE transaction: all user-owned rows (pantry+lots, recipes, meal plans, shopping lists/items, budget, notifications, etc.) AND `AiUsage` rows (no FK today - delete explicitly). Verify via a test that enumerates every Prisma model with a userId. Frontend: Settings "Delete account" with confirm sheet + password, then clear local state and redirect to login.
- **AI consent (STORE-02):** nullable `aiConsentAt` + `aiConsentVersion` on User (additive migration). `POST/DELETE /users/me/ai-consent` (or equivalent). All AI endpoints return 403 `AI_CONSENT_REQUIRED` without consent. Frontend consent sheet shown before any AI entry point sends data; names the provider category, what is sent (pantry item names, diet tags; no email/name), and links to privacy policy; withdraw in Settings.
- **AI labels + report (STORE-03):** "AI-generated" badge and a short health/nutrition disclaimer on every AI recipe/plan surface; "Report" action stores an `AiReport` row (userId, kind, refId/snapshot, reason, createdAt) via authenticated endpoint; rate limited.
- **Legal pages (STORE-04):** public Next routes `/privacy`, `/terms`, `/support` in the existing frontend (hosted on Vercel), no auth, linked from Settings and the sign-up screen. Draft real content covering data collected, AI providers, Open Food Facts attribution (ODbL), deletion, contact. Support email from env `NEXT_PUBLIC_SUPPORT_EMAIL`. Mark clearly in the summary that the text is a draft for the owner to review (not legal advice).
- **Name (STORE-05):** keep "Kitcha" as working name (a similar app "Kitcha: Save, Plan, Cook" by Kamp Inc exists - flagged). Produce `docs/store/NAME-CHECK.md` (App Store search, USPTO/WIPO/IPOPHL checklist) and 5+ fallback names. Do NOT rename code.
- **Reviewer account (STORE-05):** idempotent seed script `backend/scripts/seed-reviewer.ts` (demo user + sample pantry/recipes/shopping/plan), plus `docs/store/REVIEW-NOTES.md`. Script is tested locally only; running it against production is a later human-approved step.

### Claude's Discretion
Table/route names, UI placement within Settings, copy wording, test layout - follow existing codebase conventions (zod validation at boundaries, small files, immutable updates, additive migrations only).

### Deferred Ideas (OUT OF SCOPE)
- Actual trademark clearance / final name (human). Production seeding of the reviewer account. Sign in with Apple (only if third-party login is added).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-01 | Hard-delete account + all data, re-auth | Verified FK RESTRICT trap on `meal_plan_items.recipe_id`; ordered delete in one tx; AiUsage `user:<id>` cleanup; DMMF enumeration test |
| STORE-02 | Consent before data sent to AI; withdraw | `requireAiConsent` middleware on ai router; additive columns; profile endpoint exposes consent; central 403 handler in axios client |
| STORE-03 | AI label, disclaimer, report | `AiReport` table; `/ai/report` rate-limited; shared badge/disclaimer components |
| STORE-04 | Hosted Privacy/Terms/Support linked | Server-component pages outside `(app)`/`(auth)`; no middleware blocks them; real `<a href>` |
| STORE-05 | Reviewer account, notes, name check | Idempotent seed script modeled on `prisma/seed.ts` guards; docs files |
</phase_requirements>

## Summary

This phase is almost entirely additive on the existing stack: one Prisma migration (2 nullable User columns + 1 new `ai_reports` table), a hardened delete flow, a consent middleware on the AI router, a small set of shared frontend components, three static legal pages, and docs/scripts. No new dependencies are needed (UI-SPEC forbids them; none are required).

The most important finding is a latent bug in the existing hard-delete path. `meal_plan_items.recipe_id` is `ON DELETE RESTRICT` (initial migration line 291; the Prisma relation has no `onDelete`). When a user row is deleted, Postgres cascades to both `recipes` and `meal_plans`; RESTRICT is checked immediately, so if the recipe cascade runs before the meal-plan cascade the whole delete fails with an FK violation. I reproduced this on a scratch Postgres 16 with an equivalent schema (user -> recipe and user -> meal_plan -> item -> recipe RESTRICT): `delete from u` raised `violates foreign key constraint`. So the existing `usersService.deleteAccount()` (a bare `prisma.user.delete`) cannot be trusted for any user who has a meal plan using their own recipes (nearly every active user). The fix needs no migration: inside the transaction, `deleteMany` meal plan items first, then delete the user.

Secondary findings: the existing frontend delete button (`components/settings/data-settings.tsx`) sends no password and shows a success toast regardless; it must be removed/replaced by the new sheet. The Settings page is tab-based (profile/password/preferences/data), not a stack of cards, so UI-SPEC "append cards below existing sections" needs a mapping decision (see Architecture). `AiCache` is keyed by content hash and contains no user id, so it needs no deletion. No local Postgres is running (`pg_isready` no response, Docker daemon down), but `postgresql@16` is installed under Homebrew, so backend DB tests need a Wave 0 environment step.

**Primary recommendation:** Implement delete as one `prisma.$transaction` that (1) re-verifies password, (2) `mealPlanItem.deleteMany({ where: { mealPlan: { userId } } })`, (3) `$executeRaw DELETE FROM ai_usage WHERE scope = 'user:'||id`, (4) `user.delete` (cascades the rest), and guard completeness with a DMMF-driven test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hard delete + re-auth | API / Backend | Database (cascades) | Password check and transactional delete must be server-side |
| Clear local state after delete | Browser / Client | — | Token in localStorage, react-query cache |
| Consent record | Database / Storage | API | Server is source of truth (Apple wants provable consent) |
| Consent enforcement | API / Backend | — | 403 `AI_CONSENT_REQUIRED` must not be bypassable by client |
| Consent UI trigger | Browser / Client | — | Sheet before first AI action; also reacts to 403 |
| AI badge/disclaimer | Browser / Client | — | Presentational |
| AI report storage + rate limit | API / Backend | Database | Authenticated write, abuse-limited |
| Legal pages | Frontend Server (SSR/static) | CDN | Public, no auth, indexable |
| Reviewer seed | Backend script | Database | Local-only tooling |
| Name check / review notes | Docs | — | Human-facing artifacts |

## Standard Stack

No new packages. Use what exists. [VERIFIED: backend/package.json, frontend/package.json]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma / @prisma/client | 5.22.0 (pinned) | Schema, migration, transactions | Locked; stay on 5.22 per CLAUDE.md |
| express-validator | ^7.0.1 | Route validation in `users` and `ai` modules | Existing convention there (`validate` from auth.validation) |
| zod | ^4.6.5 (backend), ^4.1.12 (frontend) | New report/consent bodies (CONTEXT says zod at boundaries) | Already installed both sides; use for new endpoints' body parsing in a small helper, or express-validator to match neighbors |
| express-rate-limit | existing | Report rate limit | Pattern in `middleware/rateLimiter.ts` |
| @radix-ui/react-dialog via `components/ui/modal.tsx` | existing | All sheets | UI-SPEC: no second dialog primitive |
| lucide-react ^0.553 | existing | `Sparkles`, `Info`, `Flag`, `AlertTriangle`, `ChevronRight` | UI-SPEC icon library |
| react-hot-toast | ^2.6 | Report success toast | Already used |
| zustand ^5 | existing | Consent state store (optional; react-query also fine) | `lib/stores/` exists |
| jest 29 + ts-jest + supertest | existing | Backend tests (real DB) | `jest.config.js`, `tests/setup.ts` |
| vitest 5.0.3 | existing | Frontend tests, `environment: 'node'`, include `lib/**/*.test.ts` only | No jsdom / testing-library installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit ordered delete | Change FK to `onDelete: Cascade` on `MealPlanItem.recipe` | Changes semantics (deleting a recipe would silently delete plan items) and is not purely additive; reject |
| Middleware on router | Per-controller consent check | Easy to miss a new AI route; router-level middleware covers all |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed in this phase. slopcheck not run (nothing to check).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser (Next.js, Vercel)
  Settings --[DELETE /users/me {password}]--> usersRoutes -> authenticate -> validate -> usersService.deleteAccountPermanently
                                                    |- tx: verify pw -> delete meal_plan_items -> delete ai_usage(user:<id>) -> delete user (CASCADE rest)
                                                    '-> 204  --> client: clear token + react-query + storage -> /login?deleted=1
  AI entry point (suggest / plan / substitute)
     |-- consent known false? --> AiConsentSheet --[POST /users/me/ai-consent]--> users.aiConsentAt/Version --> resume original action
     '-- consent true --> POST /ai/* -> authenticate -> aiBurstLimiter -> requireAiConsent -> validate -> controller
                                            '-- no consent: 403 {code: AI_CONSENT_REQUIRED} --> axios interceptor --> opens AiConsentSheet
  AI result UI: AiBadge + AiDisclaimer + "Report suggestion" --[POST /ai/reports]--> reportLimiter -> ai_reports row
Public: GET /privacy /terms /support (server components, no auth) <- linked from Settings, signup, login footer
Scripts/docs: backend/scripts/seed-reviewer.ts (local DB only), docs/store/NAME-CHECK.md, docs/store/REVIEW-NOTES.md
```

### Recommended Project Structure
```
backend/
├── prisma/migrations/2026MMDDHHMMSS_store_readiness/migration.sql   # additive only
├── src/modules/users/
│   ├── users.routes.ts            # + DELETE /me, POST/DELETE /me/ai-consent  (keep DELETE /account deactivate or remove)
│   ├── account-deletion.service.ts   # new, small file (users.service.ts is already ~350 lines)
│   └── ai-consent.service.ts
├── src/modules/ai/
│   ├── require-ai-consent.ts      # middleware
│   └── ai-report.{routes,controller,service}.ts or in ai.routes.ts
├── scripts/seed-reviewer.ts
└── tests/ (account-deletion.test.ts, ai-consent.test.ts, ai-report.test.ts, seed-reviewer.test.ts)
frontend/
├── app/privacy|terms|support/page.tsx      # public, outside (app) and (auth)
├── components/legal/ (legal-shell.tsx, draft-banner const)
├── components/ai/ (ai-consent-sheet.tsx, ai-badge.tsx, ai-disclaimer.tsx, report-sheet.tsx)
├── components/settings/ (ai-privacy-settings.tsx, legal-links.tsx, delete-account-sheet.tsx)
└── lib/ (api/consent.ts, ai-consent-store, pure helpers with *.test.ts)
docs/store/NAME-CHECK.md, REVIEW-NOTES.md
```

### Pattern 1: Transactional hard delete (STORE-01)
**What:** One interactive transaction; ordered; password verified inside (or immediately before) it.
**Example:**
```typescript
// Source: schema.prisma + initial migration (RESTRICT on meal_plan_items.recipe_id); AiUsage scope format from ai-quota.repository.ts
await prisma.$transaction(async (tx) => {
  await tx.mealPlanItem.deleteMany({ where: { mealPlan: { userId } } });      // avoids RESTRICT on recipes
  await tx.$executeRaw`DELETE FROM ai_usage WHERE scope = ${`user:${userId}`}`;
  await tx.user.delete({ where: { id: userId } });                             // cascades the rest
});
```
Return 204 (or 200 `{message}`; pick one and match the frontend). Wrong password -> `AppError('Incorrect password', 401)` collides with the axios 401 interceptor, which clears the token and redirects to `/login`. Use a distinct status/code for wrong-password-on-delete (recommend 403 with `code: 'INVALID_PASSWORD'`, or 400) so the UI can show the inline error "That password is incorrect" without logging the user out. This is a required fix, not optional. [VERIFIED: client.ts 401 branch]

### Pattern 2: Consent middleware (STORE-02)
**What:** After `authenticate`, load `aiConsentAt` (one `findUnique select`), else `throw new AppError(msg, 403, true, { code: 'AI_CONSENT_REQUIRED' })`. Place before `validate`. Exempt `GET /ai/status` (no user data) — mount middleware per route or after the status route. Add the code to `AI_ERROR_CODES` in `ai.errors.ts`. Consent version constant (e.g. `AI_CONSENT_VERSION = 1`) in one module; treat `aiConsentVersion < CURRENT` as no consent so a policy change re-prompts.
Consent endpoints: `POST /users/me/ai-consent` sets `aiConsentAt = now(), aiConsentVersion = CURRENT` (server-stamped, idempotent, same style as `onboarding/complete`); `DELETE /users/me/ai-consent` nulls both. Expose `aiConsentAt`/`aiConsentVersion` via `getProfile` select so the frontend knows state on load.

### Pattern 3: Central 403 handling (frontend)
Axios response interceptor `case 403`: if `error.response.data.code === 'AI_CONSENT_REQUIRED'` call a consent-store `request()` that opens the shared sheet (single mount in the `(app)` layout), do not just `console.error`. The AI modals must also pre-check consent from the profile so no request fires before acceptance (UI-SPEC). Provide a `withAiConsent(action)` helper: if consented run, else open sheet and run on accept (pure, unit-testable in vitest node env).

### Pattern 4: Public legal pages (STORE-04)
Server components in `app/privacy|terms|support/page.tsx` with `export const metadata`. There is no `middleware.ts`/`proxy.ts` in `frontend/`, so nothing redirects unauthenticated users; auth is client-side in `(app)` layout / `protected-route`. [VERIFIED: ls shows neither file] Shared `LegalShell` component, `DRAFT_BANNER_ENABLED` single constant. `NEXT_PUBLIC_SUPPORT_EMAIL` is inlined at build time (like `NEXT_PUBLIC_API_URL`); add it to `frontend/.env.example`. Pages are static-export compatible (important for Phase 10): avoid `headers()`/`cookies()` and reading env at request time. Do not read the env inside a client component conditionally in a way that differs server vs client.

### Pattern 5: Reviewer seed
Copy the refusal guards from `prisma/seed.ts` (refuse if `NODE_ENV=production`, or `DATABASE_URL` not local unless `ALLOW_SEED=true`). Upsert by email; use `hashPassword` from `src/utils/password.util`. Make idempotency real: upsert user, then `deleteMany` the reviewer's pantry/recipes/lists/plans (in FK-safe order: meal plan items before recipes) and recreate, or upsert by deterministic natural keys. Password from env `REVIEWER_PASSWORD` (required; no hardcoded secret in repo per security.md); print nothing sensitive. Also set `aiConsentAt` on the reviewer? No: leave consent unset so reviewers see the consent flow (Apple will test it), and say so in REVIEW-NOTES. Set preferences `onboardingCompletedAt` so they land in the app. Place script in `backend/scripts/` (new dir; add `"seed:reviewer": "ts-node scripts/seed-reviewer.ts"`; check `tsconfig` `include`/paths: `@/` alias is used in src, so use relative imports in scripts as `prisma/seed.ts` does). The ESLint script globs only `src`, `tests`, `prisma`; extend if desired.

### Anti-Patterns to Avoid
- **Bare `prisma.user.delete`:** fails on RESTRICT (verified above).
- **401 for wrong delete password:** triggers global logout redirect.
- **Per-modal consent only:** misses the 403 path and future AI routes.
- **Rename to "Kitcha" alternatives in code:** CONTEXT forbids; docs only.
- **Putting consent check after `validate`/controller work:** leaks pantry data into prompt building before refusal. Keep it first.
- **Touching `frontend/lib/rules`:** Phase 9 agent owns it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialogs/sheets | New overlay | `components/ui/modal.tsx` | Focus trap, safe-area, a11y already handled |
| Password verify | New hashing | `comparePassword` in `utils/password.util` | Existing bcrypt |
| Rate limiting | Custom counters | `express-rate-limit` as in `rateLimiter.ts` (key by user id when authenticated; see `aiBurstLimiter`) | Existing pattern |
| Error shape | Ad-hoc JSON | `AppError(..., { code })` | errorHandler already emits `code` and `error` alias |
| Completeness of delete | Hand-maintained model list | `Prisma.dmmf.datamodel.models` scan for a `userId`/relation to User field | Fails the test when a future model is added without cleanup |
| Legal text | Licensed boilerplate generator | Draft in-repo with banner | CONTEXT decision; flagged not legal advice |

## Runtime State Inventory

Not a rename phase, but deletion touches runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | All `userId`-FK tables cascade (11 relations verified in schema); `ai_usage` rows with scope `user:<id>` have no FK; `ai_cache` has no user data (key excludes userId) | Explicit delete of ai_usage rows; no action for ai_cache |
| Live service config | `ZapierWebhook` rows cascade; user-configured external Zapier endpoints receive no deletion notice | Document in privacy policy; no code |
| OS-registered state | None - verified by grep of schema/modules; no scheduler registered per user | None |
| Secrets/env vars | None tied to user ids. New: `NEXT_PUBLIC_SUPPORT_EMAIL` (frontend), `REVIEWER_PASSWORD` (script) | Add to `.env.example` files |
| Build artifacts | None | None |
| Auth tokens | JWTs remain cryptographically valid after deletion, but `authenticate` loads the user from DB, so they stop working (401) | Add a test asserting old token -> 401 after delete |

## Common Pitfalls

### Pitfall 1: FK RESTRICT blocks user delete
**What goes wrong:** `prisma.user.delete` throws P2003 when any of the user's recipes is used in a meal plan item. **Why:** `meal_plan_items.recipe_id ON DELETE RESTRICT`, immediate check, cascade order not guaranteed. **Avoid:** delete plan items first. **Warning sign:** test with a recipe + plan item fails; make this the primary test fixture. [VERIFIED: scratch Postgres 16 reproduction + migration.sql:291]

### Pitfall 2: 401 on wrong password logs the user out
See Pattern 1. Also the existing `deactivateAccount` returns 401 for the same reason; leave that route or remove it, but don't reuse its error status.

### Pitfall 3: Stale client state after delete
`clearUserSessionState` clears only react-query cache and the `current-shopping-list` key; the token is cleared by the private `clearToken` in the ApiClient, and `useAuthStore.clearAuth` exists. After success call `clearAuth()`, `clearUserSessionState(queryClient, sessionStorage, localStorage)`, remove `auth-token`, then `router.replace('/login?deleted=1')` (not `push`, no back navigation into the app). Add the new consent-store key to `USER_SCOPED_STORAGE_KEYS` if persisted. Do not call the 401 path.

### Pitfall 4: Consent cached across accounts
If consent state is held client-side, it must come from the profile of the logged-in user and be cleared on logout/delete (cache clear handles react-query; a zustand store needs explicit reset). Server remains authoritative.

### Pitfall 5: Existing delete UI lies
`data-settings.tsx` `deleteAccount` calls the endpoint with no body and the typed-text gate ("DELETE MY ACCOUNT"). Replace that card with the new sheet (UI-SPEC: password is the confirmation); remove the dead `showDeleteConfirm`/`deleteConfirmText` state. UI-SPEC wants a "Danger zone" card; put it in the Data tab (replacing the old one) or a new "Privacy" tab.

### Pitfall 6: Settings is tabbed, UI-SPEC assumes stacked cards
Map: add a new tab "Privacy" (`AI and privacy` card + `Legal and support` card) and keep the Danger zone in the existing `data` tab (replacing the old delete card). Add `'privacy'` to `SettingsTab`, the allow-list in `useEffect`, and `tabs`. Keep `h-11` chips.

### Pitfall 7: Report endpoint abuse / PII
`AiReport` snapshot must be size-capped (e.g. validate `snapshot` JSON <= ~8 KB, `note` <= 500 chars as per UI-SPEC) and never include email/name. Rate limit per user (e.g. 5/hour) with message matching UI copy; the frontend maps 429 to "You've sent several reports recently." Deleting the user must also remove their reports: define `AiReport.user` with `onDelete: Cascade` (then the DMMF test covers it).

### Pitfall 8: Additive migration discipline
Hand-edit nothing destructive. `ALTER TABLE users ADD COLUMN ai_consent_at TIMESTAMP(3), ADD COLUMN ai_consent_version INTEGER;` + `CREATE TABLE ai_reports (...)` + FK + index. Generate with `prisma migrate dev --create-only`, inspect SQL for any DROP/ALTER-type, then apply. Existing migration naming uses odd future-dated stamps (`20261013010000_...`); use a stamp later than `20261013010000` so ordering holds (e.g. `20261014000000_store_readiness`) or `migrate dev` will complain about out-of-order history in dev DBs. [VERIFIED: ls migrations]

### Pitfall 9: Name-check doc scope
Record only what can be verified without a human: the Kamp Inc app (ID 6758049420) from research-v2/04 [CITED: apppricinglab.com via research-v2/04]. Offer checklists with links (App Store Connect name availability, USPTO Trademark Search, WIPO Global Brand Database, IPOPHL e-search, EUIPO) as unchecked boxes; do not claim clearance. Fallback names must be coined/distinct (5+); instruct to run the same checklist on each.

### Pitfall 10: Apple review specifics
Reviewer will exercise sign-up, AI features, and delete. REVIEW-NOTES should state: credentials (via env/App Store Connect field, not committed), AI consent flow expected on first AI use, AI daily quota, where Delete account lives, backend URL, Open Food Facts usage. Notes must not embed the real password; reference the field in App Store Connect. [CITED: research-v2/04 rows 1, 3, 9, 12, 13]

## Code Examples

### Dynamic completeness test (STORE-01)
```typescript
// Source: Prisma 5 runtime DMMF (Prisma.dmmf.datamodel.models)
import { Prisma } from '@prisma/client';
const ownedModels = Prisma.dmmf.datamodel.models.filter((m) =>
  m.fields.some((f) => f.kind === 'object' && f.type === 'User')
);
// For each: seed one row for user A and one for user B via a per-model factory map;
// assert after delete(A): count(A)=0, count(B)=1. Fail loudly if a model has no factory
// (forces authors of new models to extend the test). Child tables without userId
// (MealPlanItem, ShoppingListItem) are asserted through their parents.
// Also assert: ai_usage 'user:A' gone, 'user:B' and 'global' remain.
```
Caveat: whether `Prisma.dmmf` is public API in 5.22 is [ASSUMED] — fallback is reading `prisma/schema.prisma` text with a regex for `user  User @relation`. Planner: verify with a one-line script in the first task.

### Consent middleware sketch
```typescript
export const requireAiConsent = asyncHandler(async (req, _res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as any).user.id },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });
  if (!user?.aiConsentAt || (user.aiConsentVersion ?? 0) < AI_CONSENT_VERSION) {
    throw new AppError('AI features are turned off. Accept to continue.', 403, true,
      { code: AI_ERROR_CODES.CONSENT_REQUIRED });
  }
  next();
});
```
Existing AI tests (`ai-recipes`, `ai-meal-plan`, `ai-substitutions`, `ai-quota`, etc.) create users without consent and will start getting 403. Update `tests/helpers/ai-test-helpers.ts` `createUserWithPantry` to set `aiConsentAt`/`aiConsentVersion`, which fixes all of them in one place. [VERIFIED: helper exists; assumes all AI tests use it - planner must grep `request(app).post('/api/v1/ai` outside the helper]

### Prisma additions
```prisma
model User { /* ... */ aiConsentAt DateTime? @map("ai_consent_at")
                       aiConsentVersion Int? @map("ai_consent_version")
                       aiReports AiReport[] }
model AiReport {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  kind      String            // 'recipe' | 'meal_plan' | 'substitution'
  refId     String?  @map("ref_id")
  snapshot  Json?
  reason    String
  note      String?  @db.VarChar(500)
  createdAt DateTime @default(now()) @map("created_at")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("ai_reports")
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Soft deactivate | Apple 5.1.1(v) requires in-app deletion for apps with account creation | Hard delete route needed [CITED: research-v2/04] |
| Implicit AI data sharing | 5.1.2(i) explicit permission before sharing personal data with third-party AI | Consent gate [CITED: research-v2/04] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Prisma.dmmf` is accessible at runtime in 5.22 | Code Examples | Use schema-text parsing fallback |
| A2 | All existing AI tests build users through `createUserWithPantry` | Code Examples | Some tests need individual consent setup |
| A3 | Apple wording of 5.1.1(v)/5.1.2(i)/1.2 as summarised in research-v2/04 (not re-fetched) | State of the Art | Copy/flow tweaks only |
| A4 | Provider label in consent copy "Google Gemini or Groq" matches the active providers in `ai.deps`/env | UI-SPEC copy | Misleading consent text; confirm from `providers/` config before finalizing |
| A5 | Suggested rate limit for reports (5/hour/user) | Pitfall 7 | Tuning only |
| A6 | Legal text content adequacy (PH Data Privacy Act, GDPR) | Legal pages | Owner/legal review required; drafts only |

## Open Questions (RESOLVED)

1. RESOLVED: **Keep `DELETE /users/account` (deactivate)?**
   - Known: no UI should call it after this phase. Recommendation: keep route (low risk), add `DELETE /users/me` for hard delete with a distinct, non-401 wrong-password response; update route docs.
2. RESOLVED: **Does AI result carry an id for `refId`?** Suggestions are ephemeral (cache payloads, no saved id; Recipe has no AI-origin flag). Recommendation: store `snapshot` (capped JSON of the displayed item) and leave `refId` null; do not add a Recipe column (UI-SPEC "if flagged" is therefore skipped).
3. RESOLVED: **Consent for existing users:** all existing users start unconsented; first AI use shows the sheet. Acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | v24.9.0 | — |
| PostgreSQL server | backend jest (real DB), migration test, seed test | not running; `postgresql@16` and `@14` installed via Homebrew; `backend/.env` absent (only `.env.example`) | 16 | `brew services start postgresql@16`, create DB, copy `.env.example`, `prisma migrate deploy` (Wave 0 step) |
| Docker | docker-compose DB | daemon not running | — | Use Homebrew Postgres |
| psql | manual checks | yes | — | — |

**Missing dependencies with no fallback:** none. Database setup is a Wave 0 task; without it backend tests cannot run.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: jest 29 + ts-jest + supertest (real Postgres). Frontend: vitest 5.0.3, node env, `lib/**/*.test.ts` only |
| Config file | `backend/jest.config.js`, `frontend/vitest.config.ts` |
| Quick run command | `cd backend && npx jest tests/account-deletion.test.ts --coverage=false` ; `cd frontend && npx vitest run lib` |
| Full suite command | `cd backend && npm test` ; `cd frontend && npm test && npx tsc --noEmit && npm run lint` ; `npx next build` (with `NEXT_PUBLIC_API_URL` set) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-01 | Delete with user's recipe used in own meal plan succeeds (RESTRICT regression) | integration | `npx jest tests/account-deletion.test.ts` | Wave 0 |
| STORE-01 | Wrong password -> non-401, nothing deleted; missing password -> 400 | integration | same | Wave 0 |
| STORE-01 | Every model with a relation to User has rows removed; other user's rows and `global` ai_usage untouched; old JWT -> 401 | integration (DMMF-driven) | same | Wave 0 |
| STORE-02 | Each AI route (suggest-recipes, suggest-substitutions, generate-meal-plan) returns 403 `AI_CONSENT_REQUIRED` and makes zero provider calls without consent; `/ai/status` unaffected; works after POST consent; 403 again after DELETE; outdated version re-prompts | integration | `npx jest tests/ai-consent.test.ts` | Wave 0 |
| STORE-02 | Consent POST idempotent, server-stamped; profile exposes it | integration | same | Wave 0 |
| STORE-02 | `withAiConsent` helper runs action only after accept (frontend pure logic) | unit | `npx vitest run lib/ai` | Wave 0 |
| STORE-03 | Report stored (user-scoped), validation (reason enum, note<=500, snapshot cap), 429 after limit, 401 unauthenticated | integration | `npx jest tests/ai-report.test.ts` | Wave 0 |
| STORE-03 | Badge/disclaimer/report present on each AI surface | manual/browser (no component test infra) + grep check for `AiBadge` usage in the 3 modals | manual | — |
| STORE-04 | `/privacy`, `/terms`, `/support` render without auth, unique titles, links present in Settings and signup | `next build` + curl of `next start` (200, contains H1) | `cd frontend && npx next build` then curl | Wave 0 |
| STORE-05 | Seed idempotent (run twice, same counts), refuses production/remote DB | integration | `npx jest tests/seed-reviewer.test.ts` | Wave 0 |
| STORE-05 | Docs exist with required sections, 5+ fallback names | file check | `test -f docs/store/NAME-CHECK.md && test -f docs/store/REVIEW-NOTES.md` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single new test file for that task (backend jest, `--coverage=false`) or `vitest run lib`
- **Per wave merge:** full backend + frontend suites, `tsc --noEmit`, lint
- **Phase gate:** full suite green, `next build` green, manual browser pass of consent sheet / delete flow before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Start local Postgres 16, create DB, `backend/.env` from `.env.example`, `npx prisma migrate deploy` (gap: no DB running, no `.env`)
- [ ] `backend/tests/account-deletion.test.ts`, `ai-consent.test.ts`, `ai-report.test.ts`, `seed-reviewer.test.ts`
- [ ] Update `tests/helpers/ai-test-helpers.ts` to grant consent by default (keeps ~10 existing AI test files green)
- [ ] `frontend/lib/ai/*.test.ts` for consent helper (pure TS; no jsdom needed)
- [ ] Optional: `@testing-library/react` + jsdom is NOT installed; do not add (UI-SPEC: no new deps); verify UI manually

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Password re-auth for delete via bcrypt `comparePassword`; account lockout fields exist - consider counting failed delete attempts via the existing lockout or the rate limiter to prevent password-guessing through this endpoint |
| V3 Session Management | yes | Tokens invalid once user row is gone; client clears token |
| V4 Access Control | yes | Derive userId from `req.user`, never from body/params |
| V5 Input Validation | yes | express-validator/zod on password, reason enum, note length, snapshot size |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password brute force via delete endpoint | Spoofing | Rate limit the delete route (e.g. reuse a strict limiter like `authLimiter`-style) |
| CSRF/stolen token deleting account | Tampering | Password re-auth required in body |
| Report spam / storage abuse | DoS | Per-user limiter, field caps, 1 MB global body cap exists |
| PII leakage to AI provider | Info disclosure | Consent text matches actual payload; no new fields added to prompts |
| Info leak in error messages | Info disclosure | Generic messages; do not distinguish "user missing" |
| XSS in report note rendering | Tampering | Never rendered back in this phase; React escapes anyway |
| Hardcoded reviewer password | Info disclosure | Env var only; script refuses production |

## Sources

### Primary (HIGH confidence)
- Repo files read: `backend/prisma/schema.prisma`, migrations (`20251112125700_initial_schema` line 291), `users.routes/service/validation/controller`, `ai.routes/controller/errors`, `ai-quota.repository.ts`, `ai-cache-key.ts`, `middleware/errorHandler.ts`, `rateLimiter.ts`, `app.ts`, `prisma/seed.ts`, `tests/helpers/ai-test-helpers.ts`, `jest.config.js`; frontend `lib/api/client.ts`, `lib/auth/*`, `settings/page.tsx`, `data-settings.tsx`, `modal.tsx`, `vitest.config.ts`, `next.config.ts`, `package.json`
- Experiment: scratch Postgres 16 reproduction of the RESTRICT-vs-CASCADE delete failure (this session)

### Secondary (MEDIUM confidence)
- `.planning/research-v2/04-monetization-appstore.md` (Apple guidelines 5.1.1(v), 5.1.2(i), 1.2, 2.1, name collision) - not re-fetched this session

### Tertiary (LOW confidence)
- Legal content adequacy (PH RA 10173 / GDPR) - needs owner review

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new deps, read from package.json
- Architecture: HIGH - based on actual code; settings tab mapping is a judgment call
- Pitfalls: HIGH for FK/401/test-helper findings, MEDIUM for Apple policy

**Research date:** 2026-10-10
**Valid until:** 2026-11-10 (Apple policies and local environment may change sooner)
