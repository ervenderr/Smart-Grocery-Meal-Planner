---
phase: 04-persistent-shopping-list
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - backend/prisma/migrations/20261011000000_shopping_active_list_unique/migration.sql
  - backend/src/app.ts
  - backend/src/middleware/rateLimiter.ts
  - backend/src/modules/mealplan/mealplan.aggregate.ts
  - backend/src/modules/mealplan/mealplan.service.ts
  - backend/src/modules/shopping/shopping-finish.service.ts
  - backend/src/modules/shopping/shopping-generate.service.ts
  - backend/src/modules/shopping/shopping.category.ts
  - backend/src/modules/shopping/shopping.constants.ts
  - backend/src/modules/shopping/shopping.controller.ts
  - backend/src/modules/shopping/shopping.dto.ts
  - backend/src/modules/shopping/shopping.merge.ts
  - backend/src/modules/shopping/shopping.repository.ts
  - backend/src/modules/shopping/shopping.routes.ts
  - backend/src/modules/shopping/shopping.service.ts
  - backend/src/modules/shopping/shopping.totals.ts
  - backend/src/modules/shopping/shopping.units.ts
  - backend/src/modules/shopping/shopping.validation.ts
  - frontend/app/(app)/shopping/page.tsx
  - frontend/app/(app)/mealplans/page.tsx
  - frontend/components/shopping/aisle-price-input.tsx
  - frontend/components/shopping/category-section.tsx
  - frontend/components/shopping/finish-sheet.tsx
  - frontend/components/shopping/generate-from-plan.tsx
  - frontend/components/shopping/item-edit-sheet.tsx
  - frontend/components/shopping/quick-add.tsx
  - frontend/components/shopping/shopping-history.tsx
  - frontend/components/shopping/shopping-item-row.tsx
  - frontend/components/shopping/shopping-mode-toggle.tsx
  - frontend/components/shopping/summary-bar.tsx
  - frontend/lib/api/shopping.ts
  - frontend/lib/constants/api-routes.ts
  - frontend/lib/react-query.ts
  - frontend/lib/hooks/use-finish-shopping.ts
  - frontend/lib/hooks/use-generate-shopping-list.ts
  - frontend/lib/hooks/use-shopping-list.ts
  - frontend/lib/hooks/use-wake-lock.ts
  - frontend/lib/shopping/generate-summary.ts
  - frontend/lib/shopping/grouping.ts
  - frontend/lib/shopping/item-input.ts
  - frontend/lib/shopping/list-cache.ts
  - frontend/lib/shopping/totals.ts
  - frontend/lib/shopping/trip.ts
  - frontend/lib/shopping/vocab.ts
  - frontend/lib/shopping/wake-lock.ts
  - scripts/smoke-prod.sh
findings:
  critical: 0
  warning: 9
  info: 5
  total: 14
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 52 listed in frontmatter (shopping.types.ts, shopping.category.ts, vocab.ts, and some small components were skimmed only)
**Status:** issues_found

## Summary

The backend core is solid. Every id route is scoped to the caller's active, non-deleted list under a row lock, so an item on a finished list returns 404. Raw SQL uses tagged templates only. The DTO whitelist blocks mass assignment. The lock order is consistent (list row first, then items), and the retry loop is bounded to 2 attempts. Double-finish resolves to a 400 SHOPPING_LIST_EMPTY. The 300-item cap is checked under the list lock in both add and generate.

I found no critical issues. The real defects are:

- A validation bypass: array-valued body fields are accepted.
- A rate-limit gap for unauthenticated shopping traffic.
- A likely transaction-timeout risk in generate.
- Several client-side optimistic-update and race problems.

### Structural Findings (fallow)

None provided.

## Warnings

### WR-01: Array-valued body fields bypass validation (quantity, costEstimateCents, actualCostCents, unit, category)

**File:** `backend/src/modules/shopping/shopping.validation.ts:68-88` (consumed at `shopping.service.ts:41,48`)
**Issue:** I ran express-validator 7.3.0 with `{quantity:[1,2], costEstimateCents:[5]}`. It validates each array element, so these arrays pass validation. `matchedData` then returns the arrays.
- `quantity: [1,2]` reaches `toQuantity`, where `[1,2]*100` is `NaN`. That produces `new Decimal(NaN)`, so the request is either a 500 from Prisma or, if the Decimal is accepted, a `NaN` quantity persisted in a numeric column. A stored NaN would then serialise as `null` through `toNumber()` and `JSON.stringify`, and it would poison later merges (`NaN` sums). I did not verify how Prisma and Postgres handle Decimal NaN.
- `costEstimateCents: [5]` reaches Prisma as an array and throws a 500.
- This only hurts the caller's own list, but it is an input-validation hole on a public boundary.

**Fix:** Reject non-scalars before the typed checks.
```ts
const scalar = (v: unknown) => v === null || typeof v !== 'object';
body('quantity').optional().custom(scalar).withMessage('quantity must be a number').bail()
  .isFloat({ min: MIN_QUANTITY, max: MAX_QUANTITY }).toFloat(),
// same for costEstimateCents, actualCostCents, unit, category, isChecked
```
Also add `if (!Number.isFinite(q)) throw` in `toQuantity`. Using `{ onlyFirstError: true }` plus an explicit `isArray` negative check also works.

### WR-02: Unauthenticated shopping traffic is exempt from every rate limiter

**File:** `backend/src/middleware/rateLimiter.ts:36-49`, `backend/src/modules/shopping/shopping.routes.ts:23-24`
**Issue:** `apiLimiter` now skips all `/api/v1/shopping*` URLs. In the router, `authenticate` runs before `shoppingLimiter`. A caller with no token or a garbage token gets a 401 from `authenticate` and never reaches either limiter. This opens an unlimited JWT-verify and 401 flood surface on this prefix, which the other API routes (still under `apiLimiter`) do not have.
**Fix:** Register `shoppingLimiter` before `authenticate`, using the IP fallback key when `req.user` is absent. Alternatively, make the `apiLimiter` skip apply only when an Authorization header is present. Also derive the path from `config.apiVersion` instead of hard-coding `v1` in `SHOPPING_PATH_PATTERN`.

### WR-03: Generate runs up to ~300 sequential UPDATEs in one interactive transaction (default 5s timeout)

**File:** `backend/src/modules/shopping/shopping-generate.service.ts:63-68`
**Issue:** `for (const u of plan.updates) await tx.shoppingListItem.update(...)`. On a large list merged against a large plan, this loop plus the row lock can exceed Prisma's default interactive transaction timeout (5s, P2028). The user would then get a 500 on a legitimate request. The lock is held for the whole time, so the user's other taps queue behind it.
**Fix:** Batch the updates with one raw `UPDATE ... FROM (VALUES ...)` using tagged-template parameters (or `Prisma.join`). Alternatively, pass `{ timeout: 15000 }` to `$transaction`, and also map P2028 to a retryable 503.

### WR-04: Zero or tiny incoming quantities become 1; no-op generates silently report success

**File:** `backend/src/modules/shopping/shopping.merge.ts:50-53`
**Issue:** `toHundredths` treats `q <= 0` as `1` (`safe = ... q > 0 ? q : 1`). `readIngredient` in `mealplan.aggregate.ts` explicitly allows `quantity: 0` (for example "salt, 0 tsp"). Such an ingredient is added to the list with quantity 1, or it adds 1 to an existing line. Values below 0.005 clamp to 0.01, which is inconsistent with the zero case.
**Fix:** Drop zero or non-finite quantities in `clean()` (return `null`), or default them explicitly to `MIN_QUANTITY`. Do not turn them into 1.

### WR-05: Page replaces the whole list with an error screen when a background refetch fails

**File:** `frontend/app/(app)/shopping/page.tsx:117` (with `use-shopping-list.ts:28-31`)
**Issue:** `if (isError)` is checked ahead of the data. `refetchOnWindowFocus: true` is set deliberately for in-store use. In TanStack Query v5, a failed refetch sets `isError` even when `data` exists. A spotty-signal focus refetch therefore blows away a list the user is actively checking off, and unmounts the open sheets and wake lock.
**Fix:** `if (isError && !list)` for the full-page error. Otherwise keep rendering the list and show a small "Couldn't refresh" banner.

### WR-06: Optimistic toggles race on the server; rollback and invalidation can revert the user's last tap

**File:** `frontend/lib/hooks/use-shopping-list.ts:36-76`
**Issue:**
- (a) Rapid toggles of one item send concurrent PATCHes. The server serialises them on the row lock, but the order is not guaranteed to match tap order. The final server state can differ from the UI, and the post-settle invalidation then flips the checkbox back to the server's value.
- (b) `onError` restores the `previous` snapshot captured at that mutation's `onMutate`. If an earlier mutation fails while a later one is in flight, the restore drops the later mutation's optimistic change (flicker or lost UI state until the final invalidate).
- (c) `useAddShoppingItem`, generate and finish are not keyed `SHOPPING_ITEM_MUTATION_KEY`, so they neither count toward nor wait on the settle logic.

**Fix:** Serialise per-item mutations by using `scope: { id: itemId }` on the mutation (v5.x). On error, invalidate instead of restoring a stale snapshot, or roll back only the failed field.

### WR-07: Finish can race with in-flight check-off PATCHes and compute a different total than the UI showed

**File:** `frontend/app/(app)/shopping/page.tsx:63-70`, `frontend/lib/hooks/use-finish-shopping.ts:15-17`
**Issue:** `FinishSheet` shows totals from the optimistic cache. The finish POST can be sent while a just-tapped PATCH (check or price) is still in flight. The server may lock the list first and finish without it. The history row would then record a lower total, or "Check off at least one item" would be returned. Item PATCHes that arrive after the finish get a 404 and show a toast, and the optimistic state is rolled back.
**Fix:** Disable the confirm button while `queryClient.isMutating({ mutationKey: SHOPPING_ITEM_MUTATION_KEY }) > 0`, or `await queryClient.getMutationCache().resumePausedMutations()` / await in-flight mutations before POSTing. Also `cancelQueries` before `setQueryData` in the finish and generate `onSuccess` handlers.

### WR-08: Undo can double-POST and loses ordering; failed add loses the typed name

**File:** `frontend/app/(app)/shopping/page.tsx:78-92`, `frontend/components/shopping/quick-add.tsx:47-52`
**Issue:**
- The Undo button calls `toast.dismiss` and then `addItem.mutate`. It has no guard, so a fast double-tap before the toast unmounts creates the item twice (new ids, so there is no dedupe). The 300-cap makes the second POST fail with a confusing toast when the list is near full.
- Undo re-creates the item with a new id and `createdAt`, so it moves to the end of its group.
- `QuickAdd` calls `setName('')` immediately after `onAdd`, before the POST resolves. If the POST fails, for example because the list is full or the rate limit is hit, the user's typed text is gone.

**Fix:** Guard Undo with a ref or by disabling after the first click. Clear the quick-add field in the mutation's `onSuccess`, or restore it on error.

### WR-09: Price chip and large-row checkbox have accessible names that omit the visible text (WCAG 2.5.3 Label in Name)

**File:** `frontend/components/shopping/shopping-item-row.tsx:54-62, 80-85`
**Issue:**
- The price chip's visible text is "Add price" or a formatted amount, but `aria-label="Set actual price for X"` replaces it. Voice-control users saying "click Add price" fail to match.
- The checkbox is a `role="checkbox"` button whose `aria-label` also encodes state ("Mark X as not bought") while `aria-checked` already conveys it. Screen readers announce contradictory text, for example "Mark X as not bought, checked".
- In large mode, the estimated price is never shown, unlike the normal row.

**Fix:** Use a state-independent label (`aria-label={item.itemName}` or just the visible text) for the checkbox. Make the chip's accessible name start with its visible text: `aria-label={\`${chipText} for ${item.itemName}\`}`.

## Info

### IN-01: Stray validators on the generate route

**File:** `backend/src/modules/shopping/shopping.routes.ts:84-86`
**Issue:** `/generate` chains `validateFinish` and `validateHistory`. They are unrelated to generate. They are harmless, but they reject a generate request with a bad `carryOver`/`receiptDate`/`page` that it never uses.
**Fix:** Keep only `validateGenerate`.

### IN-02: `GET /list` takes an exclusive row lock on every call

**File:** `backend/src/modules/shopping/shopping.service.ts:67-71`, `shopping.repository.ts:35-48`
**Issue:** `getActiveList` uses `ensureActiveListId`, which does `SELECT ... FOR UPDATE` plus an INSERT attempt each time. With `refetchOnWindowFocus` and multiple devices, reads serialise with writes (PATCH, finish). This is not a correctness bug, but it adds avoidable contention and WAL writes.
**Fix:** Do a plain SELECT first and fall back to `ensureActiveListId` only when no row is found.

### IN-03: `history.itemCount` counts carried-over unchecked items

**File:** `backend/src/modules/shopping/shopping.totals.ts:24-31`
**Issue:** `itemCount` is `items.length`, including unchecked items that were copied to the new list under 'carry'. The history row displays "N items" for a trip where fewer were bought, and the carried items are counted again on the next trip.
**Fix:** Return `checkedCount` for history, or label it "items on list".

### IN-04: Meal-plan preview behaviour change and leftover edits

**File:** `backend/src/modules/mealplan/mealplan.aggregate.ts:63-72`, `frontend/app/(app)/mealplans/page.tsx:90-92`
**Issue:**
- The aggregate now returns ingredient names in original case. The old code returned lowercased names, so the existing meal-plan preview display changes.
- The key now lowercases the unit but returns the first-seen raw unit.
- A line with only trailing whitespace was left where `toast.success` was removed (line 91).
- A stray extra blank line was added in `api-routes.ts`.

**Fix:** Confirm the casing change is intended, and remove the whitespace-only lines.

### IN-05: Minor frontend hygiene

**File:** `frontend/lib/hooks/use-wake-lock.ts:30`, `frontend/components/shopping/aisle-price-input.tsx:56-62`
**Issue:**
- `useWakeLock` never resets `supported`, and it calls `setSupported` from a promise that can resolve after unmount (harmless in React 18, but noisy).
- `AislePriceInput.isSaving` is never passed, so the Save button is never disabled during a save.
- `AislePriceInput` does not return focus to the chip on close.
- `ItemEditSheet` diffs the patch against a stale `editing` snapshot instead of the live cache item.

**Fix:** Guard state updates with a cancelled flag. Derive the edited item from the cache by id. Restore focus to the trigger on close.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
