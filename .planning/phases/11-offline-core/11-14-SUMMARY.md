---
phase: 11-offline-core
plan: 14
subsystem: offline-outbox
tags: [cook, finish-trip, executors, idempotency, tdd]
requires: [11-05, 11-08, 11-09]
provides: [cookApplyExecutor, defaultRows, shoppingFinishExecutor, buildCookApply, buildShoppingFinish, isFinishPending, localIsoDate]
affects: [11-15]
key-files:
  created:
    - frontend/lib/offline/outbox/executors/cook.ts
    - frontend/lib/offline/outbox/executors/shopping-finish.ts
    - frontend/lib/offline/outbox/executors/cook-finish.test.ts
    - frontend/lib/offline/ops/cook-ops.ts
    - frontend/lib/offline/ops/finish-ops.ts
    - frontend/lib/offline/ops/cook-finish-ops.test.ts
  modified:
    - frontend/lib/offline/outbox/executors/index.ts
    - frontend/lib/offline/outbox/fold.ts
    - frontend/lib/offline/reconcile/apply-result.ts
decisions:
  - "Mark a meal = queued cook.apply with mealPlanItemId (OFF-07); no pure mark endpoint."
  - "Default deductions mirror the sheet: mismatch rows excluded, zero uses dropped."
  - "localIsoDate added in finish-ops (no existing helper found)."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 14: Queued cook and finish trip Summary

Two-phase cook executor (preview with derived `.preview` key, persist resolved body via saveResolved, then apply with the op key) and a finish-trip executor, with op builders, finish lock predicate, and fold/applyResult support.

## Commits
- bee659f feat: op builders, isFinishPending, finish fold, applyResult for finish
- feat: cook and finish executors, registered in default registry

## Verification
- `vitest run lib/offline`: 30 files, 254 tests passing (new: 8 ops/builders, 3 fold, 2 applyResult, 9 executor/registry)
- Coverage executors/** and ops/**: 100% lines, 100% branches
- `tsc --noEmit` clean; lint 0 errors (126 warnings, pre-existing)
- Retry after drop-after-commit: preview not re-called, same body and key, server applyCount 1

## Deviations from Plan
- [Rule 3] Registering cook.apply by default broke two existing tests that used cook.apply as the "unregistered kind" (drain.test.ts, executors.test.ts); updated them (stub registry / bogus kind).
- RED and GREEN committed together per task (RED run confirmed failing first for task 1).
- Cook/finish fake server is local to the test file (flaky helper unchanged).

## Known Stubs
None. UI wiring is 11-15.

## Threat Flags
None. T-11-41..43 mitigated (resolved body persisted once and reused; live preview at drain time; derived preview key).

## Self-Check: PASSED
