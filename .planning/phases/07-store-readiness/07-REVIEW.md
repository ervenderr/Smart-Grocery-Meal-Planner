---
phase: 07-store-readiness
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - backend/prisma/migrations/20261014070000_store_readiness/migration.sql
  - backend/prisma/schema.prisma
  - backend/scripts/seed-reviewer.ts
  - backend/src/tools/reviewer-seed.ts
  - backend/src/modules/ai/ai-consent.constants.ts
  - backend/src/modules/ai/ai-report.controller.ts
  - backend/src/modules/ai/ai-report.limiter.ts
  - backend/src/modules/ai/ai-report.schema.ts
  - backend/src/modules/ai/ai-report.service.ts
  - backend/src/modules/ai/ai.errors.ts
  - backend/src/modules/ai/ai.routes.ts
  - backend/src/modules/ai/require-ai-consent.ts
  - backend/src/modules/users/account-deletion.limiter.ts
  - backend/src/modules/users/account-deletion.service.ts
  - backend/src/modules/users/ai-consent.service.ts
  - backend/src/modules/users/users.controller.ts
  - backend/src/modules/users/users.routes.ts
  - backend/src/modules/users/users.validation.ts
  - frontend/app/privacy/page.tsx
  - frontend/app/support/page.tsx
  - frontend/app/terms/page.tsx
  - frontend/components/legal/legal-shell.tsx
  - frontend/components/ai/ai-consent-sheet.tsx
  - frontend/components/ai/report-suggestion.tsx
  - frontend/components/settings/delete-account-sheet.tsx
  - frontend/lib/account/delete-account.ts
  - frontend/lib/ai/ai-origin.ts
  - frontend/lib/ai/consent-flow.ts
  - frontend/lib/ai/report.ts
  - frontend/lib/api/account.ts
  - frontend/lib/api/client.ts
  - frontend/lib/hooks/use-ai-consent.ts
  - frontend/lib/legal/legal-config.ts
  - docs/store/REVIEW-NOTES.md
  - backend/.env.example
  - frontend/.env.example
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard (deep on account deletion, consent gate, report endpoint, reviewer seed, legal pages)
**Files Reviewed:** 36 (tests, UI components not on the security path, and the remaining frontend wiring were skimmed only)
**Status:** issues_found

## Summary

The security-sensitive pieces are mostly sound.

- **Account deletion:** the user id comes from the JWT, the password is re-verified, and wrong-password returns 403 so the client does not log out. The limiter counts failures only. The transaction handles the `meal_plan_items.recipe_id` RESTRICT FK. Every other user-owned model cascades.
- **Consent gate:** `requireAiConsent` runs before the validators on all three generation routes. Consent is server-stamped.
- **Migration:** additive only.
- **Secrets:** none committed.
- **Legal data claim:** "diet/allergen not sent" matches the code in `features/recipes.ts`.

No critical issues were found. The warnings are a real functional bug in report submission, a destructive seed footgun, and several store-submission and robustness gaps.

## Warnings

### WR-01: Report snapshot size is measured in characters on the client but in bytes on the server

**File:** `frontend/lib/ai/report.ts:62` (server side: `backend/src/modules/ai/ai-report.schema.ts:25`)
**Issue:** `buildReportSnapshot` checks `JSON.stringify(candidate).length <= 8192`, which counts UTF-16 code units. The server enforces `Buffer.byteLength(..., 'utf8') <= 8192`. Snapshots with accented, Filipino or CJK text, or emoji, can pass the client check yet exceed 8192 bytes. The server then returns 400 and the user sees "Couldn't send your report" with no way to succeed. The app is PHP-priced, so non-ASCII content is plausible.
**Fix:** Measure bytes on the client.
```ts
const bytes = new TextEncoder().encode(JSON.stringify(candidate)).length;
if (bytes <= MAX_SNAPSHOT_BYTES) return candidate;
```

### WR-02: Reviewer seed can overwrite and wipe a real user's data, and the safety guard is weak

**File:** `backend/src/tools/reviewer-seed.ts:26-35, 206-243`
**Issue:**
- `seedReviewer` upserts by `REVIEWER_EMAIL`. If that email belongs to an existing real account, the seed resets its password, reactivates it, clears its lockout, and `deleteMany`s all of its pantry, recipes, plans and lists. Nothing checks that the account is a reviewer account.
- The production guard relies only on `NODE_ENV === 'production'`. If `NODE_ENV` is unset in a shell pointing at the Railway DB, `ALLOW_SEED=true` bypasses the host check entirely.
- The deployed reviewer account will need to exist in production for App Review. The docs describe a local-only seed, so the process for creating it in production is unclear.

**Fix:** Refuse when an existing user is not a seeded reviewer, for example by requiring `firstName === 'App' && lastName === 'Reviewer'` before the destructive branch. Also restrict `REVIEWER_EMAIL` to a `@kitcha-demo.com` domain, or require an explicit `--force`. Document the supported production procedure in `docs/store/REVIEW-NOTES.md`.

### WR-03: Permanent deletion is not safe against concurrent requests and writes

**File:** `backend/src/modules/users/account-deletion.service.ts:37-41`
**Issue:**
- A double-submit, or a request arriving while another is in flight, lets the second `tx.user.delete` throw Prisma P2025. This surfaces as a 500 rather than an idempotent success or a 404.
- A recipe or meal-plan item created between `mealPlanItem.deleteMany` and `user.delete` (the default isolation is read committed) trips the RESTRICT FK and also returns 500. The user's data is then partially deleted, because the transaction rolls back but the client sees an error.

**Fix:** Delete the user with `tx.user.deleteMany({ where: { id: userId } })` and treat count 0 as already deleted. Also run the transaction at `Serializable` isolation, or take `SELECT ... FOR UPDATE` on the user row first. Add a test for the double-delete.

### WR-04: Store-submission blockers are shipped enabled and not enforced

**File:** `frontend/lib/legal/legal-config.ts:9-10`, `frontend/app/support/page.tsx:46`
**Issue:**
- `DRAFT_BANNER_ENABLED = true` ships "Draft: pending owner review." on the privacy and terms pages.
- When `NEXT_PUBLIC_SUPPORT_EMAIL` is empty (the `.env.example` default), the support page renders "Contact email not configured." and the privacy page falls back to a self-link. The value is inlined at build time, so a missed Vercel variable silently produces a store-rejectable build (Apple and Google both require a working support contact and privacy policy).
- There is no build-time check, unlike `NEXT_PUBLIC_API_URL`, which the comments say is enforced.

**Fix:** Fail the production build when `NEXT_PUBLIC_SUPPORT_EMAIL` is missing or invalid, for example in `next.config.ts`. Drive the draft banner from an env flag, or add a release checklist item that fails if it is still true.

### WR-05: Report snapshot PII stripping is client-only and the server stores arbitrary content

**File:** `backend/src/modules/ai/ai-report.schema.ts:21-27`, `backend/src/modules/ai/ai-report.service.ts:16`
**Issue:**
- The "PII-free" guarantee lives only in `buildReportSnapshot` on the client. The server accepts any record up to 8 KB, stored as JSONB with no key filtering or depth limit. Anyone with a token can store arbitrary data under the app's privacy policy, which says only AI usage counters and reports are kept.
- `refId` has no minimum length or format constraint.
- `note` is trimmed but unsanitised, so control characters pass through.

**Fix:** Strip PII keys server-side with a zod transform that applies the same `PII_KEYS` filter (`email`, `firstName`, `lastName`, `userId`) and a depth limit. Constrain `refId` to `z.string().trim().min(1).max(100)`.

## Info

### IN-01: `(req as any)` used in new controller methods

**File:** `backend/src/modules/users/users.controller.ts:154, 161, 168, 233`
**Issue:** The new consent and deletion handlers cast `req` to `any`, so the typing of `user.id` is lost. The AI controllers in the same phase use a typed cast.
**Fix:** Use an `AuthenticatedRequest` type or `(req as Request & { user: { id: string } })`.

### IN-02: AI badge relies on a user-editable tag

**File:** `frontend/lib/ai/ai-origin.ts:3-7`
**Issue:** `isAiGeneratedRecipe` infers AI origin from the "AI Generated" tag. Users can add the tag to their own recipes and see a false badge. Removing the tag hides the AI label, which weakens the store-review labelling requirement. The summary acknowledges there is no origin flag.
**Fix:** Reserve the tag server-side, or reuse the `source` column (for example `source: 'ai'`) in a future additive migration.

### IN-03: Duplicated consent rule and limiter boilerplate

**File:** `backend/src/modules/ai/require-ai-consent.ts:25`, `backend/src/modules/users/ai-consent.service.ts:29`, `backend/src/modules/users/account-deletion.limiter.ts`, `backend/src/modules/ai/ai-report.limiter.ts`
**Issue:**
- The comment in `ai-consent.service.ts` says "same rule as the gate", but the rule is implemented twice (`aiConsentAt != null && (version ?? 0) >= AI_CONSENT_VERSION`). They can drift.
- The two rate limiters are near-identical copies of the key generator and handler.
- There are two deletion endpoints, `/account` (soft) and `/me` (hard), with overlapping names.

**Fix:** Export `hasCurrentConsent(fields)` from `ai-consent.constants.ts` or the service and call it from both places. Extract a shared `createUserKeyedLimiter` helper.

### IN-04: Expected 403 INVALID_PASSWORD is logged as "Access forbidden"

**File:** `frontend/lib/api/client.ts:70-77`
**Issue:** The interceptor `console.error('Access forbidden')` fires on the routine wrong-password response. This adds noise and makes real permission errors harder to spot.
**Fix:** Skip the log for known application error codes, or log only when `getApiErrorCode(error)` is undefined.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
