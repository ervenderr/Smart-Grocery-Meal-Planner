---
phase: 05-pantry-aware-intelligence
plan: 07
subsystem: backend-aggregation
tags: [aggregate, merge, decimal, unit-family, tdd]
requires: ["05-01", "05-05"]
provides:
  - "mealplan.aggregate.ts: aggregateGroups, aggregateIngredients (same shape)"
  - "shopping.merge.ts: mergeIntoItems/mergeKey on groupKey; updates carry unit"
affects: [05-09]
key-files:
  modified:
    - backend/src/modules/mealplan/mealplan.aggregate.ts
    - backend/src/modules/shopping/shopping.merge.ts
    - backend/tests/mealplan-aggregate.test.ts
    - backend/tests/shopping-merge.test.ts
requirements-completed: [INT-01, INT-02]
completed: 2026-10-09
---

# Phase 5 Plan 07: Canonical Aggregation and Merge Summary

Meal plan aggregation and list merging now group by canonical name and unit family with exact Decimal math and the display ladder (applied even to single-unit groups). Merge updates carry the new unit.

## Commits
- c1 test(05-07): update aggregation tests (RED, compile failure on missing aggregateGroups)
- feat(05-07): aggregate meal plan ingredients exactly by canonical name and unit family
- test(05-07): update merge tests (RED, Dec quantity type error)
- feat(05-07): merge list items by canonical name with unit conversion
(see `git log --oneline` for hashes)

## Changed Phase 4 expectations (each marked `// Phase 5:` in tests)
- aggregate "keeps different units separate" (Milk 1 cups + 1 liters): replaced. Same volume family now merges to one line, 1.24 liters (metric/us tie -> metric). New test keeps cups + pieces apart.
- mergeKey: ('milk','cups') now EQUALS ('milk','liters') (same family); now asserts cups != pieces and ('Tomatoes','g') == ('tomato','kg').
- "sums into an unchecked match": updates now include `unit: 'liters'`.
- "sums in hundredths": 0.1 + 0.2 liters is now `{300, 'ml'}` (ladder); 99999 + 5 liters stays 99999 liters.
- "only merges into first unchecked match" and "zero-quantity next to real quantity": updates carry `unit: 'liters'`.
- "skips blank names...": Salt 0.001 g now `{0.01, 'grams'}` (display unit is the ladder label, not raw 'g').
- NEW cases: 500 g + 1 kg -> 1.5 kg; 1 cups + 16 tbsp -> 2 cups; cups vs pieces and clove vs pieces stay separate; Dec thirds -> 1 cup; checked row untouched.

## Verification
- shopping-merge, mealplan-aggregate, intelligence-merge: 49 pass. tsc clean, lint 0 errors (148 pre-existing warnings).
- Full backend suite on a private Postgres 16 (port 5807): 50 suites, 927 tests, all passing.
- mealplan.service.ts untouched; mealplan.aggregate.ts has no `+=` or Math.round; shopping.merge.ts is 97 lines.

## Expected red until 05-09
None. The full suite is green, including tests/shopping-generate.test.ts (bulkUpdateQuantities ignores the extra `unit` for now, so no existing generate expectation changed). 05-09 still needs to persist the unit on updates.

## Deviations
- [Rule 3] An early full-suite run failed in 15 suites because 05-08's uncommitted recipe files had a TS error (unused import) at that moment; unrelated to this plan. Re-run after 05-08 committed was fully green.
- Temp Postgres, env file and scratch files were stopped/removed.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
