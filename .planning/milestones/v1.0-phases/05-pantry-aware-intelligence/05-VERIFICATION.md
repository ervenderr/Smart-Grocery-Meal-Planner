---
phase: 05-pantry-aware-intelligence
verified: 2026-10-09T13:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); real-phone check pending
overrides_applied: 0
human_verification:
  - test: "Plan 05-13 real-phone check: generate a list from a meal plan on a phone and confirm the Already in your pantry / Skipped staples notes, the dashboard Cook this first card and the Recipes Use expiring first sort"
    expected: "Notes appear and persist across Meal Plans/Shopping navigation; card and sort rank recipes using expiring items; layout is usable on a phone"
    why_human: "Visual/touch behavior on a real device; deferred by the user"
---

# Phase 5: Pantry-Aware Intelligence Verification Report

**Goal:** Generated shopping lists contain only what the user actually needs to buy, and the app shows what to cook before food expires.
**Status:** human_needed (all automated truths pass; 05-13 real-phone check DEFERRED by the user, still pending)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parsed quantity/unit/canonical name, no float drift | VERIFIED | `intelligence/quantity.ts` uses an isolated Decimal clone (precision 40); `units.ts` factors are exact decimal strings; sums in base units, one round at output (`finalizeQuantity`). No parseFloat anywhere in the module; the only Number() calls are in parse-line digit scanning and cook-first day numbers. Backend parser mirrored in `frontend/lib/shopping/parse-line.ts`, both tested against `backend/tests/fixtures/parse-line-cases.json`. |
| 2 | Same ingredient merged, compatible units converted, count units kept separate | VERIFIED | `merge-groups.ts` groups by canonical name + `familyKey`; count units give `count:<unit>` and have `factor: null`, so they are never converted to volume or mass. `mealplan.aggregate.ts` and `shopping.merge.ts` run on the same engine (Decimal, base units). |
| 3 | Generated lists leave out what the pantry covers | VERIFIED | `pantry-subtract.ts`: expired lots skipped (`expiryDate < today`), stock summed per name + family, incompatible families not subtracted (flagged). `shopping-generate.service.ts` pantry query is scoped by `userId`, `deletedAt: null`, `quantity > 0`, capped at 2000 rows (`pantryCapped` reported). Fully covered plans: the empty check runs on the aggregated plan before staples and pantry, so a covered plan returns 200 with `added: 0` (covered by `intelligence-generate.test.ts`). |
| 4 | Staples never appear in generated lists | VERIFIED | `staples.ts` defaults match migration `20261012000000_user_staple_names` (15 entries). `filterStaples` is applied only in the generate and cook-first services, so manual adds are not filtered. `UsersService` whitelists `stapleNames` and returns `defaultStapleNames`. Validation is in `users.validation.ts` (max 100, 1-60 chars). |
| 5 | Cook this first ranks recipes by soon-to-expire items, no AI | VERIFIED | `cook-first.ts` is pure and takes `today` as input. `cook-first.service.ts` has no AI or quota imports and scopes recipes and pantry by `userId`. The route `GET /cook-first` is registered before `/:id` in the recipe router. Frontend: `components/dashboard/cook-first-card.tsx`, the Recipes page sort, and `lib/recipes/cook-first.ts`. |

**Score:** 5/5

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| INT-01 | SATISFIED | quantity.ts, units.ts, canonical.ts, parse-line.ts (+ frontend mirror with fixture parity) |
| INT-02 | SATISFIED | merge-groups.ts, mealplan.aggregate.ts, shopping.merge.ts; count family never converted |
| INT-03 | SATISFIED | pantry-subtract.ts + generate service; expired excluded; `covered` and `pantryCapped` returned; notes in `components/shopping/pantry-note.tsx` |
| INT-04 | SATISFIED | stapleNames column + migration, preferences validation, Settings staples UI, `skippedStaples` |
| INT-05 | SATISFIED | cook-first.ts / cook-first.service.ts / route / dashboard card / Recipes sort |

No orphaned requirements.

## Other checks

- Generate notes are cached under `['shopping','last-generate']` (`lib/react-query.ts`; set in `use-generate-shopping-list.ts`).
- Analytics ISO week-year fix: `modules/analytics/iso-week.ts` with `tests/analytics-iso-week.test.ts`.
- No package changes: `git diff` of every package.json and lockfile since the first Phase 5 commit is empty.
- Production: `/health` returns ok. Smoke checks 13a-13g passed on production (per the user; 13a-13c are present in `scripts/smoke-prod.sh`). `gh run list`: CI success on latest main commit (57ee7c2 chain, e3d3e08).
- Frontend `vitest run`: 31 files, 350 tests pass locally.
- Backend jest was not rerun locally. The suites need a database and real env (setup.ts), and the verifier is forbidden from handling env. Backend test status relies on the green CI run.

## Anti-patterns

None found in the intelligence module (no TODO/FIXME/XXX/TBD markers surfaced in the files read). Minor note: `shopping-generate.service.ts` converts existing row quantities with `toNumber()` before `mergeIntoItems`. The merge converts back to Decimal, and Decimal(10,2) values are exact in that range, so this is not a defect.

## Human verification pending

1. Plan 05-13 real-phone check (deferred by the user): generate a list, confirm the pantry and staples notes, the dashboard Cook this first card and the Recipes Use expiring first sort on a real phone.

## Gaps

None.

_Verifier: Claude (gsd-verifier)_
