---
phase: 06-capture-loops
plan: 01
subsystem: pantry
tags: [pantry, quick-edit, react-query, optimistic-update, stepper]
requires: []
provides:
  - "PATCH /pantry/:id accepts quantity 0..99999"
  - "frontend/lib/pantry/quantity.ts helpers"
  - "use-pantry hooks (usePantryList, usePantryPatch, useDeferredRemove, PantryQuickPatch)"
  - "QuantityStepper (reusable), UsedUpBadge, card onPatch/onRemoveUsedUp contract"
affects: [06-05, 06-10]
tech-stack:
  added: []
  patterns: ["React Query optimistic patch with snapshot rollback", "deferred delete with Undo toast"]
key-files:
  created:
    - backend/tests/pantry-quick-edit.test.ts
    - frontend/lib/pantry/quantity.ts
    - frontend/lib/pantry/quantity.test.ts
    - frontend/lib/hooks/use-pantry.ts
    - frontend/lib/hooks/use-debounced-quantity.ts
    - frontend/components/pantry/quantity-stepper.tsx
    - frontend/components/pantry/used-up-badge.tsx
  modified:
    - backend/src/modules/pantry/pantry.validation.ts
    - backend/src/modules/pantry/pantry.service.ts
    - frontend/app/(app)/pantry/page.tsx
    - frontend/components/pantry/pantry-item-card.tsx
key-decisions:
  - "Update validation relaxed to min 0 / max 99999; create stays > 0"
  - "Deferred delete (5 s Undo) instead of re-create, since create rejects quantity 0"
requirements-completed: [CAP-05]
duration: 25min
completed: 2026-10-09
---

# Phase 6 Plan 01: Pantry Quantity Quick Edit Summary

Unit-aware +/- stepper with direct entry, 400 ms debounced optimistic PATCH with rollback, and a Used up state (sorted last) with Remove and 5 s Undo, on a React Query pantry page; backend PATCH now accepts 0..99999.

## Commits
- 0500eaf test(06-01): failing pantry quick-edit tests
- d022fb4 feat(06-01): allow pantry quantity 0 on update
- (test) failing quantity helper tests; (feat) pantry quantity helpers
- e009371 feat(06-01): move pantry page to React Query
- fb952dc feat(06-01): add pantry quantity stepper and used-up state

## Verification
- TESTENV (port 5546): pantry-quick-edit + pantry tests 36/36 pass; backend tsc clean, lint 0 errors.
- Frontend: vitest 418/418, type-check clean, lint 0 errors (only pre-existing warnings).

## Deviations from Plan
- Existing pantry.test.ts needed no change (its -5 update case still returns 400).
- Task 2 page commit precedes the card commit, so type-check at that single commit alone fails (card props added in the next commit); both pass together.
- Search keeps the existing submit-to-apply behavior (no debounce existed) via an `appliedSearch` state.

## Known Stubs
None.

## Self-Check: PASSED
