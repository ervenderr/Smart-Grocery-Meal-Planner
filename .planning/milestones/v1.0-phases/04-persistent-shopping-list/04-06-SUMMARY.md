---
phase: 04-persistent-shopping-list
plan: 06
subsystem: api
tags: [express, prisma, shopping, mealplan]
requires: ["04-04"]
provides:
  - "POST /api/v1/shopping/generate -> { list, added, merged }"
  - "aggregateIngredients (pure), mergeKey/mergeIntoItems (pure)"
affects: [04-08, 04-11]
key-files:
  created:
    - backend/src/modules/mealplan/mealplan.aggregate.ts
    - backend/src/modules/shopping/shopping.merge.ts
    - backend/src/modules/shopping/shopping-generate.service.ts
    - backend/tests/mealplan-aggregate.test.ts
    - backend/tests/shopping-merge.test.ts
    - backend/tests/shopping-generate.test.ts
  modified:
    - backend/src/modules/mealplan/mealplan.service.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.routes.ts
key-decisions:
  - "Aggregation stores first-seen name/unit instead of re-deriving from the map key, fixing ':' truncation"
  - "Merge only absorbs into UNCHECKED items; duplicates and sums use integer hundredths, clamped to 0.01..99999"
  - "Meal plan aggregation runs outside the transaction (scoped by userId); merge, cap check and writes run inside one transaction under the list FOR UPDATE lock"
requirements-completed: [SHOP-03]
completed: 2026-10-09
---

# Phase 4 Plan 06: Generate list from meal plan Summary

Meal plan ingredients are merged atomically into the saved active list, with the ":" name truncation bug fixed in a pure, tested aggregation module.

## Commits
- `test(04-06)` aggregate tests, `55901ac` fix: extract aggregateIngredients (mealplan.service.ts 842 -> 805 lines)
- `0a434e3` test, `bb0ed26` feat: pure merge
- `3901773` test, `c41827d` feat: POST /shopping/generate

## Verification
Full backend suite: 37 suites, 539 tests pass. `tsc --noEmit` clean. Lint: 0 errors (145 existing warnings).

## Deviations from Plan
**1. [Rule 3 - Blocking] Recipe API restricts units.** The recipes endpoint only accepts PantryUnit values, so generate tests create recipes via the API and then set free-text ingredientsList ("clove", "Pieces", "Salt: coarse") directly with Prisma (mirrors AI/legacy recipes).
**2. [Rule 1 - Bug] Own mistake caught by the suite:** a scripted route edit briefly added validateGenerate to POST /items; shopping-items tests caught it and it was removed before the feat commit.

Note: test commits were made before implementation existed (RED = module not found / 404); GREEN verified afterwards.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (T-04-23..26 mitigated: scoped lookup, update ids from the locked list, cap checked before writes, single locked transaction).

## Housekeeping
Temporary Postgres (port 5706) stopped and removed. Nothing pushed; STATE/ROADMAP/REQUIREMENTS untouched.

## Self-Check: PASSED
