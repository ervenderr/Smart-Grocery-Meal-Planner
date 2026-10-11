---
phase: 11-offline-core
plan: 07
subsystem: offline-read-cache
tags: [react-query, filters, tdd]
requires: [11-04]
provides: [fetchAllPages, filterPantryItems, filterRecipes, useRecipesList, useMealPlansList]
key-files:
  created:
    - frontend/lib/api/fetch-all-pages.ts
    - frontend/lib/pantry/filter-list.ts
    - frontend/lib/recipes/filter-recipes.ts
    - frontend/lib/hooks/use-recipes.ts
    - frontend/lib/hooks/use-meal-plans.ts
  modified:
    - frontend/lib/hooks/use-pantry.ts
    - frontend/app/(app)/recipes/page.tsx
    - frontend/app/(app)/mealplans/page.tsx
    - frontend/app/(app)/dashboard/page.tsx
decisions:
  - Recipe search mirrors the server (name + description); sort mirrors the server including the page's existing sortOrder 'desc' behavior
  - "Use expiring first" stays an online cook-first fetch held in local state; all other recipe views read the canonical key
  - Recipes grid slices the filtered list to 50, the same count the server page returned before
  - Dashboard pantry count and expiring-soon still use the API (plan only moved recipes and meal plans)
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 07: Canonical-key reads Summary

Pantry, recipes, meal plans and dashboard counts now read full lists from React Query canonical keys (`PANTRY_ALL_KEY`, `RECIPES_ALL_KEY`, `MEAL_PLANS_ALL_KEY`) with in-memory filtering, so the persisted cache can serve them offline.

## Verification
- New tests: 15 passing (fetch-all-pages 4, filter-list 5, filter-recipes 6)
- Full vitest: 1287 tests; the only failure on the first run was `lib/rules/rank.bench.test.ts` (timing gate, 1073ms under concurrent load); it passes when run alone (2/2)
- Lint: 0 errors. Web `next build`: passes (a first attempt failed on `lib/offline/transport.test.ts` type errors from a concurrent plan's WIP; passed on retry)
- `tsc --noEmit` clean for this plan's files (remaining errors were only in the concurrent plan's transport.test.ts)
- Acceptance greps: `recipeApi.getAll` 0 in recipes page, `mealPlanApi.getAll` 0 in mealplans and dashboard, `normalizeItem = ` 0 in use-pantry

## Deviations from Plan
- RED/GREEN committed together for Task 1 (tests written first, one commit).
- Meal plan list items already carry `meals`, so no hook reshaping was needed.

## Known Stubs
None.

## Self-Check: PASSED
