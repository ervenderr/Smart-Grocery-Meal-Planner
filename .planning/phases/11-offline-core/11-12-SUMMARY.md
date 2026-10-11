---
phase: 11-offline-core
plan: 12
subsystem: offline-status
tags: [status, indicator, sheet, retry, discard, tdd]
requires: [11-05, 11-09, 11-10]
provides: [deriveIndicator, describeOp, reasonCopy, rowBadge, savedAgo, canRetry, buildSheetModel, createStatusSource, retryOp, discardOp, retryAll, discardAllFailed, useOfflineStatus, useIsOnline, usePendingEntityStates]
affects: [11-13]
key-files:
  created:
    - frontend/lib/offline/status/derive-indicator.ts
    - frontend/lib/offline/status/describe-op.ts
    - frontend/lib/offline/status/sheet-model.ts
    - frontend/lib/offline/status/status-source.ts
    - frontend/lib/offline/status/actions.ts
    - frontend/lib/offline/status/use-offline-status.ts
    - (plus a .test.ts for each except the hook)
decisions:
  - "createStatusSource(runtime, getUserId) takes a second argument because the runtime does not expose the user id; the hook passes the auth store user."
  - "retryAll(runtime, userId) lists ops, retries every retryable failed op (not gone/invalid), then kicks the drain; returns the number retried. Ops in backoff are picked up by the kick."
  - "Rollbacks run newest first so dependents are undone before the op they depend on."
  - "Counts are derived from the listed ops (no extra async store.counts call) so snapshot fields stay consistent."
  - "justSynced requires zero queued, in-flight, blocked, paused and failed ops after refresh following a finished event."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 12: Offline status logic and actions Summary

All OFF-05 rules as pure tested modules (indicator priority and labels, plain-language rows and failure copy, sheet view model), a synchronous immutable status source, retry/discard actions that roll back the optimistic change, and thin `useSyncExternalStore` hooks that return null/online on web.

## Commits
- d02423e feat(11-12): indicator derivation, op descriptions and sheet model
- e82d1bf feat(11-12): status source, retry/discard actions and React hooks

## Verification
- `vitest run lib/offline/status`: 5 files, 40 tests passing (indicator 10, describe-op 9, sheet-model 7, status-source 9, actions 5)
- Coverage lib/offline/status/** excluding the hook: 98.93% statements, 100% lines on all files except status-source.ts (97.59% statements), 95.86% branches
- `tsc --noEmit` clean; lint 0 errors, no warnings in the new files
- Copy grep for outbox/idempotency/409 in user-facing strings: only the `OutboxOp` type name matches, no strings

## Deviations from Plan
- Signature additions (see decisions): `getUserId` argument on `createStatusSource`, `userId` on `retryAll`. Required because the runtime does not expose the user.
- RED and GREEN committed together per task (tests written first), as in prior plans.

## Known Stubs
None.

## Threat Flags
None. T-11-35 (labels are plain strings for React text nodes), T-11-36 (only mapped copy; raw server messages and codes never exposed), T-11-37 (discard applies rollbackOp writes for op and dependents, tested) mitigated.

## Self-Check: PASSED
