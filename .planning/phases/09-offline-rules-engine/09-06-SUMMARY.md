---
phase: 09-offline-rules-engine
plan: 06
subsystem: rules-engine
tags: [react-query, offline-first, normalizers, view-model, hook]
requires: [09-03, 09-04]
provides:
  - "@/lib/rules barrel"
  - normalizePantry, normalizeRecipes, fetchAllPages, deriveCookStatus, PAGE_SIZE
  - buildRowViewModel, formatMatchLine, dietSummary, substituteContextLine, truncationNote
  - useCookFromPantry, COOK_PANTRY_KEY, COOK_RECIPES_KEY
key-files:
  created:
    - frontend/lib/rules/index.ts
    - frontend/lib/rules/cook-data.ts
    - frontend/lib/rules/cook-data.test.ts
    - frontend/lib/rules/view-model.ts
    - frontend/lib/rules/view-model.test.ts
    - frontend/lib/hooks/use-cook-from-pantry.ts
key-decisions:
  - "Raw page arrays are cached; normalization runs in useMemo so malformed cache rows never reach the engine"
  - "deriveCookStatus takes an extra engineFailed flag so a thrown engine error maps to 'error'"
  - "Engine unit fields are unit keys (e.g. grams), so view-model renders them via formatAmount/unitLabel; empty labels (pieces) are omitted"
requirements-completed: [OFF-08]
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 9 Plan 06: Engine Data Wiring Summary

Barrel export, boundary normalizers with a capped sequential pager, tested UI-copy helpers, and an offline-first `useCookFromPantry` hook (24h gcTime, no persister, keys prefixed with ['pantry'] / ['recipes'] so existing invalidations refresh them).

## Commits
- 04c8d92 test(09-06): failing tests for cook-data and view-model
- fd92fac feat(09-06): barrel, normalizers, pager, view-model
- eda35fe feat(09-06): useCookFromPantry hook

## Verification
- vitest cook-data + view-model: 18 passed
- `npm run type-check`: clean; eslint + prettier clean on new files
- Acceptance greps: offlineFirst x2, no persist/console/lib/api/ai; react-query.ts untouched; cook-data.ts has no lib/api or fetch(
- `vitest run lib/rules` overall: 5 failures all in parity.test.ts (plan 09-05, in progress, untracked, with a concurrent uncommitted edit to match.ts); not caused by this plan.

## Deviations from Plan
- `deriveCookStatus` input includes `engineFailed` (needed for the hook's try/catch to surface status 'error').
- `networkMode: 'offlineFirst'` is written inline on each query (not shared) so both usages are explicit.

## Known Stubs
None.

## Self-Check: PASSED
