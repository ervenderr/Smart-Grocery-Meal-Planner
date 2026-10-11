---
phase: 11-offline-core
plan: 18
subsystem: offline-gating
tags: [needs-connection, online-only, ui]
requires: [11-07, 11-12]
provides: [NeedsConnection, NEEDS_CONNECTION_COPY]
key-files:
  created:
    - frontend/components/offline/needs-connection.tsx
  modified:
    - frontend/app/(app)/recipes/page.tsx
    - frontend/components/recipes/recipe-card.tsx
    - frontend/app/(app)/mealplans/page.tsx
    - frontend/components/mealplans/meal-plan-card.tsx
    - frontend/components/shopping/generate-from-plan.tsx
    - frontend/app/(app)/pantry/page.tsx
decisions:
  - "NeedsConnection render prop is (disabled, describedById); when online it renders the child with no wrapper, so web DOM is unchanged."
  - "Meal plan card: one NeedsConnection wraps the 3-button grid, gating Generate shopping list and Delete only (Edit is a coming-soon toast, not a network action); one helper line per card."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 18: Online-only action gating Summary

Online-only entry points are disabled (not hidden) offline with a "Needs a connection" helper linked via aria-describedby; web is unaffected because useIsOnline() is always true there.

## Commits
- 94f6b9f feat: NeedsConnection and recipe gating (AI Suggestions, Add Recipe, card Edit/Delete)
- b7f7c68 feat: AI Generate, Create Meal Plan, card shopping-list/Delete, Add to my list, generate-from-plan
- a4bd84b fix: pantry inline delete-confirm through offlineWrite (11-11 gap closed)

## Verification
- `tsc --noEmit` clean; lint 0 errors (127 warnings, pre-existing style)
- `vitest run`: 132 files passed, 1481 tests passed; only failure is the rank.bench perf gate, load-flaky (also noted in 11-10/11-11); it failed again when re-run alone because other plans' tests/builds were running concurrently. Unrelated to this plan.
- Web `next build` OK; `mobile npm run build:ios` OK
- grep NeedsConnection: recipes page 3, mealplans page 7, generate-from-plan 3

## Deviations from Plan
- [Rule 3] Also edited `components/recipes/recipe-card.tsx` and `components/mealplans/meal-plan-card.tsx`: per-card Edit/Delete/shopping-list buttons live there, not in the pages.
- 11-11 gap: pantry page delete-confirm now uses `offlineWrite` with `buildPantryDelete`; refetch only on the direct (web) path.
- No new unit test: component is a thin hook-driven wrapper and vitest is configured for node `lib/**/*.test.ts` only (no DOM env).

## Known Stubs / Notes
- Empty-state "Add a recipe" / "Get AI suggestions" / "Create meal plan" buttons (EmptyState component) are not gated; they open modals whose requests fail fast via the OfflineError gate.
- When disabled, the helper wrapper stacks the helper under the control, so right-aligned card action rows lose right alignment offline.

## Threat Flags
None. T-11-53 mitigated (disabled with helper); T-11-54 accepted (UX only).

## Self-Check: PASSED
