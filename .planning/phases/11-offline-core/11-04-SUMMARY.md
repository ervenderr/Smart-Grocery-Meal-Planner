---
phase: 11-offline-core
plan: 04
subsystem: offline-read-cache
tags: [react-query, sqlite, zod, bootstrap, tdd]
requires: [11-01]
provides: [cache-keys whitelist, cache-meta, per-key query persister, bootstrap pager, snapshot seeder, syncApi, normalizePantryItem]
affects: [11-05, 11-07, 11-10]
key-files:
  created:
    - frontend/lib/offline/cache/cache-keys.ts
    - frontend/lib/offline/cache/cache-meta.ts
    - frontend/lib/offline/cache/query-persister.ts
    - frontend/lib/offline/cache/bootstrap-client.ts
    - frontend/lib/offline/cache/seed.ts
    - frontend/lib/api/sync.ts
    - frontend/lib/pantry/normalize.ts
  modified:
    - frontend/lib/constants/api-routes.ts
decisions:
  - Whitelist by root segment with explicit deny segments (ai, preview, history, last-generate); shopping only 'active'; notifications only 'stats'
  - Persisted rows store a slim dehydrated query (key, hash, data, dataUpdatedAt, status) validated by zod on read
  - SYNC.BOOTSTRAP is /api/v1/sync/bootstrap (backend mounts sync under the versioned prefix)
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 04: Read cache Summary

Per-user, zod-validated, per-key SQLite persistence of whitelisted React Query data, plus an all-or-nothing `/sync/bootstrap` pager and atomic snapshot seeder.

## Verification
- 29 tests passing in lib/offline/cache (keys 7, meta 3, persister 10, bootstrap 6, seed 3)
- Coverage lib/offline/cache/**: 100% lines, 97.7% statements, 91.1% branches
- lint: 0 errors. `tsc --noEmit`: one error, in `lib/offline/outbox/fold.ts` (plan 11-05, duplicate object literal property, TS1117); no errors in this plan's files.

## Deviations from Plan
- RED/GREEN were committed together per task (tests written first, one commit per task).
- Mid-run, vitest was unavailable for a few minutes because the concurrent 11-03 npm install dropped the rolldown darwin binding; resolved by 11-03's lockfile fix commit, no action taken by this plan.
- Route constant uses `/api/v1/sync/bootstrap` rather than a bare `/sync/bootstrap`.

## Known Stubs
None.

## Self-Check: PASSED
