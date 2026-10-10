---
phase: 08-offline-sync-backend
plan: 11
subsystem: verification
tags: [smoke, coverage, quality-gate]
requires: [08-01, 08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10]
provides:
  - scripts/smoke-prod.sh check 15 (15a-15g) for Phase 8 endpoints
  - Full quality gate results and coverage for new Phase 8 backend files
key-files:
  created:
    - backend/tests/sync-cleanup-scheduler.test.ts
  modified:
    - scripts/smoke-prod.sh
requirements-completed: [SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07]
completed: 2026-10-10
---

# Phase 8 Plan 11: Verification and Smoke Summary

Smoke check 15 (CORS preflight from `capacitor://localhost`, idempotent replay, adjust clamp, client-id retry, refresh rotation, bootstrap paging, cleanup) was added to the production smoke script (syntax-checked only, never run against production), and the full gate is green on the backend; the frontend has one failure in a Phase 9 perf benchmark, not caused by Phase 8.

## Commits
- 91b8a4a feat(08-11): add smoke check 15 for offline sync groundwork
- 9a42d59 test(08-11): cover sync cleanup scheduler to reach 80% line coverage

## Quality gate results
| Check | Result |
|-------|--------|
| `prisma migrate status` | 13 migrations, schema up to date |
| backend `tsc --noEmit` | exit 0 |
| backend lint | 0 errors, 172 warnings (existing `no-explicit-any` style warnings) |
| backend `npm test` (jest --coverage) | 83 suites / 1444 tests passed; all files 85.66% lines |
| frontend `tsc --noEmit` | exit 0 |
| frontend lint | 0 errors, 119 warnings |
| frontend `vitest run` | 870 passed, 1 failed (66 files, 1 failed) |

### Frontend failure (Phase 9, not touched)
`frontend/lib/rules/rank.bench.test.ts` "ranks 500 recipes x 200 pantry items inside the desktop-scaled budget": median 33.56 ms vs budget 28.57 ms. It is a timing benchmark in Phase 9 in-progress code (`lib/rules`) that is sensitive to machine load. Reported, not fixed, per instructions. All Phase 8 frontend tests pass.

### New Phase 8 backend file line coverage (final run)
| File | Lines |
|------|-------|
| middleware/idempotency.middleware.ts | 89.06% |
| modules/idempotency/idempotency.cleanup.ts | 100% (was 50%, fixed) |
| modules/idempotency/idempotency.constants.ts | 100% |
| modules/idempotency/idempotency.hash.ts | 100% |
| modules/idempotency/idempotency.store.ts | 80.76% |
| modules/auth/refresh-token.service.ts | 94.44% |
| modules/auth/refresh-token.validation.ts | 100% |
| modules/sync/sync.controller.ts | 100% |
| modules/sync/sync.cursor.ts | 100% |
| modules/sync/sync.routes.ts | 100% |
| modules/sync/sync.service.ts | 100% |
| modules/sync/sync.validation.ts | 100% |
| modules/pantry/pantry.adjust.ts | 100% |
| modules/pantry/pantry.format.ts | 100% |
| modules/pantry/pantry.low-stock.ts | 88.88% |
| modules/shopping/shopping.receipt-window.ts | 100% |

Every new file is at or above 80%.

## Deviations from Plan

**1. [Rule 2 - Missing coverage] idempotency.cleanup.ts was at 50% lines**
- **Found during:** Task 2 coverage review
- **Issue:** `initializeSyncCleanup` and the scheduled-run error path were untested.
- **Fix:** Added `backend/tests/sync-cleanup-scheduler.test.ts` (3 tests, mocking node-cron and prisma).
- **Commit:** 9a42d59

No production code changed. Files touched: `scripts/smoke-prod.sh`, `backend/tests/sync-cleanup-scheduler.test.ts`.

## Scope checks
Diff over the phase commits (since 08-01) contains nothing under `frontend/lib/rules/`, `use-cook-from-pantry.ts`, or recipes UI, and no `railway.json`.

## Production deploy ordering (NOT executed; separate approved step)
0. Explicitly set `JWT_EXPIRES_IN=7d` on Railway first (code default is now 1h).
1. Deploy backend (migration `20261015000000_offline_sync` is additive), keeping Railway `JWT_EXPIRES_IN=7d`.
2. Deploy frontend with refresh handling.
3. Only then set `JWT_EXPIRES_IN=1h` on Railway.
4. Run `scripts/smoke-prod.sh` including check 15.

## Known Stubs
None.

## Threat Flags
None. The smoke script prints pass/fail labels only (never tokens) and deletes its pantry rows in 15g.
