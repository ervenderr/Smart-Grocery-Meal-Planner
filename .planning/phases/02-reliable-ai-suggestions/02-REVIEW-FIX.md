---
phase: 02-reliable-ai-suggestions
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/02-reliable-ai-suggestions/02-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/02-reliable-ai-suggestions/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 14 (CR-01, CR-02, WR-01..WR-12)
- Fixed: 14
- Skipped: 0

Verification: backend jest 28 suites / 419 tests pass against a temporary Postgres 16 (removed afterwards); backend `tsc --noEmit` clean; backend lint 0 errors; frontend lint 0 errors, type-check clean, `next build` succeeds. The `next build` was run in the main checkout after the fast-forward, because Turbopack cannot resolve a symlinked `node_modules` inside the temporary worktree.

## Fixed Issues

### CR-01: Dietary filter fails open
**Files modified:** `backend/src/modules/ai/dietary-filter.ts`, `backend/tests/dietary-filter.test.ts`
**Commit:** 946e06b
**Applied fix:** Restriction keys are canonicalised (`_`, spaces, `-` unified) before lookup, so `gluten_free`, `gluten free` and `gluten-free` match. Added synonym keys (nut allergy, celiac, lactose intolerant, etc.). Unknown restrictions now forbid the restriction text itself plus its tokens. Tests cover every frontend value (vegetarian, vegan, gluten_free, dairy_free, nut_free, halal, kosher). Logic fix, requires human verification of the term lists.

### CR-02: 8-14 day meal plans never validate
**Files modified:** `backend/src/modules/ai/features/meal-plan.ts`, `backend/tests/ai-meal-plan.test.ts`
**Commit:** cbe4e4a
**Applied fix:** `day` allows 0..13, `meals` max is 70, and a schema factory rejects meals with `day >= daysCount`. The prompt no longer says 0-6. `MEAL_PLAN_SCHEMA_VERSION` is bumped to 2 so old cached plans are not reused. Requires human verification (logic).

### WR-01 / WR-02: Cache read/write failures
**Files modified:** `ai-cache.repository.ts` (new `getCachedSafe` / `setCachedSafe`), `ai.orchestrator.ts`, `food.service.ts`, `errorHandler.ts`, tests
**Commit:** c3b8ca7
**Applied fix:** Cache read errors become a miss and write errors are logged with a warning; the computed result is still returned (food not-found stays 404). Prisma known-request errors other than P2002 (400) and P2025 (404) now map to 500. Note: this commit also contains the WR-03 `errorHandler` edits, because the file was staged whole; the WR-03 commit carries the test file.

### WR-03: errorHandler leaks messages
**Files modified:** `backend/src/middleware/errorHandler.ts`, `backend/tests/error-handler.test.ts`
**Commit:** ed9a4fe
**Applied fix:** Unexpected errors return "Internal server error" in production. AppError `details` are spread first so they cannot overwrite `status`, `statusCode`, `message`, `code` or `error`.

### WR-04 / WR-05: Nutrition query escaping and food rate limit
**Files modified:** `food.validation.ts`, `rateLimiter.ts`, `food.routes.ts`, `tests/food-lookup.test.ts`
**Commit:** fea6e29
**Applied fix:** `.escape()` replaced by a sanitizer (strip control characters, collapse whitespace, trim) that runs before the 2-80 length check. New `foodBurstLimiter` (20 requests per minute per user, code `FOOD_RATE_LIMITED`) on all food routes. The food test file now creates a fresh user per test so the limiter does not leak across tests.

### WR-06: Global daily quota abuse
**Files modified:** `env.schema.ts`, `ai-quota.repository.ts`, `ai.orchestrator.ts`, tests
**Commit:** 45c0016
**Applied fix (least invasive):** Per-user defaults are unchanged. Added `.max()` bounds on the env limits (user 1000, global 100000), and a warning log when global usage reaches 80% of the cap (`isGlobalCapNear`). Email verification or new-account limits are not added (product decision; documented as a residual risk).

### WR-07: Repair prompt and total deadline
**Files modified:** `ai.orchestrator.ts`, `ai.deps.ts`, `llm-provider.ts`, `openai-compatible.provider.ts`, `tests/ai-orchestrator-repair.test.ts`
**Commit:** 5df5f95
**Applied fix:** The repair echo strips `<think>` blocks and keeps the tail. One deadline (`AI_TIMEOUT_MS`, exposed as `totalTimeoutMs` in deps) covers both calls: the second call gets only the remaining time, and is skipped when under 3s remain. A body-read timeout is now classified as `timeout`.

### WR-09 / WR-10: Image URL and USDA energy
**Files modified:** `off.client.ts`, `food.service.ts`, `usda.client.ts`, tests
**Commit:** ecceb31
**Applied fix:** `safeImageUrl` accepts only https URLs on `openfoodfacts.org` or its subdomains, with no credentials; anything else becomes null. USDA energy now reads `unitName`, prefers 208/957/958 (kcal), converts kJ by 4.184, and ignores name matches with an unknown unit.

### WR-11 / WR-12: Coercion, refresh and empty caching
**Files modified:** `ai.validation.ts`, `ai.controller.ts`, `ai.orchestrator.ts`, the three feature files, `frontend/lib/api/ai.ts`, `frontend/components/ai/ai-recipe-suggestions-modal.tsx`, tests
**Commit:** bd369e0
**Applied fix:** Validators add `.toInt()`, `.toFloat()` and `.toBoolean()`. New optional `refresh` flag on all three AI endpoints bypasses the cache read, still consumes quota, and overwrites the cache entry. The "Generate New Suggestions" button sends `refresh: true`. Empty substitution lists are not cached.

### WR-08: extractJson locks onto the first bracket
**Files modified:** `backend/src/modules/ai/json-extract.ts`, `backend/src/modules/ai/ai.orchestrator.ts`, `backend/tests/ai-json-extract.test.ts`
**Commit:** 8ad4b37
**Applied fix:** `extractJson` now tries every `{`/`[` start index until one balances and parses. Fence stripping was removed (fences are prose outside JSON), so backticks inside JSON strings survive. New optional `{ prefer: 'object' }` argument tries object starts first; the orchestrator passes it. Default behavior (first parseable value) is unchanged. Logic fix, requires human verification. All 10 ai test suites (100 tests), tsc and lint pass.

## Skipped Issues

None of the requested findings were skipped.

Not in scope or not attempted:
- WR-05 sub-suggestions not applied: GTIN checksum validation (the existing tests use random digit barcodes) and `pruneSometimes` from food writes. The per-user limiter was applied.
- WR-06: no email-verification or account-age gate.
- Info findings IN-01..IN-08 were skipped by instruction.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
