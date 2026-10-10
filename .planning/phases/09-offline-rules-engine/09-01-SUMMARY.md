---
phase: 09-offline-rules-engine
plan: 01
subsystem: testing
tags: [rules-engine, units, dietary-filter, parity-tests, vitest, jest]

requires:
  - phase: 03-intelligence-core
    provides: server unit registry and dietary filter used as source of truth
provides:
  - Engine type contracts (frontend/lib/rules/types.ts)
  - Number-based unit registry port
  - Lookbehind-free dietary filter port with caps and precompiled patterns
  - Shared JSON parity fixtures run in vitest and jest
affects: [09-02, 09-03, 09-04, 09-05, 09-06, 09-07, 09-08]

tech-stack:
  added: []
  patterns:
    - "Shared JSON fixture in backend/tests/fixtures asserted by both vitest and jest"

key-files:
  created:
    - frontend/lib/rules/types.ts
    - frontend/lib/rules/units.ts
    - frontend/lib/rules/units.test.ts
    - frontend/lib/rules/diet.ts
    - frontend/lib/rules/diet.test.ts
    - backend/tests/fixtures/unit-convert-cases.json
    - backend/tests/fixtures/diet-cases.json
    - backend/tests/rules-parity-units.test.ts
    - backend/tests/rules-parity-diet.test.ts
  modified: []

key-decisions:
  - "Client units use plain numbers (no Decimal), UNIT_EPSILON 1e-6 for later comparisons"
  - "Diet termPattern uses (?:^|[^a-z0-9]) prefix instead of lookbehind for older iOS Safari"

requirements-completed: [OFF-08]

duration: 12min
completed: 2026-10-10
---

# Phase 9 Plan 01: Rules Engine Foundation Summary

**Client unit registry and dietary keyword filter ported from the server, locked to it by shared JSON fixtures (48 unit rows, 57 diet rows) asserted in both vitest and jest, plus the full engine type contract file.**

## Accomplishments
- types.ts holds every engine contract for plans 03-08.
- units.ts: resolveUnit, familyKey, toBase, fromBase, isConvertibleUnitKey, UNIT_EPSILON.
- diet.ts: buildForbiddenTerms, violates, compileRestrictions (caps 20 / 60), violatesCompiled.
- No server source edited, no new dependency.

## Task Commits
1. Task 1 (types + units + parity): 69c0f88
2. Task 2 (diet + parity): e5a2349

## Test Results
- vitest `lib/rules/units.test.ts` + `diet.test.ts`: 117 passed
- jest `rules-parity-units` (49) and `rules-parity-diet` (58): all passed (run with DATABASE_URL/JWT_SECRET/NODE_ENV=test set, as tests/setup.ts loads env config)

## Deviations from Plan

### Auto-fixed Issues

**1. [Fixture correction] Three diet rows initially mis-predicted**
- Found during: Task 2 (server parity run)
- Issue: expectations for `tomatoes`/"tomato paste" (false, singularize gives "tomatoe"), `anchovy`/"anchovies" (false, no ies handling in termPattern), `dairy-free`/"ice-cream" (true, hyphen is a word boundary) differed from real server behavior.
- Fix: fixture set to server truth; client matches.
- Files: backend/tests/fixtures/diet-cases.json

Otherwise executed as written.

## Issues Encountered
- `npm run type-check` and `npx vitest run lib/rules` report failures only in `substitutions-data.test.ts` / `substitution-schema.ts` / `data/`, which are another plan's untracked files (not this plan's scope). All files from this plan type-check cleanly.

## Known Stubs
None.

## Self-Check: PASSED
All 9 files exist; commits 69c0f88 and e5a2349 present.
