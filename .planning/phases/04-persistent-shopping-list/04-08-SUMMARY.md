---
phase: 04-persistent-shopping-list
plan: 08
subsystem: api
tags: [express, prisma, shopping, history]
requires: ["04-06"]
provides:
  - "POST /api/v1/shopping/finish -> { history, list }"
  - "GET /api/v1/shopping/history -> { items, pagination }"
  - "computeHistoryTotals (pure), withinOneDayOfUtcToday"
affects: [04-09, 04-11]
key-files:
  created:
    - backend/src/modules/shopping/shopping.totals.ts
    - backend/src/modules/shopping/shopping-finish.service.ts
    - backend/tests/shopping-totals.test.ts
    - backend/tests/shopping-finish.test.ts
  modified:
    - backend/src/modules/shopping/shopping.dto.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.routes.ts
key-decisions:
  - "Finish runs in one transaction under the active-list FOR UPDATE lock, no lazy create; empty -> SHOPPING_LIST_EMPTY, nothing checked -> SHOPPING_LIST_NOTHING_CHECKED before any write"
  - "History total = checked items' actual ?? estimate ?? 0, clamped to 2,000,000,000; stored in totalPhpCents (column not renamed)"
  - "receiptDate must be YYYY-MM-DD, ISO-valid and within UTC today +/- 1 day; omitted -> UTC today"
requirements-completed: [SHOP-05]
completed: 2026-10-09
---

# Phase 4 Plan 08: Finish shopping and history Summary

Finishing a trip completes the list, writes an int4-safe history row, carries unchecked items to a fresh list (or discards them), and a paginated history endpoint exposes past trips per user.

## Commits
- `test(04-08)` totals tests, then `feat(04-08): add shopping history totals`
- `ddc0017` test finish/history, `783cea5` feat finish shopping with history and carry-over

## Verification
Full backend suite: 39 suites, 563 tests pass. `tsc --noEmit` clean. Lint: 0 errors (147 warnings, pre-existing style). Covered: carry, discard, invalid carryOver, empty/missing list, nothing checked, repeat finish after carry-over (single history row), receiptDate bounds (+/-1 accepted; +/-2, bad month, wrong format, number rejected), PATCH on completed-list item 404, history ordering, pagination, bad params, cross-user isolation, clamp in unit test.

## Deviations from Plan
None for behavior. Note: test commits were made before implementation existed (RED = missing module / 404). Signup in the test suite is sequential because parallel signups hit the auth rate limiter.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (T-04-30..34 mitigated).

## Housekeeping
Temporary Postgres (port 5708) stopped and removed. Nothing pushed; STATE/ROADMAP/REQUIREMENTS untouched. Frontend files from 04-09 left untouched.

## Self-Check: PASSED
