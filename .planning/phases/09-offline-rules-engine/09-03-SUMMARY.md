---
phase: 09-offline-rules-engine
plan: 03
subsystem: rules-engine
tags: [ranking, pantry-index, staples, vitest, jest, offline]
requires:
  - phase: 09-01
    provides: units, diet, types
provides:
  - buildPantryIndex / pantryHas / MAX_PANTRY_ITEMS
  - rankRecipes with exported scoring constants
  - DEFAULT_STAPLE_NAMES mirror + resolveStapleSet, parity-locked by fixture
affects: [09-04, 09-05, 09-06]
key-files:
  created:
    - frontend/lib/rules/staples-default.ts
    - frontend/lib/rules/staples-default.test.ts
    - frontend/lib/rules/pantry-index.ts
    - frontend/lib/rules/pantry-index.test.ts
    - frontend/lib/rules/match.ts
    - frontend/lib/rules/rank.ts
    - frontend/lib/rules/rank.test.ts
    - backend/tests/fixtures/default-staples.json
    - backend/tests/rules-parity-staples.test.ts
key-decisions:
  - "unitMismatch: full coverage credit, not counted missing; have shown in the pantry's own unit (kg/grams, liters/ml, count label)"
  - "Partial ingredients go in the `missing` list (missingCount = missing + partial); have list = have, staple, unitMismatch"
  - "Empty recipes (0 ingredients) always sort after every recipe with ingredients and are never readyToCook"
  - "totalRecipes = recipes considered after the 500 cap (items + hiddenByDiet + hiddenByReady)"
requirements-completed: [OFF-08]
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 9 Plan 03: Ranking Engine Summary

Pure offline `rankRecipes` (quantity-aware coverage with unit-family conversion, expiring-soon boost 5/3/1 x 4 points, 6-point missing penalty, deterministic tie-break chain) plus a pantry index and a fixture-locked staples default.

## Task Commits
1. Task 1: 143f93e (tests), ecdeab3 (staples-default + pantry-index)
2. Task 2: tests commit then feat commit (see git log: `test(09-03): add rankRecipes behavior tests`, `feat(09-03): add rankRecipes ...`)

## Test Results
- vitest `lib/rules`: 8 files, 190 tests passed
- jest `rules-parity-staples`: 1 passed (run with DATABASE_URL/JWT_SECRET/NODE_ENV=test)
- tsc: no errors in new files; engine files contain no Date.now, new Date(), fetch, localStorage, Intl, localeCompare or console calls

## Deviations from Plan
- Per-ingredient resolution was split into `frontend/lib/rules/match.ts` (the plan allowed this); rank.ts is 133 lines, match.ts 167.
- TDD: implementation for Task 2 was written before the first test run, so the RED run was not observed for rank (Task 1 RED was observed). Test commits still precede feat commits.

## Known Stubs
None.

## Self-Check: PASSED
