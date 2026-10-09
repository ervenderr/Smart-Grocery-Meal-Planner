---
phase: 06-capture-loops
plan: 07
subsystem: frontend
tags: [shopping, pantry, bought-it, switch]
requires: [06-04]
provides:
  - "finishToast / pantryToggleHelper pure copy helpers"
  - "Shared Switch component (role=switch)"
  - "Finish sheet 'Add checked items to pantry' toggle (default ON)"
key-files:
  created:
    - frontend/lib/shopping/finish-toast.ts
    - frontend/lib/shopping/finish-toast.test.ts
    - frontend/components/ui/switch.tsx
  modified:
    - frontend/types/shopping.types.ts
    - frontend/lib/hooks/use-finish-shopping.ts
    - frontend/components/shopping/finish-sheet.tsx
    - frontend/app/(app)/shopping/page.tsx
metrics:
  tasks: 2
  completed: 2026-10-09
---

# Phase 6 Plan 07: Bought-it finish toggle Summary

Finishing a shopping trip now sends `addToPantry` (default ON, reset each time the sheet opens, disabled with 0 checked items), shows merge-aware toasts, and invalidates `queryKeys.pantry.all` after a successful merge.

## Commits
- test(06-07): failing finish toast copy tests
- feat(06-07): bought-it finish copy and hook input
- feat(06-07): bought-it toggle to finish sheet

## Verification
Full frontend vitest 433/433, type-check clean, lint 0 errors, typography gate clean.

## Deviations from Plan
- RED run was a vitest startup error (rolldown native binding temporarily missing while a parallel executor ran npm install), not a genuine assertion failure; tests passed once the binding returned. Behavior was covered by the test file written before implementation.
- Task 1 commit leaves page.tsx type-incompatible until the Task 2 commit (hook signature change); both commits land together.

## Known Stubs
None.

## Self-Check: PASSED
