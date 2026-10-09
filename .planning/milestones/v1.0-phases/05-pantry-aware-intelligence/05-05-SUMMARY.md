---
phase: 05-pantry-aware-intelligence
plan: 05
subsystem: backend-intelligence
tags: [grouping, pantry-subtract, decimal, tdd]
requires: ["05-01"]
provides:
  - "intelligence/merge-groups.ts: groupKey, groupIngredients, displayOf, withBaseTotal, IngredientLine, IngredientGroup"
  - "intelligence/pantry-subtract.ts: subtractPantry, PantryStockItem, CoveredEntry, CoveredStatus"
affects: [05-07, 05-09]
key-files:
  created:
    - backend/src/modules/intelligence/merge-groups.ts
    - backend/src/modules/intelligence/pantry-subtract.ts
    - backend/tests/intelligence-merge.test.ts
    - backend/tests/intelligence-pantry-subtract.test.ts
key-decisions:
  - "Expiry compared by UTC day number, so a lot expiring any time today counts; the clock is never read"
  - "Incompatible detection uses the first same-canonical lot in another family or count word"
requirements-completed: [INT-02, INT-03]
completed: 2026-10-09
---

# Phase 5 Plan 05: Merge and Pantry Subtraction Summary

Pure exact grouping by canonical name and unit family, plus pantry subtraction that reports full, partial and incompatible coverage. Math runs in base units on the 05-01 Decimal clone, with immutable accumulation.

## Commits
- RED test(05-05): add failing ingredient grouping tests, then GREEN feat(05-05): add exact ingredient grouping
- 5b70669 test (RED), then eec652f feat: pantry subtraction

## Verification
- 35 tests pass across both files; `tsc --noEmit` clean; lint 0 errors (148 pre-existing warnings).
- The grep acceptance checks pass: no `+=`, parseFloat or Math.round in merge-groups.ts; no clock reads in pantry-subtract.ts.
- File sizes: 86 and 120 lines.

## Deviations from Plan
- [Rule 3 - Blocking] Jest setup needs env and a database. Ran with a temporary Postgres 16 on port 5805 (migrations deployed), then stopped and removed it and its env file.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
All four files exist and the commits are in git log.
