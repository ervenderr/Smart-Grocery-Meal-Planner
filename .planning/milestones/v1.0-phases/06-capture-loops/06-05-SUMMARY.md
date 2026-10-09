---
phase: 06-capture-loops
plan: 05
subsystem: pantry
tags: [pantry, expiry, bottom-sheet, date-helpers]
requires: [06-01]
provides:
  - "addDaysShortcut, toIsoDate, todayIso in frontend/lib/pantry/expiry.ts"
  - "ExpirySheet bottom sheet; tappable expiry chip on the pantry card"
affects: []
tech-stack:
  added: []
  patterns: ["local-calendar date math via new Date(y, m, d + n)"]
key-files:
  created:
    - frontend/components/pantry/expiry-sheet.tsx
  modified:
    - frontend/lib/pantry/expiry.ts
    - frontend/lib/pantry/expiry.test.ts
    - frontend/components/pantry/pantry-item-card.tsx
key-decisions:
  - "Sheet awaits card onPatch (optimistic, rejects after rollback) so it stays open on failure"
requirements-completed: [CAP-05]
duration: 15min
completed: 2026-10-09
---

# Phase 6 Plan 05: Expiry Quick-Edit Sheet Summary

Tapping the expiry chip (or dashed "Add expiry date" chip) opens a bottom sheet with a date input, +1/+3/+7 day shortcuts (base = field date if today or later, else today), Save, Clear and Keep actions, with optimistic save and retained value on error.

## Commits
- 2cf9597 test(06-05): add failing expiry shortcut tests
- a1427e5 feat(06-05): add expiry shortcut helpers
- 0e1a3bf feat(06-05): add expiry quick-edit sheet

## Verification
- Frontend vitest 433/433 pass (lib/pantry 31/31), lint 0 errors, typography gate clean.
- type-check: my files clean; one error remains in app/(app)/shopping/page.tsx (FinishShoppingVariables), belonging to a parallel plan's in-progress work, out of scope.

## Deviations from Plan
- Vitest briefly failed to start (missing rolldown native binding) while another executor was reinstalling node_modules, so the RED run could not be observed; it passed after the install settled. The RED tests import exports that did not yet exist, so they necessarily failed.
- The existing card's "Expires:" non-warning display was merged into the new chip button.

## Known Stubs
None.

## Self-Check: PASSED
