---
phase: 06-capture-loops
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/06-capture-loops/06-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 7
skipped: 2
status: partial
---

# Phase 6: Code Review Fix Report

**Source review:** `.planning/phases/06-capture-loops/06-REVIEW.md`
**Scope:** WR-01..WR-08, plus IN-01 only if small.
**Gates after all fixes:** backend jest (60 suites, 1106 tests), tsc, lint (0 errors); frontend vitest (487 tests), tsc, eslint (0 errors), `next build`; `prisma migrate diff --exit-code` reports no difference. No migrations added.

## Fixed Issues

### WR-01: Used-up pantry items drove alerts, notifications, cook-first
**Commit:** 195c622
**Files:** `backend/src/modules/pantry/pantry.stock.ts` (new `IN_STOCK` fragment), `notification.generator.ts`, `alert.service.ts`, `zapier.scheduler.ts`, `cook-first.service.ts`, `pantry.service.ts` (stats expiry counts), `tests/alert.test.ts`.
Expiry alerts, notifications, Zapier events and cook-first now filter `quantity > 0`. The pantry list is unchanged, so used-up items stay visible. Pantry stats keep `totalItems` and the category counts, but the expiring and expired counts ignore qty 0.

### WR-02: Bought-it merge inherited a used-up lot's stale expiry
**Commit:** e6b2941
**Files:** `shopping-pantry.ts`, `shopping-pantry.service.ts`, `tests/shopping-pantry.test.ts`.
Used-up lots are still valid merge targets, so smoke check 14c still holds. Merging into one now clears its expiry. In-stock lots are preferred over used-up ones. Chosen over the "skip qty 0 lots" option because it keeps the existing used-up-lot reuse behaviour and the smoke contract.

### WR-04: Lost updates in cook apply and bought-it merge
**Commit:** 17f1931
**Files:** `pantry/pantry.lock.ts` (new, `SELECT ... FOR UPDATE` ordered by id), `cook.service.ts`, `shopping-pantry.service.ts`, `tests/cook-endpoints.test.ts`.
Cook apply locks the user's lots before reading. The merge's read, plan and write now run in one interactive transaction under the same lock. A new concurrency test (two parallel applies on one lot) fails without the lock and passes with it.

### WR-05: Cooked-it Apply enabled against a stale preview
**Commit:** 66e7eac
**Files:** `lib/cook/preview.ts` (`isPreviewStale`), `components/cook/cooked-it-sheet.tsx`, `lib/cook/preview.test.ts`.
Apply is disabled and `submit` is guarded while servings are debouncing, the preview is placeholder data, or it is fetching.

### WR-06: Debounced quantity dropped on unmount, unordered writes
**Commit:** 14ad15c
**Files:** `lib/hooks/debounced-commit.ts` (new, framework-free), `debounced-commit.test.ts`, `use-debounced-quantity.ts`.
Logic is extracted so it can be tested without a DOM (the project has no React testing library). A pending edit is flushed on unmount, and commits for an item run in order.

### WR-07: Scanner left stale UI state when deactivated
**Commit:** beee6b0
**Files:** `lib/scan/use-barcode-scanner.ts`.
The effect cleanup resets status (a `failed` status is kept), torch and slow hint. No automated test: the hook needs a DOM and camera mocks that the project does not have. Verified by type-check and lint only. The dynamic detector import after unmount was left alone (the reviewer rated it low urgency, and tracks are already released).

### WR-08: Meal plan edit rebuilt items non-atomically
**Commit:** 0fa65b2
**Files:** `mealplan.service.ts`, `tests/mealplan-cooked.test.ts`.
The item read, delete and plan update now run in one `$transaction`, with the existing items locked `FOR UPDATE` so a concurrent cook marker is not lost. A new test forces the update to fail and asserts the items and `cookedAt` survive. The test fails without the fix.

## Skipped Issues

### WR-03: Pantry merge after finish is non-atomic and not retryable
**Reason:** needs a design change. Running the merge inside the finish transaction would make a pantry failure undo the finish. That contradicts the locked behaviour (`pantry.failed` in the response, "a pantry failure must never undo it") that the frontend toast depends on. The alternative, a persisted pending flag plus a retry endpoint, needs a schema migration and new UI. The WR-04 change does remove the part that was cheap to fix: the merge's read and write are now one transaction.

### IN-01: Client-chosen deduction amounts not tied to the recipe
**Reason:** the bounds and validation the review asked about already exist: at most 100 deductions, unique keys, key and unit length limits, `use` between 0 and 99999, and all lots scoped to the caller. Capping `use` at the server-computed plan needs the servings value, which the apply payload does not carry. An idempotency key needs a new header contract and storage. Both are beyond a small fix.

### IN-02, IN-03, IN-04
Out of scope per instructions.

## Notes

- Work was done in the main working tree, not a separate git worktree, because the backend tests need the repo's `node_modules`. The tree was clean when I started, and each commit staged only its own files.
- Integration tests ran against a throwaway local Postgres 16, which has been stopped and removed.

_Fixer: Claude (gsd-code-fixer)_
