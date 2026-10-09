---
phase: 06-capture-loops
plan: 04
subsystem: api
tags: [shopping, pantry, bought-it, merge, express, prisma]
requires:
  - phase: 05-intelligence
    provides: canonicalName, resolveUnit, familyKey, toBase/fromBase
provides:
  - "POST /shopping/finish accepts addToPantry and returns pantry { added, merged, failed }"
  - "Pure planPantryMerge + toPantryUnit"
  - "applyPantryMerge service (own transaction, after finish commit)"
affects: [06-07 finish-sheet toggle]
key-files:
  created:
    - backend/src/modules/shopping/shopping-pantry.ts
    - backend/src/modules/shopping/shopping-pantry.service.ts
    - backend/tests/shopping-pantry.test.ts
    - backend/tests/shopping-finish-pantry.test.ts
  modified:
    - backend/src/modules/shopping/shopping-finish.service.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/types/shopping.types.ts
decisions:
  - "finishShopping now returns an internal FinishShoppingOutcome { result, checkedItems, receiptDate }; the controller sends only result (+pantry)."
  - "merged counts checked lines merged into pre-existing lots; same-trip duplicates collapse into one created row (counted in added once)."
  - "Price for created rows = actualCostCents ?? costEstimateCents ?? null."
  - "Merge keeps the target lot's expiry (locked CONTEXT decision)."
metrics:
  tasks: 2
  completed: 2026-10-09
---

# Phase 6 Plan 04: Bought-it pantry merge Summary

Finishing a shopping trip with `addToPantry: true` now merges checked items into non-expired same-name, same-unit-family pantry lots or creates new rows with valid PantryUnits, without ever rolling back the finish.

## Commits
- 45bfd6b test: failing planner tests
- 8d15fe8 feat: merge planner
- 2cc8d8c test: failing finish tests
- 92595cd feat: finish integration

## Verification
TESTENV (port 5548, stopped afterwards): planner (34), finish-pantry and finish suites pass; full backend suite 57 suites / 1059 tests green; tsc clean; lint 0 errors. `applyPantryMerge` is not referenced in shopping-finish.service.ts.

## Deviations from Plan
None of substance. Added an internal `FinishShoppingOutcome` type (the plan allowed either approach). Count units other than pieces (can, bunch) become pieces with a note "Bought as N can".

## Known Stubs
None.

## Self-Check: PASSED
