---
phase: 04-persistent-shopping-list
plan: 02
subsystem: frontend
tags: [shopping, vitest, tdd, pure-helpers]
requires: []
provides:
  - lib/shopping vocab (categories, units, limits, normalizeCategory, unitLabel)
  - groupItems (category grouping, checked sink)
  - computeTotals (integer-cent estimated/actual/difference)
  - parseItemPriceInput, parseQuantityInput (strict parsing)
affects: [04-04, shopping UI]
tech-stack:
  added: []
  patterns: [pure immutable helpers, strict regex parsing]
key-files:
  created:
    - frontend/lib/shopping/vocab.ts
    - frontend/lib/shopping/vocab.test.ts
    - frontend/lib/shopping/grouping.ts
    - frontend/lib/shopping/grouping.test.ts
    - frontend/lib/shopping/totals.ts
    - frontend/lib/shopping/totals.test.ts
    - frontend/lib/shopping/item-input.ts
    - frontend/lib/shopping/item-input.test.ts
key-decisions:
  - "unitLabel returns free-text units as-is; pickers offer only the 12 enum units"
  - "Category and unit labels copied from the pantry modal"
requirements-completed: [SHOP-02, SHOP-04, SHOP-05]
duration: ~10 min
completed: 2026-10-09
---

# Phase 4 Plan 02: Shopping Pure Helpers Summary

Four tested pure modules in `frontend/lib/shopping` (vocabulary aligned to backend enums, category grouping with checked items sinking, integer-cent totals, strict price and quantity parsing).

## Commits
- 0de8c92 test: failing vocab/grouping tests (RED)
- ebe94a0 feat: vocab and grouping (GREEN)
- f5538ce test: failing totals/item-input tests (RED)
- 09b1128 feat: totals and item-input (GREEN)

## Deviations from Plan
None. Plan executed as written. A transient type error appeared in another plan's `lib/shopping/list-cache.ts` (04-03) during a mid-run type-check; it was gone on rerun.

## Verification
lint 0 errors, type-check clean, `npm test` 16 files / 157 tests pass, `next build` succeeds.

## TDD Gate Compliance
RED (test) commits precede GREEN (feat) commits for both tasks.

## Known Stubs
None.

## Self-Check: PASSED
