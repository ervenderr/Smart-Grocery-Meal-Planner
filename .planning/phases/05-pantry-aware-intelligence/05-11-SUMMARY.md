---
phase: 05-pantry-aware-intelligence
plan: 11
subsystem: frontend-shopping
tags: [pantry-note, generate, react-query, tdd]
requires: ["05-09"]
provides:
  - "CoveredItem type and optional covered/skippedStaples/pantryCapped on GenerateShoppingListResult"
  - "covered-note.ts: toLastGenerateResult, formatCoveredLine, buildGenerateNotes"
  - "queryKeys.shopping.lastGenerate"
  - "PantryNote component on Shopping and Meal Plans pages"
key-files:
  created:
    - frontend/lib/shopping/covered-note.ts
    - frontend/lib/shopping/covered-note.test.ts
    - frontend/components/shopping/pantry-note.tsx
  modified:
    - frontend/types/shopping.types.ts
    - frontend/lib/shopping/generate-summary.ts
    - frontend/lib/shopping/generate-summary.test.ts
    - frontend/lib/react-query.ts
    - frontend/lib/hooks/use-generate-shopping-list.ts
    - frontend/app/(app)/shopping/page.tsx
    - frontend/app/(app)/mealplans/page.tsx
requirements-completed: [INT-03, INT-04]
completed: 2026-10-09
---

# Phase 5 Plan 11: Pantry and staples notes (frontend) Summary

After generating a list from a meal plan, the Shopping page and the Meal Plans preview show a collapsed "Already in your pantry (N)" disclosure and a "Skipped staples" line. The note reads the last generate result from the React Query cache under `['shopping','last-generate']`, so it survives navigating between the two pages.

## Commits
- 1ea10be test(05-11): add failing generate note tests (RED)
- 899e5bc feat(05-11): describe pantry-covered and staple items
- 64c959e feat(05-11): cache last generate result and add pantry note
- 1341135 feat(05-11): show pantry-covered and skipped staples notes

## Behavior
- Toast: "Your pantry already covers this plan" when nothing was added and covered is non-empty. "Only staples in this plan, nothing to add" for staples only. "N items added to your list (M already in your pantry)" when items were added. The four Phase 4 wordings are unchanged.
- Note lines: full "have X, need Y", partial adds "(added the rest)", incompatible "can't compare units (have X u), added in full". Numbers are rounded to 2 decimals.
- pantryCapped shows the "too large to fully compare" message as an amber line, visible without expanding.
- Old backend: missing or invalid fields coerce to empty, so no note renders and nothing errors.
- Meal Plans only shows the note when the cached result belongs to the previewed plan. A Dismiss button clears the cache key.
- Session cleanup calls `cache.clear()`, so the key is cleared on logout or user switch.

## Verification
- RED confirmed (3 failing tests) before GREEN.
- Lint 0 errors (118 pre-existing warnings), type-check clean, vitest 31 files / 350 tests pass, `next build` succeeds.
- Static grep clean on pantry-note.tsx (no text-xs, text-lg, gap-3, p-3, dangerouslySetInnerHTML) and on the diff (no vh units). pantry-note.tsx is 85 lines. Page sizes 261 (shopping) and 252 (mealplans).
- Not exercised against a live backend.

## Deviations from Plan
None. Plan executed as written.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
