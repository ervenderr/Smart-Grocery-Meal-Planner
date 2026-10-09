---
phase: 05-pantry-aware-intelligence
plan: 09
subsystem: backend-shopping
tags: [generate, pantry-subtract, staples, unit-aware-update, tdd]
requires: ["05-04", "05-05", "05-07"]
provides:
  - "POST /shopping/generate returns {list, added, merged, covered, skippedStaples, pantryCapped}"
  - "shopping.repository.ts bulkUpdateItems (quantity + unit, one bound statement)"
  - "shopping-generate.service.ts: PANTRY_COMPARE_CAP, isPantryCapped"
affects: [05-11, 05-12]
key-files:
  modified:
    - backend/src/modules/shopping/shopping.repository.ts
    - backend/src/modules/shopping/shopping-generate.service.ts
    - backend/src/types/shopping.types.ts
    - backend/tests/shopping-generate.test.ts
  created:
    - backend/tests/intelligence-generate.test.ts
requirements-completed: [INT-02, INT-03, INT-04]
completed: 2026-10-09
---

# Phase 5 Plan 09: Pantry-Aware Generate Pipeline Summary

Generate now aggregates the plan exactly, drops staples (canonical match), subtracts non-expired same-family pantry stock, and merges the remainder into the active list with unit-aware updates, returning an additive response.

## Commits
- f7bda67 feat(05-09): bulk update list items with unit
- 68df598 test(05-09): add failing pantry-aware generate tests (RED: missing isPantryCapped export)
- 782da2e feat(05-09): subtract pantry and skip staples when generating lists

## Behavior
- Pipeline: loadPlanGroups (404 MEAL_PLAN_NOT_FOUND, MEAL_PLAN_EMPTY only when ingredientCount is 0) -> staples + pantry read in parallel (pantry ordered by expiryDate then createdAt, take 2000) -> filterStaples -> subtractPantry (UTC midnight computed once) -> mergeIntoItems.
- Pantry cap: when the read returns 2000 rows, a warning is logged (userId and cap only) and `pantryCapped: true` is returned; `isPantryCapped(rowCount, cap)` is exported and tested.
- Fully covered plan: 200, added 0, merged 0, covered non-empty.
- Phase 4 lock, 300 cap before writes, single transaction and 20s timeout unchanged. Service is 131 lines, no MealPlanService dependency.
- Merge updates persist the converted unit (500 grams + 1 kg row becomes 1.5 kg).

## Phase 4 test changes
- tests/shopping-generate.test.ts: users a, b, c get `stapleNames: []` in beforeAll (`// Phase 5:` comment). No assertion changed.

## Verification
- Private Postgres 16 (port 5809): full backend suite `npm test -- --ci`: 51 suites, 934 tests, all passing (includes everything 05-07 changed).
- tsc clean; lint 0 errors (new warnings are `any` in test helper rows, matching the existing test style).
- No Unsafe raw queries in the shopping module; `bulkUpdateQuantities` has no remaining references.

## Deviations
None. Temp Postgres, data dir and env file were stopped and removed.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
