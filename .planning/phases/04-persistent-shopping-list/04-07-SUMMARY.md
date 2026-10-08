---
phase: 04-persistent-shopping-list
plan: 07
subsystem: frontend
tags: [shopping, meal-plans, react-query]
requires: [04-03, 04-05]
provides:
  - describeGenerateResult
  - useGenerateShoppingList
  - GenerateFromPlan section
key-files:
  created:
    - frontend/lib/shopping/generate-summary.ts
    - frontend/lib/shopping/generate-summary.test.ts
    - frontend/lib/hooks/use-generate-shopping-list.ts
    - frontend/components/shopping/generate-from-plan.tsx
  modified:
    - frontend/app/(app)/shopping/page.tsx
    - frontend/app/(app)/mealplans/page.tsx
requirements: [SHOP-03]
completed: 2026-10-09
---

# Phase 4 Plan 07: Generate from meal plan (frontend) Summary

Users can add a meal plan's ingredients to the saved list from the Shopping page ("Add from a meal plan") and from the Meal Plans ingredient preview ("Add to my list"). The mutation writes the merged list into the cache and toasts added/merged counts. Server error messages are shown on failure.

## Commits
- test(04-07): add failing tests for generate summary
- feat(04-07): add generate-from-meal-plan hook
- feat(04-07): add meal plan to shopping list from both pages

## Decisions
- Per-plan "Adding..." label uses mutation `variables`; all Add buttons disable while any generate is pending (double-tap guard, T-04-28).
- The plans query only runs once the section is expanded.
- The old "Shopping list generated!" toast on preview load was removed, since the preview is read-only and the new hook toasts on the real save.

## Deviations
None. Executed as written.

## Verification
lint 0 errors (warnings pre-existing), type-check clean, vitest 161/161, `next build` succeeds, static grep on generate-from-plan.tsx empty, "Shopping List Generated" and sessionStorage absent from the touched files. Not exercised against a live endpoint (04-06 concurrent); coded against the shoppingApi contract.

## Known Stubs
None.

## Self-Check: PASSED
