---
phase: 09-offline-rules-engine
plan: 02
subsystem: rules-engine
tags: [substitutions, zod, vitest, offline, json]
requires: []
provides:
  - Bundled offline substitution table (180 entries, 464 swaps, schemaVersion 1)
  - zod strict schema, inferred types, DIETARY_TAGS and RATIO_UNITS
  - Table integrity test
affects: [09-04 substitution lookup, 09 UI]
tech-stack:
  added: []
  patterns: [static JSON data validated by zod in a test, not at runtime]
key-files:
  created:
    - frontend/lib/rules/substitution-schema.ts
    - frontend/lib/rules/substitutions-data.test.ts
    - frontend/lib/rules/data/substitutions.json
  modified: []
key-decisions:
  - "Dietary tags are conservative: omitted when label- or rennet-dependent (cheeses not tagged vegetarian/halal/kosher, tamari not tagged gluten_free)"
  - "Keys are canonicalName output (e.g. 'coconut amino', 'breadcrumb'); aliases that canonicalize to a key are omitted"
metrics:
  tasks: 2
  files: 3
  completed: 2026-10-10
---

# Phase 9 Plan 02: Offline Substitution Table Summary

180-entry hand-authored substitution table (464 swaps with ratios, notes, dietary tags) with a strict zod schema and integrity test.

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 Schema, test, first half | 0459f64 | schema + test + 82 entries |
| 2 Second half | 9830a47 | table grown to 180 entries |

## Verification

- `npx vitest run lib/rules/substitutions-data.test.ts`: 8/8 pass (incl. >= 150 entries)
- `tsc --noEmit`: no errors in lib/rules
- 180 entries, 464 swaps (>= 250); no "http" in the JSON

## Deviations from Plan

None in behavior. Table was authored via a throwaway generator script in the scratchpad (terse notation expanded to JSON); only the generated JSON is committed. Task 1 count assertion went green in Task 2 as planned.

## Notes for follow-up

- Human culinary sanity pass of ratios still needed (RESEARCH A2); T-09-04 mitigated by conservative tags plus the UI disclaimer.
- Keys are singularized by canonicalName; lookup (plan 04) must canonicalize input and aliases at load.
- A few "swaps" are loose approximations (yeast, vital wheat gluten) and carry explanatory notes; consider pruning in the review pass.

## Known Stubs

None.

## Self-Check: PASSED
