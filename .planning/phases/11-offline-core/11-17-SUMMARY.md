---
phase: 11-offline-core
plan: 17
subsystem: offline-ui-affordances
tags: [servings-scaling, pending-marker, offline]
requires: [11-12, 11-13, 11-15]
provides: [scaleIngredients, PendingMarker]
key-files:
  created:
    - frontend/lib/recipes/scale.ts
    - frontend/lib/recipes/scale.test.ts
    - frontend/components/offline/pending-marker.tsx
  modified:
    - frontend/components/recipes/recipe-detail-modal.tsx
    - frontend/components/shopping/shopping-item-row.tsx
    - frontend/components/pantry/pantry-item-card.tsx
    - frontend/components/mealplans/meal-plan-detail-modal.tsx
decisions:
  - "Recipe detail has no Edit entry point, so only Find Substitutes is gated offline (disabled, with 'Needs a connection')."
  - "Servings state resets to the recipe's servings when the recipe changes."
  - "Per-row usePendingEntityStates hook (shared snapshot); empty map on web so nothing renders."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 17: Offline affordances Summary

Recipe detail now scales ingredient amounts locally via a servings stepper (1-99, formatAmount/unitLabel), and shopping rows, pantry cards and meal plan Cooked badges show a pending cloud or failed warning marker that opens the Pending changes sheet.

## Commits
- 968c311 scaleIngredients (6 tests), servings stepper, offline gating in recipe detail
- d1fd216 PendingMarker and row wiring

## Verification
- scale tests: 6 passing
- Full vitest: 1501 passed, 1 flaky rank.bench failure on first run, clean on rerun
- tsc clean; lint 0 errors (129 warnings, pre-existing)
- Web build OK; mobile build:ios exit 0

## Deviations from Plan
- No Edit button exists in the recipe detail modal, so only the substitution action is gated.
- RED/GREEN committed together, as in prior plans.

## Known Stubs
None.

## Threat Flags
None. T-11-51 (React text nodes) and T-11-52 (stepper 1-99, scale guards non-positive) mitigated.

## Self-Check: PASSED
