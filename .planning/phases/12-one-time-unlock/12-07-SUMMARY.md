---
phase: 12-one-time-unlock
plan: 07
subsystem: backend
tags: [entitlements, pantry, gating, advisory-lock, shopping]
requires: [12-01]
provides:
  - lockPantryCap / assertPantryCapacity
  - Server-side free pantry limit (25 active items) on POST /pantry and trip finish
affects: [12-08, 12-09]
tech-stack:
  added: []
  patterns: [pg_advisory_xact_lock per user around count + insert, 403 UPGRADE_REQUIRED with details]
key-files:
  created:
    - backend/src/modules/pantry/pantry.limit.ts
    - backend/tests/pantry-limit.test.ts
    - backend/tests/shopping-finish-limit.test.ts
  modified:
    - backend/src/modules/pantry/pantry.service.ts
    - backend/src/modules/shopping/shopping-pantry.service.ts
    - backend/src/modules/shopping/shopping-finish.service.ts
key-decisions:
  - "Trip finish is gated (supersedes research A6): assertPantryCapacity(adding = plan.creates.length) before any write, inside the finish transaction; the 403 rolls back the whole finish"
  - "Client-id replay is resolved inside the cap lock before counting, so replays at the limit return 200"
requirements-completed: [SUB-02, SUB-03]
completed: 2026-10-11
---

# Phase 12 Plan 07: Pantry limit gate Summary

Free users are capped at 25 active pantry items on every create path (POST /pantry and shopping-trip finish), atomically via a per-user advisory lock. Entitled users are unlimited; existing items are never touched.

## Commits
- d5f2b0b: failing gate tests (RED)
- 98d5967: pantry.limit.ts and createItem transaction (GREEN)
- b6a40cd: trip-finish gate plus lock-order comment in shopping-finish.service.ts (comment-only)

## Tests
- pantry-limit: 7 and shopping-finish-limit: 6 new tests, all passing (including concurrency: 5 parallel creates at 23 gave 2 x 201 / 3 x 403; create vs finish at 24 gave exactly one success).
- Related suites pantry, pantry-client-ids, shopping-finish, shopping-finish-pantry pass (79 tests combined across both runs).
- Full backend suite: 1500 passed, 1 failed, 92 suites. The one failure (food-lookup 429 burst test) passes when run alone (23/23); it is a load-sensitive rate-limit timing test unrelated to this plan.
- `tsc --noEmit` clean; eslint 0 errors (existing warnings only).

## Deviations from Plan
- No existing test needed `grantTestEntitlement` (none pushed a user past 25), so no pre-existing test files were touched.
- Lock taken via `$executeRaw` tagged template (parameterized) rather than `$queryRaw`, since pg_advisory_xact_lock returns void.
- Test files import-clean up `idempotencyKey` and `entitlement` rows in afterAll.

## Known Stubs
None.

## Self-Check: PASSED
