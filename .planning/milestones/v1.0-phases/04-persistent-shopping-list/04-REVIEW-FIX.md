---
phase: 04-persistent-shopping-list
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/04-persistent-shopping-list/04-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/04-persistent-shopping-list/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (WR-01..WR-09; Info findings were out of scope except IN-01, which sat in a file already touched)
- Fixed: 9
- Skipped: 0

Gate results (run in an isolated worktree, temporary Postgres 16 on port 5713, since stopped and removed):
- Backend: `tsc --noEmit` clean, `npm run lint` 0 errors (warnings pre-existing), full Jest 40 suites / 605 tests passing.
  One earlier full run showed a single timing-based failure in `tests/food-lookup.test.ts` (outbound throttle 429 test). It passed alone, passed on the pre-fix baseline, and passed on a full re-run, so it is treated as flaky and unrelated to these changes.
- Frontend: `npm run lint` 0 errors, `npm run type-check` clean, `npm test` 22 files / 190 tests passing, `NEXT_PUBLIC_API_URL=https://x.example npx next build` succeeds.

No push was made, and nothing on Railway or Vercel was touched.

## Fixed Issues

### WR-01: Array-valued body fields bypass validation

**Files modified:** `backend/src/modules/shopping/shopping.validation.ts`, `backend/src/modules/shopping/shopping.service.ts`, `backend/tests/shopping-validation.test.ts` (new)
**Commit:** 2099f90
**Applied fix:** Added a `scalarOnly` guard (custom check plus `bail`) in front of the typed checks for itemName, quantity, unit, category, isChecked, both cents fields and notes. Arrays and objects now return 400 VALIDATION_ERROR on create and update. `toQuantity` also rejects non-finite values. Tests cover `[1,2]`, `{}`, 'NaN', 'Infinity', 1e308, '1e999', zero, over-max, and array cents. They also confirm numeric strings and null cents still work. I confirmed that 6 of the new tests fail without the fix.

### WR-02: Unauthenticated shopping traffic is exempt from every rate limiter

**Files modified:** `backend/src/middleware/rateLimiter.ts`, `backend/tests/rate-limiter.test.ts`
**Commit:** 8b122b7
**Applied fix:** The global `apiLimiter` now skips `/api/<version>/shopping` only when the request carries a bearer token that verifies (`hasValidBearerToken`). Missing or garbage tokens stay under the per-IP 100/15min limit. This is simpler than adding a second limiter, and it keeps the user's 600/15min limiter in force for valid tokens. The path pattern is now derived from `config.apiVersion`. Tests: after about 100 unauthenticated or bad-token requests (401), the next ones get 429; a valid user from the same IP is still served; the existing 105-request authenticated burst still passes; plus unit tests for the helper.

### WR-03: Generate runs ~300 sequential UPDATEs in one interactive transaction

**Files modified:** `backend/src/modules/shopping/shopping.repository.ts`, `backend/src/modules/shopping/shopping-generate.service.ts`, `backend/tests/shopping-generate.test.ts`
**Commit:** 1d75dee
**Applied fix:** New `bulkUpdateQuantities` does the whole merge in one `UPDATE ... FROM (VALUES ...)` with bound parameters (via `Prisma.join`). It is scoped to the locked list and sets `updated_at`. The transaction also gets explicit `{ maxWait: 10s, timeout: 20s }`. Test: 100 merged lines and 50 inserted lines (from a 150-ingredient plan) complete well inside a 4s budget with correct sums (1.5 + 2.25 = 3.75), bumped `updatedAt`, and another user's identically named item untouched.

### WR-04: Zero or tiny incoming quantities become 1

**Files modified:** `backend/src/modules/shopping/shopping.merge.ts`, `backend/tests/shopping-merge.test.ts`
**Commit:** e242145
**Applied fix:** Documented rule: incoming lines with a zero, negative or non-finite quantity are skipped, not coerced to 1. Tiny positive quantities still clamp to the 0.01 minimum. The existing test that encoded NaN becoming 1 was updated to the new rule. New tests cover 0, -2, NaN and Infinity, plus the zero-quantity-next-to-a-real-quantity merge.
**Note:** requires human verification as a logic-rule change. If every ingredient in a plan has quantity 0, generate now returns added 0 and merged 0 rather than an error.

### WR-05: Page replaces the whole list with an error screen when a background refetch fails

**Files modified:** `frontend/app/(app)/shopping/page.tsx`, `frontend/lib/shopping/load-state.ts` (new), `frontend/lib/shopping/load-state.test.ts` (new)
**Commit:** 6ce99d9
**Applied fix:** A pure `getShoppingLoadState` helper returns loading, error (no data), refresh-failed (data plus error) or ready. The full-screen error shows only when there is no cached list. Otherwise the list stays and an inline alert with a Retry button appears.

### WR-06: Optimistic toggles race on the server; rollback can revert the user's last tap

**Files modified:** `frontend/lib/hooks/use-shopping-list.ts`, `frontend/lib/shopping/list-cache.ts`, `frontend/lib/shopping/list-cache.test.ts`, `frontend/lib/hooks/shopping-write-order.test.ts` (new)
**Commit:** b529cf9
**Applied fix:** Update, delete and add mutations share one TanStack Query `scope` (`SHOPPING_MUTATION_SCOPE`). The optimistic cache update is still immediate, but the PATCH/POST/DELETE calls run one at a time in tap order. On error, the whole-list snapshot restore is replaced by `revertItemPatch`, which restores only the failed mutation's fields and only if no newer write changed them. A failed delete uses `restoreItem` to put the item back at its old index. Add now carries the item mutation key, so it takes part in the last-settle invalidation. Tests: pure helper tests, plus a real `MutationObserver` test that writes run FIFO even when an earlier one is slower, and that the queue continues after a failure.
**Note:** requires human verification as a logic change. Because the scope is shared, a slow request delays later taps on any item, though their optimistic UI is still instant.

### WR-07: Finish can race with in-flight check-off PATCHes

**Files modified:** `frontend/lib/hooks/use-finish-shopping.ts`, `frontend/lib/hooks/use-generate-shopping-list.ts`
**Commit:** 4da110b
**Applied fix:** Finish and generate use the same mutation scope as the item writes, so Finish is sent only after every earlier check-off or price edit has reached the server, and the saved total matches the sheet. The server already computes the total under the list lock. Both `onSuccess` handlers now `cancelQueries` before `setQueryData`. The queue-order guarantee is covered by the scope test added under WR-06. The hook wiring itself has no React-level test, because vitest here runs in a node environment.
**Note:** requires human verification as a logic change. If a queued earlier write fails after the user confirms, the saved total can differ from what the sheet showed; the user gets the existing error toast for that write.

### WR-08: Undo can double-POST; failed add loses the typed name

**Files modified:** `frontend/app/(app)/shopping/page.tsx`, `frontend/components/shopping/quick-add.tsx`, `frontend/lib/shopping/item-input.ts`, `frontend/lib/shopping/item-input.test.ts`
**Commit:** e587abe
**Applied fix:** The Undo click handler is guarded by a per-toast `undone` flag. QuickAdd now clears the name only on success (via `nameAfterAddSuccess`, which keeps anything the user typed meanwhile), and ignores re-submits and disables Add while a request is in flight. The page uses `mutateAsync` for quick-add so an Undo re-add on the same mutation observer cannot swallow its callbacks.

### WR-09: Accessible names omit the visible text

**Files modified:** `frontend/components/shopping/shopping-item-row.tsx`, `frontend/lib/shopping/a11y.ts` (new), `frontend/lib/shopping/a11y.test.ts` (new)
**Commit:** 95f037a
**Applied fix:** The price chip's accessible name now starts with its visible text ("Add price for Milk" or "$3.50 for Milk"). Checkbox labels are stable and state-independent: the normal row uses the item name, and the large row drops `aria-label` so the name comes from its visible text, with `aria-checked` carrying state. The large row now also shows the estimated price (when no actual price is set), matching the normal row.

### IN-01 (trivial, same file as WR-02 area): Stray validators on the generate route

**Files modified:** `backend/src/modules/shopping/shopping.routes.ts`
**Commit:** b660bdf
**Applied fix:** `/generate` now chains only `validateGenerate` and `validate`.

## Skipped Issues

None. IN-02 through IN-05 were out of scope and were not attempted.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
