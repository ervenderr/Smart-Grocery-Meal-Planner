---
phase: 06-capture-loops
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - backend/prisma/schema.prisma
  - backend/src/app.ts
  - backend/src/modules/cook/cook.constants.ts
  - backend/src/modules/cook/cook.controller.ts
  - backend/src/modules/cook/cook.plan.ts
  - backend/src/modules/cook/cook.routes.ts
  - backend/src/modules/cook/cook.service.ts
  - backend/src/modules/cook/cook.target.ts
  - backend/src/modules/cook/cook.validation.ts
  - backend/src/modules/mealplan/mealplan.cooked.ts
  - backend/src/modules/mealplan/mealplan.format.ts
  - backend/src/modules/mealplan/mealplan.service.ts
  - backend/src/modules/pantry/pantry.controller.ts
  - backend/src/modules/pantry/pantry.service.ts
  - backend/src/modules/pantry/pantry.validation.ts
  - backend/src/modules/shopping/shopping-finish.service.ts
  - backend/src/modules/shopping/shopping-pantry.service.ts
  - backend/src/modules/shopping/shopping-pantry.ts
  - backend/src/modules/shopping/shopping.controller.ts
  - backend/src/modules/shopping/shopping.validation.ts
  - frontend/components/cook/cooked-it-sheet.tsx
  - frontend/components/pantry/scan/scan-sheet.tsx
  - frontend/components/pantry/scan/manual-barcode-form.tsx
  - frontend/components/pantry/barcode-field.tsx
  - frontend/components/pantry/expiry-sheet.tsx
  - frontend/lib/api/cook.ts
  - frontend/lib/api/pantry.ts
  - frontend/lib/cook/preview.ts
  - frontend/lib/hooks/use-debounced-quantity.ts
  - frontend/lib/hooks/use-finish-shopping.ts
  - frontend/lib/hooks/use-pantry.ts
  - frontend/lib/pantry/expiry.ts
  - frontend/lib/pantry/quantity.ts
  - frontend/lib/scan/barcode.ts
  - frontend/lib/scan/camera.ts
  - frontend/lib/scan/prefill.ts
  - frontend/lib/scan/resolve-barcode.ts
  - frontend/lib/scan/use-barcode-scanner.ts
  - frontend/lib/shopping/finish-toast.ts
  - scripts/smoke-prod.sh
findings:
  critical: 0
  warning: 8
  info: 4
  total: 12
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 62 changed files in scope (core logic read in full; presentational components and test files skimmed)
**Status:** issues_found

## Summary

No security blockers found. Ownership checks are present on every id: cook recipe/meal resolution, the meal-cooked marker (`mealPlan.userId` in the `updateMany` where clause), pantry lot reads (`userId` scoped), and the merge `updateMany` (`id` + `userId`). Barcode input is validated server-side (`^\d{8,14}$`) on create, update and the list query. No secrets were introduced. The smoke script uses env/args only.

The once-only guard is correct: a conditional `updateMany` inside the same transaction as the deductions, so a replay or concurrent double apply gets 409 and a failed deduction rolls the marker back. FEFO and unit-family handling in `cook.plan.ts` are sound.

The main defects are cross-module effects of allowing quantity 0 ("used up"). Others are lost-update windows, stale-preview apply, and a discarded debounced edit.

## Structural Findings (fallow)

Not provided for this review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Used-up (quantity 0) pantry items still drive expiry alerts, notifications and cook-first

**File:** `backend/src/modules/notification/notification.generator.ts:36,172`, `backend/src/modules/alert/alert.service.ts:305`, `backend/src/modules/zapier/zapier.scheduler.ts:126,235`, `backend/src/modules/intelligence/cook-first.service.ts:49`, `backend/src/modules/pantry/pantry.service.ts:337`
**Issue:** This phase made `quantity = 0` a legal state (PATCH min 0, "Used up" badge, cook deduction floors at 0). Only `shopping-generate.service.ts` filters `quantity: { gt: 0 }`. Every other consumer still selects `deletedAt: null` rows only, so an item the user marked as used up (or that cooking exhausted) keeps producing "expiring soon" and "expired" notifications and alerts, Zapier events, and "cook this first" suggestions for food that no longer exists. Cook's own `usableLots` excludes qty 0, so cook and cook-first now disagree.
**Fix:** Add `quantity: { gt: 0 }` to each of those `where` clauses. Put it in a shared helper, e.g. `const IN_STOCK = { deletedAt: null, quantity: { gt: 0 } } as const`.

### WR-02: Bought-it merge can merge into a used-up lot and inherit its stale expiry

**File:** `backend/src/modules/shopping/shopping-pantry.ts:116-123,150-163`
**Issue:** `toWorkingLot` only drops lots with unparseable quantity or past expiry. A qty-0 lot with a future expiry date (for example the milk that was used up, expiring in 3 days) is a valid merge target. `step` picks the earliest-expiry lot of the same key, so fresh milk is merged into the empty lot and keeps its 3-day expiry, which the CONTEXT decision ("keep target's expiry") never intended. The stock then shows as expiring soon and, after WR-01, triggers alerts. The smoke test (14c) only passes because it clears the expiry first.
**Fix:** Treat qty <= 0 lots as non-targets for merging. Skip them in `toWorkingLot` (`qty === null || qty.lte(0)`), or when merging into one, reset `expiryDate` to null. The first option is simpler and creates a fresh lot.

### WR-03: Pantry merge after finish is non-atomic and not retryable

**File:** `backend/src/modules/shopping/shopping.controller.ts:76-108`, `backend/src/modules/shopping/shopping-pantry.service.ts:21-49`
**Issue:** `finishShopping` commits, then `applyPantryMerge` runs separately. The list is already completed and the checked items are gone from the active list, so if the merge fails (or the process dies between the two steps) the user has no way to redo it. The response is `failed: true` and the toast says "add the items manually". Failure is logged, which is good, but the checked items are only returned to the caller in memory, so the data is lost for retry.
**Fix:** Either run the merge inside the finish transaction (pass `tx`, since the plan is pure), or persist a pending flag on the history row and expose a retry endpoint. The first is a small change: have `applyPantryMerge` accept a client and call it inside `finishShopping` when `addToPantry` is set.

### WR-04: Cook/merge write absolute quantities computed from a stale read (lost updates)

**File:** `backend/src/modules/cook/cook.service.ts:60-85`, `backend/src/modules/shopping/shopping-pantry.service.ts:31-47`
**Issue:** Both paths read lots, compute the new quantity in JS, then write `quantity = <absolute>`. Under Postgres READ COMMITTED a concurrent quick-edit PATCH (the stepper debounces and fires frequently) or a second cook between the read and write is silently overwritten. In `applyCook` the once-only guard covers meals, but recipe-only applies have no guard at all, and two parallel applies both read the same quantities and write the same result (the second deduction is lost, not double-applied). In the merge, the read is outside the transaction altogether.
**Fix:** Lock rows with `SELECT ... FOR UPDATE` on the user's lots at the start of the transaction (same technique as `findActiveListIdForUpdate`). Alternatively use relative updates (`decrement`, `increment`) for single-lot cases. At minimum, move the merge read inside its transaction.

### WR-05: Cooked-it applies deductions from a stale preview while servings are changing

**File:** `frontend/components/cook/cooked-it-sheet.tsx:116-125,150-156,305-311`
**Issue:** Servings are debounced 300 ms, and the preview uses `placeholderData: keepPreviousData` with `staleTime: 0`. While the new preview is loading, `data` is still the old servings' preview, the stepper shows the new servings, and "Apply deductions" is enabled (only `applying` and `showLoading` gate it, and `isPending` is false when placeholder data exists). Apply sends `editableRows` from the old preview, so the user can deduct amounts for a different serving count than the one displayed. The apply payload does not include servings, so the server cannot detect it.
**Fix:** Disable Apply while `preview.isPlaceholderData || preview.isFetching || servings !== debounced`.

### WR-06: Debounced quantity edit is silently dropped on unmount, and out-of-order writes are possible

**File:** `frontend/lib/hooks/use-debounced-quantity.ts:34-36,40-58`
**Issue:** `useEffect(() => clear, [])` cancels the pending timer on unmount, but `pending.current` is never flushed. A user who taps "+" and navigates away or filters the list within 400 ms loses the edit with no feedback. Also, a second change while the first PATCH is in flight sends a second PATCH without ordering; if the first response arrives late it can be applied last on the server. The `.catch(() => undefined)` is fine only because the caller toasts and rolls back (the pantry page does).
**Fix:** On unmount, if `pending.current !== null`, call `commitRef.current(pending.current)` before clearing. Serialize commits per item (chain the next commit onto the in-flight promise).

### WR-07: Camera hook leaves status stale when deactivated and can race on unmount

**File:** `frontend/lib/scan/use-barcode-scanner.ts:128-190`
**Issue:** When `active` goes false (or the tab becomes hidden), the effect cleanup releases the stream, but `status` stays `'scanning'` and `torchAvailable` / `slowHint` stay set, because only `stop()` resets them. On return from background (`visible` true again) the UI shows `scanning` with a blank frame until `start()` sets `requesting`. Within `start`, after `await video.play()` and `await createDetector()` the code checks `cancelled` and returns, which is fine for the tracks (cleanup stops `streamRef`). But `createDetector` can dynamically import the ponyfill WASM after unmount, wasting work and leaving a detector. Stream tracks are stopped correctly in all paths I traced (cancel before stream, after stream, on detect, on failure).
**Fix:** In the effect cleanup, reset UI state (`setStatus('idle')`, torch, slow hint) when the cleanup is not caused by a re-run, or set `status` to `'requesting'` at the top of the visible-again path (already done) and `'idle'` in cleanup. Low urgency since the tracks are released.

### WR-08: Meal plan edit rebuilds items non-atomically and loses the cooked marker on any failure

**File:** `backend/src/modules/mealplan/mealplan.service.ts:364-378`
**Issue:** `findMany`, `deleteMany` and the later `mealPlan.update` (with nested create) are separate statements with no transaction. If the update fails after `deleteMany` (validation, DB error), all meal items and their `cookedAt` markers are gone. A cook apply landing between the `findMany` and `deleteMany` also gets lost. Because `cookedAt` is the once-only guard, losing it permits a second deduction for the same meal. Also, editing a cooked meal's day or type drops the marker (matching is by recipe+day+type), which lets the user re-cook it.
**Fix:** Wrap the read, delete and update in `prisma.$transaction`. Consider carrying `cookedAt` by item id when the client sends it, rather than by triple.

## Info

### IN-01: Client-chosen deduction amounts are not tied to the recipe

**File:** `backend/src/modules/cook/cook.service.ts:60-85`, `backend/src/modules/cook/cook.validation.ts:70-95`
**Issue:** `apply` trusts `deductions[].key/use` entirely; the recipe is only validated for existence. A user can deduct any of their own lots up to the held amount (clamped), up to 100 keys. This is limited to the caller's own data, so it is not a vulnerability, but the recipe-only path can also be replayed freely (no idempotency key), so a network retry double-deducts.
**Fix:** Optional: accept an `Idempotency-Key` header, or recompute the plan server-side and cap `use` at the plan row's `use`.

### IN-02: Sequential per-lot updates inside an interactive transaction

**File:** `backend/src/modules/cook/cook.service.ts:72-76`
**Issue:** Up to 100 deductions times several lots, each an awaited `update`, inside the default 5 s interactive transaction timeout, on a remote DB. A large cook can time out with an opaque 500 and roll back. The 2000-row read cap also silently truncates (used-up lots now accumulate and count toward it).
**Fix:** Raise the `timeout` option on `$transaction`, or batch with one raw `UPDATE ... FROM (VALUES ...)`. Exclude `quantity = 0` rows from the read.

### IN-03: Barcode normalization exists only in the client

**File:** `frontend/lib/scan/barcode.ts:6-9`, `backend/src/modules/pantry/pantry.validation.ts:13`
**Issue:** The client pads 12-digit UPC-A to 13 digits so repeat scans match. The server accepts any 8-14 digits as-is, so an API/Zapier caller storing the 12-digit form will never match a later scan. Also, `code_128` is a scan format and any 8-14 digit Code 128 value (order numbers, etc.) is accepted as a product barcode.
**Fix:** Normalize in the server (`pantry.service` create/update/list filter) with the same rule. Drop `code_128` from `SCAN_FORMATS` unless a use case needs it.

### IN-04: Minor quality items

**File:** `backend/src/modules/cook/cook.controller.ts:11`, `backend/src/modules/cook/cook.validation.ts:6`, `backend/src/modules/shopping/shopping-pantry.service.ts:11`
**Issue:** `(req as any).user.id` bypasses typing. `cook.validation.ts` duplicates the `validate` middleware found in other modules and uses double-quote style inconsistent with the sibling cook files. The `utcMidnight` helper is copied in three places (cook.service, shopping-pantry.service, shopping-finish.service). `PANTRY_MERGE_READ_CAP` truncation is silent, so beyond 2000 lots the merge may create duplicate rows.
**Fix:** Use the typed request, import a shared `validate` and `utcMidnight`, and log when the read cap is hit (as `shopping-generate.service.ts` does).

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
