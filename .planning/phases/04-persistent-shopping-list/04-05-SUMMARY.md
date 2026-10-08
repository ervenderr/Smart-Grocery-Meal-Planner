---
phase: 04-persistent-shopping-list
plan: 05
subsystem: frontend
tags: [shopping, react-query, optimistic-updates, mobile-ui]
requires: [04-02, 04-03]
provides:
  - useShoppingList / useAddShoppingItem / useUpdateShoppingItem / useDeleteShoppingItem
  - QuickAdd, ShoppingItemRow, CategorySection, ItemEditSheet
  - Shopping page on the persisted list API
key-files:
  created:
    - frontend/lib/hooks/use-shopping-list.ts
    - frontend/components/shopping/quick-add.tsx
    - frontend/components/shopping/shopping-item-row.tsx
    - frontend/components/shopping/category-section.tsx
    - frontend/components/shopping/item-edit-sheet.tsx
  modified:
    - frontend/app/(app)/shopping/page.tsx
requirements: [SHOP-01, SHOP-02, SHOP-04]
completed: 2026-10-09
---

# Phase 4 Plan 05: Shopping list frontend Summary

Shopping page now reads the server-stored active list through React Query, with optimistic check-off and rollback, quick-add, collapsible category sections, an edit sheet, delete with Undo, and error and empty states. The sessionStorage list is gone.

## Commits
- a93dbd7 feat(04-05): add shopping list query and mutation hooks
- a2780c8 feat(04-05): add shopping quick-add, item row and category section
- b564e15 feat(04-05): rewrite shopping page on the persistent list API

## Decisions
- Edit sheet form is a keyed inner component so state re-initialises per item.
- Undo re-POSTs via `toCreateInput` (new id, per 04-03 contract).
- Unknown units (generated items) stay selectable in the unit dropdown.
- The legacy `current-shopping-list` key is removed on mount; `USER_SCOPED_STORAGE_KEYS` unchanged.

## Deviations
None. Executed as written. The old meal-plan picker is removed here as planned; 04-07 re-adds generation.

## Verification
lint 0 errors (warnings pre-existing), type-check clean, vitest 157/157, `next build` succeeds, static greps (text-xs, font-bold/medium, vh, dangerouslySetInnerHTML, hard-coded currency) empty. Page is 168 lines. Not exercised against a live backend (04-04 concurrent); coded against the 04-03 contract only.

## Known Stubs
None.

## Self-Check: PASSED
