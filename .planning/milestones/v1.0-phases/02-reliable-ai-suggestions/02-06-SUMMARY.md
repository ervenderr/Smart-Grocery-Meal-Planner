---
phase: 02-reliable-ai-suggestions
plan: 06
subsystem: ui
tags: [nextjs, react, ai-modals, barcode, open-food-facts, attribution]
requires: [02-01, 02-03]
provides:
  - getApiErrorMessage / getApiErrorCode (frontend/lib/api/errors.ts)
  - DietFilterNotice shown in all three AI modals
  - foodApi client, FoodDataAttribution, BarcodeLookup
  - Barcode-number lookup in Add Pantry Item modal (prefills name and category)
affects: [02-07]
key-files:
  created:
    - frontend/lib/api/errors.ts
    - frontend/lib/api/food.ts
    - frontend/components/ai/diet-filter-notice.tsx
    - frontend/components/food/food-data-attribution.tsx
    - frontend/components/food/barcode-lookup.tsx
  modified:
    - frontend/lib/api/ai.ts
    - frontend/components/ai/ai-recipe-suggestions-modal.tsx
    - frontend/components/ai/ai-meal-plan-modal.tsx
    - frontend/components/ai/ai-substitution-modal.tsx
    - frontend/components/pantry/add-pantry-item-modal.tsx
key-decisions:
  - "Shared DietFilterNotice component instead of three inline copies"
  - "Brand appended to product name in parentheses, falling back to name only when over 100 chars (backend max)"
requirements-completed: [AI-04, AI-05, AI-06, AI-07]
completed: 2026-10-09
---

# Phase 2 Plan 06: Frontend AI messages, diet notice, barcode lookup Summary

AI modals now show the server's quota/unavailable/rate-limit message, report how many suggestions the dietary filter hid (with a keyword-check disclaimer), and the Add Pantry Item modal can look up a barcode number with Open Food Facts attribution.

## Commits

| Task | Commit |
| ---- | ------ |
| 1 Server messages + diet-filter notice | 1661ad4 |
| 2 Food client, attribution, barcode lookup, pantry modal | d6b68ec |

## Deviations from Plan

**1. [Rule 2 - Quality] Extra file `components/ai/diet-filter-notice.tsx`.** Avoids duplicating the notice in three modals.

**2. [Rule 2 - UX] Substitutions with zero results but filteredOut > 0** show an explanatory toast, since the results view (where the notice lives) is not entered when the list is empty.

The save-recipe error path now shows the server message instead of the fixed string (per plan: every catch uses getApiErrorMessage).

## Verification

`npm run lint` 0 errors (141 pre-existing warnings), `npm run type-check` clean, `NEXT_PUBLIC_API_URL=https://x.example npx next build` succeeds. Food endpoints not called live (02-05 runs concurrently); code follows the contract types exactly. Not exercised in a browser.

## Known Stubs

None.

## Self-Check: PASSED
