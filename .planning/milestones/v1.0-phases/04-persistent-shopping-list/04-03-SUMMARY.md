---
phase: 04-persistent-shopping-list
plan: 03
subsystem: frontend
tags: [shopping, react-query, types, optimistic-updates]
requires: []
provides:
  - shoppingApi client for /api/v1/shopping
  - queryKeys.shopping.active / history(page)
  - list-cache helpers (applyItemPatch, removeItem, upsertItem, toCreateInput)
affects: [04-05, 04-07]
key-files:
  created:
    - frontend/lib/shopping/list-cache.ts
    - frontend/lib/shopping/list-cache.test.ts
  modified:
    - frontend/types/shopping.types.ts
    - frontend/lib/constants/api-routes.ts
    - frontend/lib/api/shopping.ts
    - frontend/lib/react-query.ts
decisions:
  - "applyItemPatch treats a null category patch as 'keep current' so ShoppingItem.category stays a string"
requirements: [SHOP-01, SHOP-02]
completed: 2026-10-09
---

# Phase 4 Plan 03: Shopping client contract Summary

Rewrote shopping types, routes, API client and query keys to the real `/api/v1/shopping` endpoints, plus pure immutable cache helpers for optimistic updates.

## Commits
- 8cc769e feat(04-03): rewrite shopping client to the shopping API
- (test) test(04-03): add failing tests for shopping cache helpers (RED)
- 2c4a412 feat(04-03): add immutable shopping cache helpers (GREEN)
- 885e22e fix(04-03): keep category typed as string in cache patch

## Deviations
**[Rule 1 - Bug]** Initial GREEN commit had a TS error (patch `category: string | null` vs item `string`); fixed in 885e22e via `mergePatch`. Otherwise executed as written.
Old `shoppingListApi` export is gone (replaced by `shoppingApi`); no other importers existed.

## Verification
- list-cache tests: 10/10 pass; lint 0 errors; `next build` succeeds.
- `npm run type-check` in the shared tree showed errors only in other plans' in-progress files (lib/shopping/grouping, vocab, item-input, totals tests, missing modules from 04-02). None in 04-03 files.
- Full `npm test` not re-run across the whole suite because 04-02 files were mid-flight; only the 04-03 test was run.

## Known Stubs
None.

## Self-Check: PASSED
