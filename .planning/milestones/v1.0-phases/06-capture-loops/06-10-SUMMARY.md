---
phase: 06-capture-loops
plan: 10
subsystem: frontend-cook
tags: [cook, pantry, mealplan, react-query, sheet]
requires: [06-01, 06-03, 06-08]
provides:
  - cookApi.preview / cookApi.apply and cook types
  - lib/cook/preview.ts pure helpers (clampUse, leftFor, toDeductions, deductionCount, cookSuccessToast)
  - CookedItSheet (recipeId or mealPlanItemId)
  - "Cooked it" entry points on recipe detail and planned meals, Cooked badge
requirements-completed: [CAP-04]
key-files:
  created:
    - frontend/types/cook.types.ts
    - frontend/lib/api/cook.ts
    - frontend/lib/cook/preview.ts
    - frontend/lib/cook/preview.test.ts
    - frontend/components/cook/cooked-it-sheet.tsx
    - frontend/components/cook/cook-preview-rows.tsx
    - frontend/components/cook/cook-notes.tsx
  modified:
    - frontend/lib/constants/api-routes.ts
    - frontend/types/mealplan.types.ts
    - frontend/components/recipes/recipe-detail-modal.tsx
    - frontend/components/mealplans/meal-plan-detail-modal.tsx
    - frontend/app/(app)/mealplans/page.tsx
completed: 2026-10-09
---

# Phase 6 Plan 10: Cooked-it UI Summary

Preview/edit/apply "Cooked it?" sheet (Have, editable clamped Use, live Left, notes for skipped, mismatched and staple ingredients) wired to recipe detail and each planned meal, with a once-only Cooked badge.

## Commits
- 1616164 test(06-10): add failing cook preview helper tests (RED)
- 1298309 feat(06-10): add cook api client and preview helpers
- 4bf7ca5 feat(06-10): add cooked-it preview sheet
- cca5e6f feat(06-10): add cooked-it entry points

## Verification
- vitest 478/478 pass (15 new), type-check clean, eslint 0 errors (pre-existing warnings only), `next build` succeeds, no text-xs/font-bold/font-medium in components/cook. All files under 400 lines.

## Deviations from Plan
- **[Rule 3 - Blocking]** `frontend/app/(app)/mealplans/page.tsx` was not in files_modified; added a quiet `refreshAfterCook` and an `onCooked` prop on MealPlanDetailModal so the row flips to Cooked (the page uses local state, not React Query). The modal also keeps a local just-cooked list as an immediate fallback.
- `meal-plan-card.tsx` renders only aggregate stats (no individual meals), so it was left unchanged per UI-SPEC "where applicable".
- Edits (Use values, unlocked mismatch rows) are stored against the preview object they belong to, so a servings re-preview discards them without a setState-in-effect (lint rule).
- Not exercised in a browser; behavior verified by type-check, lint, helper unit tests and build only.

## Known Stubs
None.

## Self-Check: PASSED
