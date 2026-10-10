---
phase: 08-offline-sync-backend
plan: 03
subsystem: shopping
tags: [finish-trip, offline, transactions, pantry-merge]
requires: []
provides:
  - shopping.receipt-window (withinReceiptWindow, clampOccurredAt, utcDateOf)
  - applyPantryMergeInTx(tx, userId, checked, purchaseDate)
  - finishShopping(userId, options) accepting occurredAt and addToPantry
affects: [08-05]
key-files:
  created:
    - backend/src/modules/shopping/shopping.receipt-window.ts
    - backend/tests/shopping-receipt-window.test.ts
  modified:
    - backend/src/modules/shopping/shopping-finish.service.ts
    - backend/src/modules/shopping/shopping-pantry.service.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/src/types/shopping.types.ts
    - backend/tests/shopping-finish.test.ts
    - backend/tests/shopping-finish-pantry.test.ts
key-decisions:
  - "Future occurredAt is clamped to now (not rejected); older than 14 days clamps to now-14d"
  - "applyPantryMerge wrapper removed (no other callers)"
requirements-completed: [SYNC-05]
completed: 2026-10-10
---

# Phase 8 Plan 03: Offline-safe Finish Trip Summary

Finish accepts `occurredAt` (strict ISO-8601, clamped to [now-14d, now]) and a 14-days-back / 1-day-ahead receipt window, and the bought-it pantry merge now commits atomically in the finish transaction.

## Commits

- 2792b1b: receipt-window util, occurredAt validation, boundary tests
- 82f2ad0: merge in finish tx, occurredAt honored, controller simplified, tests updated

## Behavior change

A pantry merge failure now fails the whole finish (HTTP 500, no history row, list stays active). Previously the finish returned 200 with `pantry.failed: true`. The `pantry` response key keeps `{ added, merged, failed }`, with `failed` always false. Frontend code that handles `failed: true` is now dead but harmless.

## Details

- Lock order documented in the service: shopping list row lock, then pantry lock. Finish tx timeout 15 s.
- receiptDate defaults to the UTC date of the clamped occurredAt.
- `withinOneDayOfUtcToday` removed; validation no longer imports from the service.

## Verification

- jest (finish, finish-pantry, shopping-pantry, shopping, receipt-window, validation): 122 passed.
- `tsc --noEmit`: exit 0.

## Deviations from Plan

None.

## Self-Check: PASSED
