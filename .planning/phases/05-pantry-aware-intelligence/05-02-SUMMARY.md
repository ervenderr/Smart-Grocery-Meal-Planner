---
phase: 05-pantry-aware-intelligence
plan: 02
subsystem: analytics
tags: [iso-week, utc, tdd]
requires: []
provides:
  - isoWeekKey / periodKey pure helpers
affects: [analytics spending and price trends]
key-files:
  created:
    - backend/src/modules/analytics/iso-week.ts
    - backend/tests/analytics-iso-week.test.ts
  modified:
    - backend/src/modules/analytics/analytics.service.ts
decisions:
  - Aliased the import as computePeriodKey to avoid shadowing a local variable named periodKey in the price-trends method
metrics:
  tasks: 2
  files: 3
completed: 2026-10-09
---

# Phase 5 Plan 02: ISO week-year analytics keys Summary

Weekly analytics keys now use the ISO week-year and all period keys use UTC getters, via a pure tested `iso-week.ts` module.

## Commits
- faafe01 test(05-02): add failing ISO week-year tests (RED)
- 4591955 fix(05-02): add ISO week-year period keys (GREEN)
- 096fd5f refactor(05-02): use ISO week-year keys in analytics

## Results
- 13 table tests pass (2024-12-30 -> 2025-W01, 2021-01-03 -> 2020-W53, and the other boundary dates), plus a source grep test that no local getters are used.
- analytics.test.ts passes unchanged (38 tests total with the new file); tsc clean; lint 0 errors (148 pre-existing warnings).
- analytics.service.ts shrank from 597 to 577 lines; `getWeekNumber` removed (no other callers).
- RED note: the RED run failed at jest setup/env (no test DB env) as well as the missing module; the GREEN run confirmed all cases against a temporary Postgres 16 (since stopped and removed).

## Deviations from Plan
None. No analytics.test.ts expectations needed changing.

## Self-Check: PASSED
