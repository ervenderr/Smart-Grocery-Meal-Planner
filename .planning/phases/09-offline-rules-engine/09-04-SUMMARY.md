---
phase: 09-offline-rules-engine
plan: 04
subsystem: rules-engine
tags: [substitutions, offline, formatting, vitest]
requires: [09-01, 09-02]
provides:
  - findSubstitutes, hasSubstitute, matchSubstitutionKey, RESTRICTION_TAG_MAP
  - formatAmount, unitLabel, FRACTION_TOLERANCE
affects: [09-03 hasSubstitute wiring, 09 UI]
key-files:
  created:
    - frontend/lib/rules/format-amount.ts
    - frontend/lib/rules/format-amount.test.ts
    - frontend/lib/rules/substitutions.ts
    - frontend/lib/rules/substitutions.test.ts
key-decisions:
  - "Token-subset matching runs over table keys only (aliases match exactly after canonicalName); no edit-distance matching"
  - "Amounts of 1 or less read singular ('3/4 cup'); unscaled line falls back when query/per unit families differ"
requirements-completed: [OFF-08]
metrics:
  tasks: 2
  files: 4
  completed: 2026-10-10
---

# Phase 9 Plan 04: Offline Substitution Lookup Summary

Offline `findSubstitutes` over the bundled 180-entry table: exact/alias/whole-token matching, base-unit ratio scaling expressed in the recipe unit with kitchen fractions, diet/allergen swap removal with a hidden count, and in-pantry-first ordering.

## Commits
- 630ddf3 feat(09-04): kitchen fraction amount formatting
- c5427ef feat(09-04): substitution lookup
- (follow-up) fix(09-04): type swap unit as string, prettier

## Verification
- `npx vitest run lib/rules`: 7 files, 169 tests pass (6 format-amount, 23 substitutions)
- `tsc --noEmit`: no errors in plan files
- No fetch/axios/api/AISubstitutionModal references in substitutions.ts; no Intl in format-amount.ts

## Deviations from Plan
- [Rule 1 - Bug] Plural labels: fractional amounts (3/4) first rendered "3/4 cups"; added a local `label` helper so amounts <= 1 read singular to match the UI-SPEC example.
- A TS type error (unit widened to string) slipped into the first substitution commit and was fixed in the follow-up commit.

## Notes
- Token-subset matching means "egg noodles" or "boiled eggs" resolve to `egg`; acceptable per plan (longest key wins), revisit in review pass.
- Scaled line for count units reads e.g. "Use 1/2 cup applesauce for 2 egg" (uses the ingredient name as supplied).

## Known Stubs
None.

## Self-Check: PASSED
