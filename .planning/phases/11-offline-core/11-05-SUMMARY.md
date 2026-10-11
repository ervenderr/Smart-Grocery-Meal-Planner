---
phase: 11-offline-core
plan: 05
subsystem: offline-outbox
tags: [outbox, sqlite, idempotency, coalescing, tdd, zod]
requires: [11-01]
provides: [op taxonomy, classify, backoff, planEnqueue, fold reducers, createOutboxStore]
affects: [11-08, 11-09, 11-11, 11-15]
key-files:
  created:
    - frontend/lib/offline/outbox/op-types.ts
    - frontend/lib/offline/outbox/classify-error.ts
    - frontend/lib/offline/outbox/backoff.ts
    - frontend/lib/offline/outbox/coalesce.ts
    - frontend/lib/offline/outbox/fold.ts
    - frontend/lib/offline/outbox/store.ts
    - frontend/lib/offline/outbox/store-rows.ts
    - frontend/lib/offline/outbox/fixtures.test-helper.ts
decisions:
  - "An op is 'attempted' (never coalesced) when state != queued, attempts > 0, or last_error_json is set. resetInFlight and opts-enqueued ops stamp last_error {reason:'transient'} so a possibly-sent payload is never mutated even when attempts is still 0 (network failures do not count attempts)."
  - "Ops enqueued behind a failed/blocked op on the same entity are inserted as 'blocked' so discard/retry handle them."
  - "pauseAuth stamps in_flight ops with last_error {reason:'auth'} for the same never-mutate reason."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 05: Outbox core Summary

Pure, SQL-tested outbox state machine: zod op taxonomy, outcome classification, jittered backoff, last-write-wins/decimal-safe coalescing, fold reducers over snapshots, and a durable SQLite store with subscribe.

## Commits
- b43f340 test: op types, classify, backoff (RED)
- 851fca0 feat: op types, classify, backoff
- test: coalesce and fold (RED), feat: coalesce and fold, fix: duplicate key in fold
- test: store (RED), feat: SQLite outbox store

## Verification
- `vitest run lib/offline/outbox`: 71 tests passing (op-types 7, classify 16, backoff 4, coalesce 14, fold 6, store 23 plus helper)
- Coverage lib/offline/outbox/**: 99.11% lines, 96.51% statements, 87.5% branches
- `tsc --noEmit` clean; lint 0 errors (127 warnings, 125 pre-existing)
- Zero `${` interpolation on SQL lines in store.ts; durability test rebuilds the store over the same node:sqlite file with identical rows
- Files: all under 250 lines, functions under 50

## Deviations from Plan
- [Rule 2 - correctness] Added the "attempted" marker via last_error_json (see decisions) because attempts alone misses network-failed or crash-reset ops that may already have reached the server; needed to honor D-07 never-mutate-after-send.
- [Rule 2] New ops queued behind failed/blocked same-entity ops are inserted as blocked.
- Test environment note: vitest briefly failed to start because node_modules was being rewritten by concurrent plan 11-03's npm install (rolldown native binding missing). The RED commits were confirmed by missing-module errors; GREEN runs happened after node_modules settled. No package files touched by this plan.

## Known Stubs
None.

## Threat Flags
None. T-11-13..15 mitigated (zod on enqueue and on row read, parameterized SQL, user_id filters). T-11-16 accepted: replay after the 48 h idempotency TTL can double-apply only if a response was lost AND the op stayed offline over 48 h.

## Self-Check: PASSED
