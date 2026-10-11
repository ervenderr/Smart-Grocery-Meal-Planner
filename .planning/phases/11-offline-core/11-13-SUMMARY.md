---
phase: 11-offline-core
plan: 13
subsystem: offline-status-ui
tags: [indicator, banner, sheet, toasts, haptics, tdd]
requires: [11-10, 11-11, 11-12]
provides: [SyncStatusIndicator, OfflineBanner, SyncFeedback, PendingChangesSheet, PendingChangeRow, planDrainToasts, usePendingSheet, openPendingSheet]
affects: [11-14, 11-19]
key-files:
  created:
    - frontend/lib/offline/status/toast-plan.ts
    - frontend/lib/offline/status/toast-plan.test.ts
    - frontend/lib/offline/status/sheet-store.ts
    - frontend/components/offline/sync-status-indicator.tsx
    - frontend/components/offline/offline-banner.tsx
    - frontend/components/offline/sync-feedback.tsx
    - frontend/components/offline/pending-changes-sheet.tsx
    - frontend/components/offline/pending-change-row.tsx
  modified:
    - frontend/components/dashboard/dashboard-header.tsx
    - frontend/app/(app)/layout.tsx
decisions:
  - "planDrainToasts also returns kind 'info' for the used-up message (plan listed success/attention only)."
  - "Used-up detection reads the server row quantity from the applied result (item, {item} or {data} shapes); only for pantry.adjust with negative delta."
  - "Retry-success haptic fires on an applied op with attempts > 0; warning haptic on every parked event."
  - "Banner reads html.keyboard-open via MutationObserver; on lg it is static and main's bottom padding ignores the banner var."
  - "Row discard fades 200ms (transition-opacity, none under motion-reduce) before calling discardOp."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 13: Offline status UI Summary

Header pill, offline banner, Pending changes sheet with retry/discard (inline confirms) and one aggregated toast set per drain, all rendering nothing on web (useOfflineStatus is null without a runtime).

## Commits
- a4e2e75 feat(11-13): toast planner and sheet store
- 0fdf213 feat(11-13): pending changes sheet and rows
- 37ae395 feat(11-13): indicator, banner and drain feedback wired into header and layout

## Verification
- `vitest run lib/offline/status/toast-plan.test.ts`: 11 tests passing (planner 10, store 1)
- Full suite: 1481 passed, 1 failed: `rank.bench` perf gate (known flaky under concurrent load from other plans' builds; also failed alone while sibling agents were building; unrelated to this plan)
- `tsc --noEmit` clean on final run (a transient error in 11-1x barcode WIP test cleared); eslint 0 warnings in touched files, 0 errors repo-wide
- Web `next build` OK; `mobile npm run build:ios` OK (App.app built)
- No package.json change; no dangerouslySetInnerHTML; only mapped reason copy rendered

## Deviations from Plan
- Added `info` toast kind (above). RED/GREEN committed together, as in prior plans.
- No component-level tests (plan specified none); logic lives in 11-12 modules and the tested planner.

## Notes
- 11-11 gap (writes made before the offline runtime exists take the direct path) is in the facade/boot layer, not in this plan's files; left for 11-19.
- Feedback and sheet render nothing until the runtime exists (whenOfflineRuntime covers a late boot).

## Known Stubs
None.

## Threat Flags
None. T-11-38 (text nodes only), T-11-39 (queued rows have no discard; per-row and bulk discards need inline confirm), T-11-40 (only mapped copy) mitigated.

## Self-Check: PASSED
