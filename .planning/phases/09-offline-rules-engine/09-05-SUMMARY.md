---
phase: 09-offline-rules-engine
plan: 05
subsystem: rules-engine
tags: [parity, performance, determinism, vitest, jest, offline]
requires: [09-03, 09-04]
provides:
  - Shared cook-first parity fixture (9 cases with server oracle) asserted in jest and vitest
  - Seeded dataset helper (mulberry32), performance gate, determinism/no-network test
key-files:
  created:
    - backend/tests/fixtures/cook-first-cases.json
    - backend/tests/rules-parity-cook-first.test.ts
    - frontend/lib/rules/parity.test.ts
    - frontend/lib/rules/test-helpers.ts
    - frontend/lib/rules/rank.bench.test.ts
    - frontend/lib/rules/determinism.test.ts
  modified:
    - frontend/lib/rules/match.ts
key-decisions:
  - "Name-level mode (quantityAware:false) treats a staple as covered regardless of unit, matching the server; the discrete-count staple exception stays in quantity-aware mode"
  - "Parity compares canonicalName(display name) for usesExpiring because the client reports display names and the server canonical names"
requirements-completed: [OFF-08]
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 9 Plan 05: Parity, Performance and Determinism Gates Summary

Server/client agreement on name-level coverage, expiring-used and urgency score is locked by one fixture; the 100 ms budget and offline determinism are enforced in the normal vitest suite.

## Commits
- 4a601fd fix(09-05): count staples covered for discrete units in name-level mode
- 8e346e4 test(09-05): cook-first parity fixture and suites
- 5a4a6e1 test(09-05): seeded dataset, performance gate and determinism tests

## Measured performance (desktop, Node, seed 42, 500 recipes x 200 pantry, diet on: vegetarian + no peanuts, 181 recipes hidden, 319 ranked)
- rankRecipes median across 5 batches of 20 runs: 14.5 - 16.4 ms (typical 15 ms); p95 14.8 - 24.9 ms (typical about 18 ms); worst single run 27.3 ms
- CI gate: median < 100 / 3.5 = 28.6 ms (about 1.9x headroom over measured median); at the assumed 3-5x mid-phone slowdown the median projects to roughly 45-75 ms, inside the 100 ms budget
- findSubstitutes: asserted median < 1 ms per call over 200 calls (passes)

## Test Results
- vitest `lib/rules`: 13 files, 223 tests pass in under 1 s; no tsc errors in lib/rules
- jest rules-parity-units/diet/staples/cook-first: 4 suites, 118 tests pass (needs a 32+ char non-default JWT_SECRET, DATABASE_URL and NODE_ENV=test set)

## Deviations from Plan

**1. [Rule 1 - Bug] Staple discrete-count exception applied in name-level mode**
- Found during: Task 1 (client parity run)
- Issue: with unit `pieces`, a staple (salt) was reported missing in `quantityAware:false` mode while the server counts it covered.
- Fix: exception now gated on quantity-aware mode in `resolveWithoutStock`; existing rank tests unchanged and green.
- Files: frontend/lib/rules/match.ts; Commit: 4a601fd

**2. Parity name mapping** - client expiring-used names are display names (by design), so the parity test canonicalizes them before comparing. No engine change.

Fixture has 9 cases (plan asked for 8); the oracle was generated once by running the server `rankCookFirst` from a throwaway scratchpad script (not committed). The tie-break case is in the fixture but ordering is not asserted (client adds ready-first/penalty by design).

## Known Stubs
None.

## Self-Check: PASSED
