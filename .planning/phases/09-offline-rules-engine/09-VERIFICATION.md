---
phase: 09-offline-rules-engine
verified: 2026-10-10T21:50:00Z
status: human_needed
score: 3/3 roadmap truths verified in code and tests (offline browser behavior pending human check)
overrides_applied: 0
human_verification:
  - test: "09-08 Task 2: DevTools offline walkthrough (steps 1-7 in 09-08-SUMMARY.md)"
    expected: "Page /recipes/cook shows the same top 5 in the same order with Network set to Offline (after one online load, client-side navigation); Find substitute sheet opens offline with no new requests; diet chip hides conflicting recipes; 375 px layout is a bottom sheet with 44 px targets"
    why_human: "Real browser offline behavior and responsive layout cannot be checked by grep or vitest"
---

# Phase 9: Offline Rules Engine Verification Report

**Phase Goal:** Users get useful "what can I cook" and substitution answers computed locally, with no network and no model.
**Status:** human_needed (no code gaps found)
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Offline, recipes ranked by pantry coverage with expiring items boosted | VERIFIED (code); browser pending | `lib/rules/rank.ts` and `pantry-index.ts` are pure functions (no fetch, no Date.now, no random; determinism.test.ts stubs fetch/XHR and greps sources for forbidden tokens). Hook `lib/hooks/use-cook-from-pantry.ts` uses `networkMode: 'offlineFirst'`, 24h gcTime, and ranks locally via `rankRecipes` with `today` from local date. Page `app/(app)/recipes/cook/page.tsx` renders `CookResultsList` from `result`. rank.test.ts covers coverage, expiry boost, missing penalty, filters. |
| 2 | Missing ingredient shows rules-based substitutions honoring diet/allergens, no network | VERIFIED | `substitutions.ts` plus `data/substitutions.json` (180 entries, above the 150 target; schema and integrity tests pass). Hook `getSubstitutes` calls `findSubstitutes` with `pantryHas` and the user's restrictions; `SubstituteSheet` is mounted in the page and fed by `onFindSubstitute`. Diet filter in `diet.ts` (port of server filter). |
| 3 | Ranking and substitutions identical online and offline | VERIFIED | Single code path (no online/offline branch; cached data feeds the same pure engine). Backend parity: `tests/rules-parity-*.test.ts` (4 suites, 118 tests) share fixtures with the client engine and the server `rankCookFirst`; client `parity.test.ts` passes. determinism.test.ts asserts repeat-run equality with network stubbed to fail. |

**Score:** 3/3

## Commands Run

| Command | Result |
|---------|--------|
| `cd frontend && npx vitest run lib/rules` | 14 files, 225 tests passed |
| `npm run type-check` | clean (tsc --noEmit, no output) |
| `npm run lint` | 0 errors, 118 warnings (pre-existing no-explicit-any style; none blocking) |
| `cd backend && npx jest tests/rules-parity --coverage=false` (DATABASE_URL=postgresql://x, 40-char JWT_SECRET, NODE_ENV=test) | 4 suites, 118 tests passed |
| `rank.bench.test.ts` alone x3 | 2/2 passed each run |
| Own timing of rank, 500 recipes x 200 pantry, 20 runs, 3 sessions | median 14.95 / 15.16 / 15.08 ms, p95 16.15 / 16.09 / 16.04 ms; budget 28.6 ms (100 ms mid-phone / 3.5 desktop factor). Not flaky in this environment. |

## Required Artifacts / Wiring

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/lib/rules/*` (types, units, diet, match, rank, pantry-index, substitutions, staples-default, cook-data, view-model, index barrel) | VERIFIED | Substantive (2665 lines incl. tests), no network imports, no TBD/FIXME/XXX/TODO markers |
| `frontend/lib/hooks/use-cook-from-pantry.ts` | VERIFIED | Imported by cook page; offlineFirst queries, memoized ranking, safeRank guard |
| `frontend/components/recipes/cook/*` (7 files) | VERIFIED | Used by page and results list |
| `frontend/app/(app)/recipes/cook/page.tsx` | VERIFIED | Wired from `recipes/page.tsx` (button), `components/dashboard/cook-first-card.tsx` (link), `lib/navigation.ts` title |
| Backend parity tests + shared fixtures | VERIFIED | Pass; server `DEFAULT_STAPLE_NAMES` equals shared fixture |

Data-flow (Level 4): hook pulls real paginated pantry and recipes through `pantryApi`/`recipeApi`, normalized at the boundary by `cook-data.ts`, then ranks. Flowing, not hardcoded.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| OFF-08: rules-based "what can I cook" ranking and substitutions with no network and no model | SATISFIED in code and tests; offline browser confirmation pending (human item) | Truths 1 to 3 above. REQUIREMENTS.md still shows OFF-08 unchecked/Pending; update after human approval. |

No orphaned requirements.

## Anti-Patterns

None blocking. No debt markers in phase files. Lint warnings are pre-existing `any` usage elsewhere.

## Notes and Non-Blocking Observations

- Offline scope is warm-cache only: the React Query cache is in-memory (no persister found), so cold-start offline (app closed, then opened with no network) does not work. This is explicitly deferred to Phase 11 and stated in 09-08-SUMMARY.md; not counted as a gap.
- `today` in the hook is memoized once per mount, so a page left open past midnight keeps the old date until remount. Minor.
- 09-08 summary notes no headless-browser check was run.

## Human Verification Required

### 1. DevTools offline walkthrough (09-08 Task 2)

**Test:** Follow steps 1-7 in `09-08-SUMMARY.md`: load the page online, note top 5, set Network to Offline, navigate client-side away and back, open Find substitute, then check diet chip and 375 px layout.
**Expected:** Same top 5 and order offline; substitute sheet works with no new requests; diet filtering and responsive layout as described.
**Why human:** Real browser offline and layout behavior.

## Gaps Summary

No code gaps. Only the pending human checkpoint stands between this phase and `passed`.

---

_Verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_
