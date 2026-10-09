---
phase: 05-pantry-aware-intelligence
plan: 03
subsystem: intelligence-parsing
tags: [parser, quick-add, fixture-parity, tdd]
requires: [05-01]
provides:
  - "backend parseIngredientLine, ParsedLine, MAX_LINE_LENGTH"
  - "frontend parseIngredientLine, quickAddFromLine"
  - "shared fixture backend/tests/fixtures/parse-line-cases.json (56 rows)"
affects: [05-07, 05-08]
key-files:
  created:
    - backend/src/modules/intelligence/parse-line.ts
    - backend/tests/intelligence-parse-line.test.ts
    - backend/tests/fixtures/parse-line-cases.json
    - frontend/lib/shopping/parse-line.ts
    - frontend/lib/shopping/parse-line.test.ts
  modified:
    - frontend/components/shopping/quick-add.tsx
key-decisions:
  - "Both parsers share one linear-scan grammar; rationals are bounded integer num/den (5 int digits, 4 fraction digits, fraction num 5 / den 4 digits) so cross-multiplication is exact. Backend divides once as Decimal; frontend rounds half up in integer hundredths."
  - "Out-of-range quantities (0, <0.01, >99999, oversized digits) return null quantity/unit with the text after the quantity and unit as the name."
  - "Digit-led ambiguity (%, 'percent', glued non-unit letters like 7up/3M) returns the whole trimmed line as the name."
  - "Decimal fractions beyond 4 digits are truncated (documented bound)."
requirements-completed: [INT-01]
completed: 2026-10-09
---

# Phase 5 Plan 03: Ingredient Line Parser and One-Line Quick-Add Summary

Backend and frontend ingredient line parsers agree on a 56-row shared JSON fixture, and Shopping quick-add now turns "2 kg rice" into 2 kg of rice.

## Commits
- 9f61dd0 test: failing backend parser tests and shared fixture (RED)
- dc5eb4e feat: backend parser (GREEN)
- a07e394 test: failing frontend parity tests (RED)
- 1b270db feat: mirrored frontend parser (GREEN)
- fc74897 feat: one-line quick-add

## Verification
- Backend: 61 jest tests pass (56 fixture rows, cap test, three 5,000-char timing tests under 50 ms); `tsc --noEmit` clean; lint 0 errors; parser is 248 lines, no `parseFloat`.
- Frontend: lint 0 errors (118 pre-existing warnings), type-check clean, 28 vitest files / 315 tests pass (71 in the new parser file), `next build` succeeds.
- Quick-add only parses when quantity and unit options are untouched; otherwise the existing `parseQuantityInput` path is unchanged. Name input keeps the 16px size rule; only the placeholder changed.

## Deviations from Plan
- [Rule 3 - Blocking] Backend jest setup needs env and a database; ran a private temporary Postgres 16 (port 5803, migrations deployed, test-only env file) and removed it afterwards.
- Fixture rows that behavior list leaves unspecified (e.g. 'pepper, to taste', '99999 g rice', '0.004 kg salt', 'an apple') were added to reach 56 rows; their expectations follow the stated rules.

## Known Stubs
None.

## Threat Flags
None. T-05-06 mitigated (200 char cap, linear scans, timing tests); T-05-07 server validation untouched.

## Self-Check: PASSED
All six files exist and all five commits are in git log.
