---
phase: 12-one-time-unlock
plan: 08
subsystem: backend
tags: [ai, quota, entitlements, monthly-cap]
requires: [12-01]
provides:
  - resolveUserLimits, utcMonthStart, nextUtcMonthStart
  - Atomic per-user monthly AI scope (usermonth:<id>) in reserve/refund/prune
  - Entitlement-aware limits in the AI orchestrator
affects: [12-09]
key-files:
  created:
    - backend/src/modules/ai/ai-limits.ts
    - backend/tests/ai-limits.test.ts
  modified:
    - backend/src/modules/ai/ai-quota.repository.ts
    - backend/src/modules/ai/ai.deps.ts
    - backend/src/modules/ai/ai.orchestrator.ts
    - backend/src/modules/ai/ai.errors.ts
    - backend/tests/ai-quota.test.ts
    - backend/tests/helpers/ai-test-helpers.ts
    - backend/tests/ai-orchestrator-repair.test.ts
key-decisions:
  - "Entitlement lookup failure is logged and treated as free (never a 500)"
  - "usermonth rows pruned only after 62 days; daily rows keep the 14-day window"
requirements-completed: [SUB-02]
completed: 2026-10-11
---

# Phase 12 Plan 08: Paid AI allowance Summary

Entitled users get 40/day plus 600 per UTC month of server AI (env-overridable); free limits are unchanged. The monthly counter is incremented, rolled back and refunded in the same transactions as the daily and global counters.

## Commits
- 94fe427: ai-limits.ts, monthly scope in reserve/refund/prune, tests
- aec7b66: orchestrator wiring, deps shape, user_month error copy, test helper updates, HTTP tests

## Tests
- New: ai-limits 6 tests; ai-quota gained 4 repository monthly tests and 5 entitlement-aware HTTP tests (18 total in file).
- Run: ai-limits, ai-quota, ai-recipes, ai-meal-plan, ai-substitutions, ai-orchestrator-repair, ai-cache, ai-consent, ai-consent-gate, ai-dietary, account-deletion, entitlement-status: 12 suites, 108 tests passing.
- `tsc --noEmit` clean; lint 0 errors (existing warnings). ai.orchestrator.ts is 232 lines.

## Deviations from Plan
- [Rule 3] The `QuotaExceededInput.scope` type widening in ai.errors.ts was needed to compile once QuotaScope gained `user_month`; it landed in the Task 2 commit, so the Task 1 commit alone does not typecheck (intermediate only).
- Monthly tests use dates in 2045 because other suites randomly run `pruneOldUsage` with a 2032 clock, which flaked a 2031-dated monthly row once (found and fixed).

## Known Stubs
None.

## Self-Check: PASSED
