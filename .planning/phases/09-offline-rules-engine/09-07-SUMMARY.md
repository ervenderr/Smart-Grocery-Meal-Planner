---
phase: 09-offline-rules-engine
plan: 07
subsystem: frontend-ui
tags: [react, tailwind, radix-modal, offline, presentational]
requires: [09-06]
provides:
  - RecipeRow, CoverageBar, IngredientGroups
  - SubstituteSheet, SwapCard, FilterCard
  - CookListSkeleton, CookEmptyState
key-files:
  created:
    - frontend/components/recipes/cook/coverage-bar.tsx
    - frontend/components/recipes/cook/ingredient-groups.tsx
    - frontend/components/recipes/cook/recipe-row.tsx
    - frontend/components/recipes/cook/swap-card.tsx
    - frontend/components/recipes/cook/substitute-sheet.tsx
    - frontend/components/recipes/cook/filter-card.tsx
    - frontend/components/recipes/cook/cook-list-states.tsx
key-decisions:
  - "Substitute trigger rendered only when match.hasSubstitute (no dead controls)"
  - "Expanded state is local per row; RecipeRow is React.memo"
  - "EmptyState action button is omitted when no onAction is passed (noOfflineData has no action)"
requirements-completed: [OFF-08]
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 9 Plan 07: Cook List and Substitute Sheet Components Summary

Seven small presentational components (21-94 lines each) implementing the approved UI-SPEC for the ranked "Cook from what you have" list and the network-free Substitute sheet, built on existing Button, Card, Modal, EmptyState and Skeleton.

## Commits
- 6b0d539 feat(09-07): recipe row, coverage bar and explainability groups
- c8c6fb0 feat(09-07): substitute sheet, swap card, filter card and list states

## Verification
- `npm run type-check`: clean
- `npx eslint components/recipes/cook`: 0 errors; prettier clean
- Acceptance greps: 0 hits for font-bold/font-medium/text-xs/dangerouslySetInnerHTML/text-red/bg-red and for AISubstitutionModal/lib/api/fetch( in all files; all files under 200 lines
- Plan-level `vitest run lib/rules` not re-run (no engine code touched; 09-06 noted pre-existing parity.test.ts failures from concurrent 09-05 work)

## Deviations from Plan
None - plan executed as written. Prettier reformatting applied to two files before commit.

## Known Stubs
None. Components are presentational and await wiring into the page in the next plan (09-08).

## Self-Check: PASSED
