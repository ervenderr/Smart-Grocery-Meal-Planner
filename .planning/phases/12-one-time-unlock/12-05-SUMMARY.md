---
phase: 12-one-time-unlock
plan: 05
subsystem: frontend-offline
tags: [offline, outbox, entitlements, upgrade-required]
requires: []
provides:
  - classify() maps 403 UPGRADE_REQUIRED to a retryable conflict
  - "Needs upgrade" badge and UI-SPEC reason copy (native/web, pantry create and trip finish)
  - SheetRow.needsUpgrade, SheetInput.platform
  - lib/entitlements/upgrade-error.ts (isUpgradeRequired, upgradeLimitFrom)
affects: [12-12]
key-files:
  modified:
    - frontend/lib/offline/outbox/classify-error.ts
    - frontend/lib/offline/status/describe-op.ts
    - frontend/lib/offline/status/sheet-model.ts
  created:
    - frontend/lib/entitlements/upgrade-error.ts
decisions:
  - No new LastError.reason value; the upgrade conflict is reason 'conflict' with code 'UPGRADE_REQUIRED', so persisted rows are unchanged.
metrics:
  tasks: 2
  completed: 2026-10-11
---

# Phase 12 Plan 05: UPGRADE_REQUIRED offline classification Summary

A 403 UPGRADE_REQUIRED hit during outbox replay now parks as a retryable "Needs upgrade" conflict with exact UI-SPEC copy, and online callers get helpers to detect the gate and read the limit.

## Commits
- b9b004f feat(12-05): classify 403 UPGRADE_REQUIRED (classify-error, describe-op, sheet-model plus tests)
- 944f525 feat(12-05): online UPGRADE_REQUIRED error helpers
- 6307c19 fix(12-05): type-safe op literal in sheet-model test

## Tests
`vitest run lib/offline lib/entitlements`: 71 files, 493 tests passing. New cases cover classification, badge, retryability, native/web copy for pantry create and trip finish, unchanged other conflicts, sheet-model `needsUpgrade`/platform, and 7 helper cases. ESLint clean on touched files.

## Deviations from Plan
None in behavior. The first commit briefly contained a TS cast error in a test (a BSD sed failure went unnoticed); fixed in 6307c19.

## Known issues (out of scope)
`npx tsc --noEmit` still reports errors in `lib/native/store/*` (missing `./store-service`, readonly types), which belong to another parallel plan. None are in files touched here. `npm run lint` full run and the frontend build script were not run.

## Self-Check: PASSED
