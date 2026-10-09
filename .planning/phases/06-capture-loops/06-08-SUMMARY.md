---
phase: 06-capture-loops
plan: 08
subsystem: backend-cook-mealplan
tags: [cook, mealplan, prisma-migration, once-only-guard]
requires: [06-03, 06-06]
provides:
  - meal_plan_items.cooked_at (additive migration)
  - MealPlanItemResponse.cookedAt, carryCookedAt, formatMealPlan
  - /cook/preview and /cook/apply accept mealPlanItemId (409 ALREADY_COOKED)
affects: [06-10]
key-files:
  created:
    - backend/prisma/migrations/20261013010000_meal_plan_cooked_at/migration.sql
    - backend/src/modules/mealplan/mealplan.cooked.ts
    - backend/src/modules/mealplan/mealplan.format.ts
    - backend/src/modules/cook/cook.target.ts
    - backend/tests/mealplan-cooked.test.ts
    - backend/tests/cook-mealplan.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/modules/mealplan/mealplan.service.ts
    - backend/src/modules/cook/cook.service.ts
    - backend/src/modules/cook/cook.validation.ts
    - backend/src/types/mealplan.types.ts
    - backend/src/types/cook.types.ts
decisions:
  - "Once-only marker is set first inside the apply transaction via updateMany where cookedAt null; count 0 re-reads to pick 404 vs 409; later failures roll it back"
  - "carryCookedAt prefers cooked entries within duplicate triples so a cooked meal is never lost"
metrics:
  tasks: 3
  tests: "full backend suite 60 suites / 1101 tests green"
  coverage: "cook module 96-100% lines; mealplan.cooked.ts 100%"
completed: 2026-10-09
---

# Phase 6 Plan 08: Cooked-it for planned meals (API) Summary

Meal-plan items can be cooked exactly once through `/cook/preview` and `/cook/apply` with `mealPlanItemId`, using a race-safe conditional marker; `cookedAt` is exposed on meals and carried across plan edits.

## Commits
- 85c8f33 feat: meal plan cooked_at migration
- test: failing meal plan cookedAt tests (RED)
- a3cc408 feat: expose and preserve meal cookedAt
- test: failing meal-plan cook tests (RED)
- 32b640a feat: cook a planned meal once

## Migration proof (TESTENV, port 5547, shadow DB)
- Applied all prior migrations with the new folder moved out, inserted user/recipe/meal_plan/meal_plan_items rows, moved the folder back, `prisma migrate deploy` succeeded.
- `select id, cooked_at from meal_plan_items` -> `i1 | (null)` (row survived, cooked_at NULL).
- `prisma migrate diff --from-migrations ... --exit-code` -> "No difference detected", exit 0. Test rows deleted.
- SQL is exactly `ALTER TABLE "meal_plan_items" ADD COLUMN "cooked_at" TIMESTAMP(3);`; destructive-keyword grep count 0; no applied migration modified.

## Verification
- Full backend suite 60 suites / 1101 tests pass; tsc clean; lint 0 errors.
- Coverage (lines): cook.service 100, cook.plan 100, cook.target 95.45, cook.validation 100, mealplan.cooked 100, mealplan.format 100.
- mealplan.service.ts reduced from 805 to 775 lines; `private formatMealPlan` removed.
- Concurrency test: two simultaneous applies yield exactly one 200 and one 409, single deduction.

## Deviations from Plan
- **[Rule 1 - test bug] ** Initial GREEN run failed two tests because FEFO draws from the oldest Eggs lot across tests; assertions changed to the user's total pantry quantity. No source change.
- cook.validation.ts was reformatted by prettier while adding the one-of check (larger diff than the logic change).

## Known Stubs
None.

## Self-Check: PASSED
