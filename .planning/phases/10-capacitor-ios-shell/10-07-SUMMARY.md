---
phase: 10-capacitor-ios-shell
plan: 07
subsystem: frontend-native
tags: [capacitor, scanner, haptics, share]
requires: [10-01, 10-04]
provides: [useNativeScanner, haptic call sites, share-list button, data-bottom-nav]
affects: [scan-sheet, shopping page, bottom-nav]
key-files:
  created: [frontend/lib/scan/use-native-scanner.ts]
  modified:
    - frontend/components/pantry/scan/scan-sheet.tsx
    - frontend/components/pantry/scan/scan-states.tsx
    - frontend/components/pantry/add-pantry-item-modal.tsx
    - frontend/components/shopping/shopping-item-row.tsx
    - frontend/components/pantry/quantity-stepper.tsx
    - frontend/components/cook/cooked-it-sheet.tsx
    - frontend/lib/hooks/use-finish-shopping.ts
    - frontend/components/settings/delete-account-sheet.tsx
    - frontend/components/dashboard/bottom-nav.tsx
    - frontend/app/(app)/shopping/page.tsx
decisions:
  - "App.openSettings does not exist in @capacitor/app 8.1.2; openAppSettings uses the app-settings: URL (App.openUrl if present, else window.location, which Capacitor iOS hands to the OS)."
metrics:
  tasks: 2
  completed: 2026-10-11
---

# Phase 10 Plan 07: Native scanner, haptics, share Summary

Native barcode scanning plugs into the unchanged Phase 6 scan state machine through `useNativeScanner` (same shape as the web hook, plus `readError`), with haptics at every UI-SPEC call site and a Share list button on the shopping page.

## Commits
- 5154f90: native scanner hook and scan-sheet integration
- 10595fa: haptic call sites and Share list button

## What changed
- Engine selected by `isNative()`; web hook runs only when not native. Cancel closes the sheet silently; virtual device/no camera lands on the unsupported (manual) card; denied shows Open Settings plus Enter code instead; invalid read shows NATIVE_SCAN_ERROR_COPY card.
- Haptics: scan success/warning after lookup, item toggle, stepper (warning at bounds), cooked it, finish trip, delete sheet open, tab change.
- Share list button (44px, `share-list`, disabled with no unchecked items); copied/error toasts.
- `data-bottom-nav` on nav root, `tab-<name>` test ids.

## Deviations
- [Rule 3] The `scan-open` test id lives in `components/pantry/add-pantry-item-modal.tsx` (outside files_modified, one attribute). The pantry page and edit modal triggers were left untouched.
- `openSettings` unavailable (see decisions).
- Acceptance grep for `haptic('` in scan-sheet matches `haptic(cond ? 'success' : 'warning')` only loosely; behavior is as specified.

## Verification
type-check clean, lint 0 errors, lib/scan tests pass, web build via frontend-build.sh passes. Full vitest: 1069 pass; one `rank.bench.test.ts` perf gate failed under parallel-executor CPU load (unrelated, pre-existing timing test). Earlier transient type error in `lib/platform/navigation.test.ts` belonged to another plan and was gone at final run.

## Known Stubs
None.

## Self-Check: PASSED
