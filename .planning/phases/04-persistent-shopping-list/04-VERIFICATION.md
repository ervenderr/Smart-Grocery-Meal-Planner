---
phase: 04-persistent-shopping-list
verified: 2026-10-09T00:00:00Z
status: human_needed
score: 5/5 roadmap truths verified (automated); 1 deferred human check pending
overrides_applied: 0
human_verification:
  - test: "Plan 04-12: real-phone shopping mode and cross-device check"
    expected: "On a physical phone the screen stays awake in shopping mode, check rows are comfortably tappable, and a list created on one device appears intact on another after reload"
    why_human: "Screen Wake Lock behavior, touch ergonomics and cross-device sync cannot be verified by grep or unit tests. Deferred by the user."
deferred:
  - truth: "Pantry subtraction and unit conversion when generating lists"
    addressed_in: "Phase 5"
    evidence: "Phase 5 success criteria 2 and 3 (merge with unit conversion; lists leave out what the pantry covers)"
  - truth: "Checking off an item can add it to the pantry"
    addressed_in: "Phase 6"
    evidence: "Phase 6 success criterion 3 (bought it)"
---

# Phase 4: Persistent Shopping List Verification Report

**Phase Goal:** Users keep real shopping lists that survive reloads and device changes and are easy to use in the store
**Status:** human_needed (all automated truths pass; only the deferred real-phone check 04-12 remains)
**Re-verification:** No, initial verification

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User creates a list, reloads or switches device, finds it intact | VERIFIED | `ShoppingService.getActiveList` lazily creates and returns a DB-backed list (`shopping.service.ts`, `shopping.repository.ts` `ensureActiveListId` + `loadListDto`). One-active-list invariant enforced by partial unique index in `20261011000000_shopping_active_list_unique` (dedupe by completing, never deleting; `ON CONFLICT (user_id) WHERE ...` insert matches the index). Frontend `useShoppingList` reads from the API (refetchOnWindowFocus for second device). Smoke 12a-12i passed on production. |
| 2 | Add, edit, remove, check off items manually; check-offs persist | VERIFIED | POST/PATCH/DELETE `/shopping/items` wired route to controller to service. PATCH whitelists 8 fields (`buildItemData`). Frontend `useUpdateShoppingItem` / `useDeleteShoppingItem` do optimistic update with rollback in `onError` and last-settle invalidation; add uses server response. |
| 3 | Generate a list from a meal plan and it is saved | VERIFIED | `POST /shopping/generate` -> `generateFromMealPlan` loads plan scoped by `userId`, merges into the persisted active list in a transaction, sets `mealPlanId` on an empty list. Aggregation fix in `mealplan.aggregate.ts` (scales by item servings / recipe servings, keyed by name+unit, rounds to 2 dp). "Add to my list" button present on `app/(app)/mealplans/page.tsx` and via `GenerateFromPlan` on the shopping page, both using `useGenerateShoppingList`. |
| 4 | Items grouped by store category; shopping mode keeps screen awake with large check targets | VERIFIED (automated) / human for device behavior | `groupItems` + `CategorySection` render groups; `inferCategory` assigns categories server-side. `useWakeLock(shoppingMode)` uses `createWakeLockController` (re-acquires on visibilitychange, silent fallback, released on stop). Row uses `min-h-14` (56px) with `large` prop in shopping mode. Real-device behavior pending (see Human Verification). |
| 5 | User sees estimated vs actual spend | VERIFIED | `SummaryBar` + `lib/shopping/totals.ts` (integer cents; actual vs estimates of only items with actuals). Finish writes history total = sum over CHECKED items of `actual ?? estimate ?? 0`, clamped (`shopping.totals.ts`); `GET /shopping/history` and `ShoppingHistory` show past trips. |

**Score:** 5/5 truths verified in code

## Locked-decision / constraint checks

| Check | Status | Evidence |
|-------|--------|----------|
| Ownership / IDOR on every item route | VERIFIED | PATCH/DELETE go through `findOwnedItemForUpdate`: locks caller's own active list, then `findFirst` with `id`, `shoppingListId`, and `shoppingList: {userId, isCompleted:false, deletedAt:null}`; miss yields 404 `SHOPPING_ITEM_NOT_FOUND` (no 403 leak). POST uses caller's own list. Generate checks plan `userId`. History filtered by `userId`. All routes behind `authenticate`. `:itemId` validated as UUID. |
| 300-item cap | VERIFIED | `MAX_ITEMS_PER_LIST = 300`; enforced in `addItem` and in generate (rows + inserts), code `SHOPPING_LIST_FULL`. |
| Cents bounds | VERIFIED | `costEstimateCents`/`actualCostCents` `isInt` 0..200,000,000; history total clamped to 2,000,000,000 (int4-safe); quantity 0.01..99999. |
| History total rule | VERIFIED | `computeHistoryTotals`: checked items only, `actual ?? estimate ?? 0`. Used at finish and when reading history. |
| Merge only into unchecked | VERIFIED | `mergeIntoItems` builds its match map only from `!item.isChecked`; checked items never absorb quantities (new row inserted instead). |
| `SHOPPING_LIST_NOTHING_CHECKED` | VERIFIED | Thrown 400 in `finishShopping` when `checkedCount === 0`; code defined in constants. Empty list gives `SHOPPING_LIST_EMPTY`. |
| Carry/discard on finish | VERIFIED | Unchecked items copied to the new active list on `carry` (actual cleared), skipped on `discard`; done in one transaction with history row. |
| Per-user rate limiter | VERIFIED | `shoppingLimiter` (600 / 15 min) keyed by user id with IPv6-safe fallback, applied via `router.use` after `authenticate`; 429 code `SHOPPING_RATE_LIMITED`. Routes mounted at `/api/v1/shopping` in `app.ts`. |
| No sessionStorage list left | VERIFIED | Only remaining sessionStorage references: `page.tsx` removes legacy key `current-shopping-list`; `auth-store.ts` (auth, pre-existing); `client.ts` calls `clearUserSessionState`. |
| `clearUserSessionState` still clears key | VERIFIED | `USER_SCOPED_STORAGE_KEYS = ['current-shopping-list']` cleared from session and local stores, errors tolerated. |
| No new packages | VERIFIED | No commit touching `package.json` or lockfiles in Phase 4; last changes are Phase 3 (`d0aace8`, `7b51843`, `a3bbe04`). |
| SQL safety | VERIFIED | Raw SQL uses tagged templates only (`$queryRaw`/`$executeRaw`), no `*Unsafe`. |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SHOP-01 backend-stored lists surviving reload/device | SATISFIED | Truth 1; partial unique index migration; lazy GET; production smoke passed. |
| SHOP-02 add/edit/remove/check off, persisted | SATISFIED | Truth 2; item routes with validation, ownership and optimistic rollback hooks. |
| SHOP-03 generate from meal plan, saved as list | SATISFIED | Truth 3; generate service + fixed aggregation + UI entry points on both pages. |
| SHOP-04 category grouping + shopping mode (wake lock, large targets) | SATISFIED in code; device behavior needs human | Truth 4; real-phone check 04-12 deferred. |
| SHOP-05 estimated vs actual spend | SATISFIED | Truth 5; summary bar, finish sheet, history. |

No orphaned requirements: SHOP-01..05 are the only Phase 4 IDs in REQUIREMENTS.md.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production API up | `curl https://kitcha-api-production.up.railway.app/health` | `{"status":"ok",...}` | PASS |
| CI on main for shopping smoke commit | `gh run list` | `test(04-11): add shopping smoke check 12` completed success; later docs-only run in progress | PASS |
| Frontend unit tests (shopping + auth) | `npx vitest run lib/shopping lib/auth` | 9 files, 61 tests passed | PASS |
| Backend shopping tests | `npx jest shopping ...` locally | SKIPPED: suites fail at env parsing (`tests/setup.ts` -> `env.schema.ts`) because no local env is configured; not run to avoid reading or printing env values. Backend tests are covered by the green CI run on main. | SKIP |
| Production authenticated flow | smoke 12a-12i | Passed per user (not re-run; authenticated calls out of scope) | Accepted |

## Anti-Patterns

Scan of backend shopping module, `mealplan.aggregate.ts`, frontend shopping components, lib, hooks and page for TBD/FIXME/XXX/TODO: none found. No stub handlers or hardcoded empty data flowing to render; list data comes from the API query.

Info only (not blockers):
- `POST /shopping/generate` also applies `validateFinish` and `validateHistory` chains (optional `carryOver`/`receiptDate`/`page`/`limit`); harmless but unnecessary coupling. Cosmetic cleanup candidate.

## Deferred Items

| Item | Addressed In | Evidence |
|------|--------------|----------|
| Pantry subtraction and unit conversion | Phase 5 | Phase 5 SC 2 and 3 |
| Bought-it -> pantry | Phase 6 | Phase 6 SC 3 |

## Human Verification Required

### 1. Real-phone shopping mode and cross-device check (plan 04-12, deferred by user)

**Test:** On a physical phone open Shopping, enable shopping mode, leave the screen idle, tap check rows with one hand; create/edit a list on one device and reload on a second device.
**Expected:** Screen stays awake while in shopping mode; 56px rows are easy to hit; the list and check-offs appear intact on the other device.
**Why human:** Wake Lock behavior, touch ergonomics and real multi-device sync cannot be verified from the codebase.

## Gaps Summary

No gaps. Every roadmap success criterion and locked constraint is backed by code that exists, is substantive, and is wired end to end (route -> controller -> service -> DB; hooks -> API client -> page). The phase is marked `human_needed` solely because the real-phone check (04-12) was deferred by the user.

---

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_
