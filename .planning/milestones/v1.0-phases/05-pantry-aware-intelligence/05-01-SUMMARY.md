---
phase: 05-pantry-aware-intelligence
plan: 01
subsystem: backend-intelligence
tags: [decimal, units, canonical-name, tdd]
requires: []
provides:
  - "intelligence/quantity.ts: D, Dec, ZERO, toDec, parseDec, round2, finalizeQuantity"
  - "intelligence/units.ts: resolveUnit, familyKey, toBase, fromBase, toDisplay, UnitFamily, ResolvedUnit"
  - "intelligence/canonical.ts: canonicalName, INGREDIENT_ALIASES, PLURAL_INVARIANTS"
affects: [05-03, 05-04, 05-05, 05-07, 05-08, 05-09]
tech-stack:
  added: []
  patterns: ["isolated Decimal.clone (precision 40, half up)", "sum in base units, divide last, round once"]
key-files:
  created:
    - backend/src/modules/intelligence/quantity.ts
    - backend/src/modules/intelligence/units.ts
    - backend/src/modules/intelligence/canonical.ts
    - backend/tests/intelligence-quantity.test.ts
    - backend/tests/intelligence-units.test.ts
    - backend/tests/intelligence-canonical.test.ts
  modified: []
key-decisions:
  - "Display ladder lives in one LADDERS table in units.ts (single place to change)"
  - "PLURAL_INVARIANTS includes oats, grits, cress etc. beyond the plan's list so 'rolled oats' survives"
requirements-completed: [INT-01, INT-02]
duration: ~20min
completed: 2026-10-09
---

# Phase 5 Plan 01: Pure Intelligence Core Summary

Exact Decimal quantity math (isolated clone), unit registry with family conversion and display ladder, and an idempotent canonical-name key, all table-driven and test-first.

## Commits
- ca154da feat: quantity helpers (preceded by RED test commit "test(05-01): add failing quantity math tests")
- 22ec55b test (RED) / ed5fa14 feat: unit registry and display ladder
- d3ca574 test (RED) / bd052bf feat: canonical ingredient name

RED commits precede each GREEN commit; each RED run failed with module-not-found.

## Verification
- 112 tests pass across the three new files; `tsc --noEmit` clean; `npm run lint` 0 errors (148 pre-existing warnings).
- Shared Prisma Decimal precision asserted to remain 20. No package.json/lockfile change.
- units.ts is 188 lines, canonical.ts under 100.

## Deviations from Plan
- [Rule 3 - Blocking] The Jest setup imports env config, so tests need DATABASE_URL/JWT_SECRET. Ran with a temporary Postgres 16 (port 5801, migrations deployed), then stopped and removed it along with its private env file.
- [Rule 2] Added extra PLURAL_INVARIANTS entries (oats, grits, watercress, cress, citrus, lemongrass, swiss, bass) so the required 'rolled oats' row holds.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
All six files exist and all commit hashes are in git log.
