---
phase: 11-offline-core
plan: 08
subsystem: offline-outbox
tags: [drain, executors, idempotency, exactly-once, tdd]
requires: [11-04, 11-05, 11-06]
provides: [createDrainWorker, DrainEvent, createExecutorRegistry, shoppingExecutors, pantryExecutors, createFlakyServer, API_ROUTES.PANTRY.ADJUST]
affects: [11-13, 11-14, 11-21]
key-files:
  created:
    - frontend/lib/offline/outbox/drain.ts
    - frontend/lib/offline/outbox/drain.test.ts
    - frontend/lib/offline/outbox/drain.integration.test.ts
    - frontend/lib/offline/outbox/executors/types.ts
    - frontend/lib/offline/outbox/executors/shopping.ts
    - frontend/lib/offline/outbox/executors/pantry.ts
    - frontend/lib/offline/outbox/executors/index.ts
    - frontend/lib/offline/outbox/executors/executors.test.ts
    - frontend/lib/offline/test-helpers/flaky-server.ts
  modified:
    - frontend/lib/constants/api-routes.ts
decisions:
  - "Both network failures and timeouts stop the loop, emit offline and call reportNetworkFailure; neither counts an attempt."
  - "Per-pass tally with a rerun flag (single-flight); one backoff timer re-armed after every pass from the earliest queued next_attempt_at."
  - "Store failures inside a pass are caught and logged without payloads; rows untouched, next kick retries."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 08: Drain worker and executors Summary

Single-flight sequential drain worker (injected store, transport, connectivity, clock, timers) plus shopping/pantry executors, proven exactly-once against a flaky fake server mirroring the idempotency middleware, including a simulated app kill over the same SQLite file.

## Commits
- 773ec74 feat: executors, registry, flaky fake server, PANTRY.ADJUST route
- feat: drain worker with unit and integration tests

## Verification
- `vitest run lib/offline`: 27 files, 221 tests passing (executors 8, drain unit 14, drain integration 3)
- Coverage lib/offline/outbox/**: 99.39% lines, 89.51% branches (drain.ts 100% lines)
- Integration: pantry 10 -> 15 exactly (+2,+3 coalesced) and applyCount 1 per key under drop-after-commit, timeout and 503; shopping item exists once; killed in_flight op finishes with applyCount 1; replay returns stored response, different body gives 422
- `tsc --noEmit` clean; lint 0 errors (124 warnings, pre-existing)
- `test-helpers/flaky-server` imported only by tests

## Deviations from Plan
- RED and GREEN committed together per task (tests written first; executors implemented in the same commit as their tests).
- Unit tests use the real in-memory node:sqlite store with scripted transport instead of a fake store, for higher fidelity.
- An adjust followed by delete on the same entity coalesces away (delete wins), so the "later op stays blocked" test uses pantry.update.

## Known Stubs
None. The worker is not yet wired into the app runtime (kick sources and gate registration are in later plans).

## Threat Flags
None. T-11-23..26 mitigated: same key every attempt, user gate, single in-flight with backoff, kind/seq-only logging.

## Self-Check: PASSED
