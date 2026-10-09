---
phase: 04-persistent-shopping-list
plan: 09
subsystem: frontend
tags: [shopping, spend-tracking, finish-trip, history]
requires: [04-03, 04-07]
provides:
  - computeTripTotal, describeDifference, localIsoDate
  - useFinishShopping, useShoppingHistory
  - SummaryBar, FinishSheet, ShoppingHistory
key-files:
  created:
    - frontend/lib/shopping/trip.ts
    - frontend/lib/shopping/trip.test.ts
    - frontend/lib/hooks/use-finish-shopping.ts
    - frontend/components/shopping/summary-bar.tsx
    - frontend/components/shopping/finish-sheet.tsx
    - frontend/components/shopping/shopping-history.tsx
  modified:
    - frontend/app/(app)/shopping/page.tsx
requirements: [SHOP-05]
completed: 2026-10-09
---

# Phase 4 Plan 09: Spend summary, finish and past trips Summary

Shopping page now has a sticky estimated-vs-actual bar (Under by / Over by in text), a Finish shopping sheet (keep-unchecked default, or discard; sends the local YYYY-MM-DD receiptDate), and a collapsed "Past trips" list with pagination.

## Commits
- test(04-09): add failing tests for trip helpers
- feat(04-09): add trip total helpers and finish hooks
- feat(04-09): add spend summary, finish sheet and past trips

## Decisions
- The nothing-checked hint text and id are exported from finish-sheet.tsx and reused by the summary bar, so the string lives in one place.
- Summary bar sticks at `bottom-[calc(4rem+env(safe-area-inset-bottom))]` below lg (main scrolls behind the fixed BottomNav) and `bottom-0` at lg.
- History query only runs once the section is expanded.
- Success toast "Trip saved: {total}" is raised from the page's mutate-level onSuccess; errors toast from the hook.

## Deviations
None. Executed as written.

## Verification
lint 0 errors (warnings pre-existing), type-check clean, vitest 166/166, `next build` succeeds, static grep empty, page.tsx 206 lines. Not exercised against a live backend (04-08 concurrent); coded against the shoppingApi contract. Sticky offset not checked on a device.

## Known Stubs
None.

## Self-Check: PASSED
