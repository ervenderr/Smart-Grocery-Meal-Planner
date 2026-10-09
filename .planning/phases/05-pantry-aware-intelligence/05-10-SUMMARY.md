---
phase: 05-pantry-aware-intelligence
plan: 10
subsystem: frontend-intelligence
tags: [cook-first, dashboard, recipes, tdd]
requires: [05-08]
provides:
  - "lib/recipes/cook-first.ts: normalizeCookFirst, localDateString, expiringBadge, filterCookFirstEntries, COOK_FIRST_QUERY_KEY"
  - "recipeApi.getCookFirst"
  - "CookFirstCard dashboard card"
  - "Recipes 'Use expiring first' sort with badges"
key-files:
  created:
    - frontend/lib/recipes/cook-first.ts
    - frontend/lib/recipes/cook-first.test.ts
    - frontend/components/dashboard/cook-first-card.tsx
  modified:
    - frontend/lib/api/recipes.ts
    - frontend/app/(app)/dashboard/page.tsx
    - frontend/app/(app)/recipes/page.tsx
    - frontend/components/recipes/recipe-card.tsx
requirements-completed: [INT-05]
completed: 2026-10-09
---

# Phase 5 Plan 10: Cook This First Frontend Summary

Home dashboard "Cook this first" card (top 3, expiring items with days left) and a Recipes "Use expiring first" sort with amber badges, both backed by `GET /api/v1/recipes/cook-first` with the viewer's local date.

## Commits
- 05e1cda test: failing helper tests (RED)
- 53904ca feat: client and helpers (GREEN)
- 7735f51 feat: dashboard card
- feat commit "add use expiring first recipe sort" (Recipes page and RecipeCard badge)

## Behavior
- Card uses its own `useQuery` (key under `['recipes','cook-first',...]`, retry 1), so an unavailable endpoint shows "Suggestions are unavailable right now." and never touches the rest of Home. Empty state: "Nothing expiring that your recipes use". Heading is `text-xl font-semibold`.
- Recipes sort calls `getCookFirst({ includeAll: true, today })` with no limit, applies client-side search/category/difficulty filters preserving rank, and shows badges only in that mode. `RecipeFilters.sortBy` is unchanged.
- Responses pass through `normalizeCookFirst`, which drops malformed entries and clamps values.

## Verification
- 9 new Vitest tests (335 total) pass; lint 0 errors; type-check clean; `next build` succeeds.
- Grep gate (text-xs, text-lg, gap-3, p-3) clean in cook-first-card.tsx. dashboard page 301 lines, recipes page 358 lines.

## Deviations
None. The endpoint was not exercised live; code follows the 05-08 contract.

## Known Stubs
None.

## Threat Flags
None. All text is rendered through React, with no dangerouslySetInnerHTML.

## Self-Check: PASSED
