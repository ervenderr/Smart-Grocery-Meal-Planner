---
phase: 12-one-time-unlock
plan: 12
subsystem: frontend-entitlement-ui
tags: [entitlements, pantry-limit, upgrade-sheet, offline]
requires: [12-05, 12-10]
provides:
  - decidePantryAdd (pure gate)
  - usePantryAddGate hook
  - Add Item limit handling, Pending changes unlock action, finish-trip limit handling, delete-account note
affects: [12-14, 12-15]
key-files:
  created:
    - frontend/lib/entitlements/pantry-gate.ts
    - frontend/lib/entitlements/pantry-gate.test.ts
    - frontend/lib/hooks/use-pantry-add-gate.ts
  modified:
    - frontend/components/pantry/add-pantry-item-modal.tsx
    - frontend/components/offline/pending-change-row.tsx
    - frontend/components/offline/pending-changes-sheet.tsx
    - frontend/components/settings/delete-account-sheet.tsx
    - frontend/lib/hooks/use-finish-shopping.ts
requirements-completed: [SUB-03]
completed: 2026-10-11
---

# Phase 12 Plan 12: Limit handling in the UI Summary

The 26th pantry add now opens the upgrade sheet on native (form data kept, one automatic retry after unlock) or shows an inline role="alert" message on web; Pending changes and Finish trip handle the same limit.

## Commits
- 274cf32: pure `decidePantryAdd` + 11 tests
- 9091a29: `usePantryAddGate` hook and Add Item modal integration
- ccfe904: Pending changes "Unlock Kumaun Full", finish-trip handling, delete-account note

## Tests
- `vitest run lib/entitlements`: 6 files, 41 tests (11 new). `vitest run lib/offline/status lib/entitlements`: 15 files, 102 tests.
- Full frontend suite: 1689 passed, 0 failed.
- `tsc --noEmit`: clean. `npm run lint`: 0 errors (130 warnings, pre-existing style).
- `mobile/scripts/frontend-build.sh web` and `native`: both exit 0.

## Deviations from Plan
- [Rule 3] Gate logic extracted to `lib/hooks/use-pantry-add-gate.ts` (the plan allowed this) to keep the modal small. It reads the entitlement through a light `useQuery` on `ENTITLEMENT_QUERY_KEY` (shared cache entry) instead of `useEntitlement()`, to avoid duplicating that hook's resume/recheck effects in every form.
- Post-unlock retry sets a one-shot bypass of the local pre-check, because the closure's cached entitlement can still say `none` at that moment. The server 403 remains the backstop.
- Finish retry uses a `retriedRef` so a second 403 after unlock falls through to the generic toast instead of reopening the sheet.
- Pre-existing `any`/React Compiler warnings in the modal were left alone.

## Known Stubs
None.

## Known gaps
- No React-level tests (vitest is Node-only for `lib/**`); component behavior (sheet open, draft kept, auto-retry, Unlock button, finish retry) needs the 12-14/15 E2E.
- Scan, expiry, edit, adjust and delete paths were not touched.

## Threat Flags
None. T-12-48..50 handled: server stays authoritative; draft kept and rows never auto-discarded; Unlock action and sheet are native-only (`openUpgradeSheet` is a no-op on web), web shows text only.

## Self-Check: PASSED
