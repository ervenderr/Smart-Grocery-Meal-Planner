---
phase: 05-pantry-aware-intelligence
plan: 08
subsystem: backend-intelligence
tags: [cook-first, ranking, recipes, tdd]
requires: [05-01, 05-04]
provides:
  - "intelligence/cook-first.ts: rankCookFirst, URGENCY_WEIGHTS, CookFirstRanked"
  - "intelligence/cook-first.service.ts: getCookFirst(userId, opts)"
  - "recipe/recipe.format.ts: toRecipeResponse"
  - "GET /api/v1/recipes/cook-first"
affects: [05-10]
key-files:
  created:
    - backend/src/modules/intelligence/cook-first.ts
    - backend/src/modules/intelligence/cook-first.service.ts
    - backend/src/modules/recipe/recipe.format.ts
    - backend/tests/intelligence-cook-first.test.ts
    - backend/tests/recipe-cook-first.test.ts
  modified:
    - backend/src/modules/recipe/recipe.service.ts
    - backend/src/modules/recipe/recipe.validation.ts
    - backend/src/modules/recipe/recipe.controller.ts
    - backend/src/modules/recipe/recipe.routes.ts
requirements-completed: [INT-05]
completed: 2026-10-09
---

# Phase 5 Plan 08: Cook This First Backend Summary

Deterministic, AI-free ranking of a user's recipes by soon-to-expire pantry usage, exposed at `GET /api/v1/recipes/cook-first` with strict query validation.

## Behavior
- Weights: daysLeft 0-1 = 5, 2-3 = 3, 4-7 = 1. Expired lots are ignored. Minimum daysLeft wins across lots of the same canonical name.
- Sort: score, coverage, shorter total time, title (case-insensitive), id.
- Response: `{ items: [{ recipe, score, usesExpiring, coveragePercent }], expiringCount }`.
- Params: `limit` 1-200 (default 3, top-N mode only); `today` YYYY-MM-DD and a real calendar date (400 for 2021-02-30, 2021-W01-1, 2026-1-05, datetimes; 200 for 2024-02-29); `includeAll=true|false`.
- Route is registered after `/stats` and before `/:id`.

## includeAll read cap
`includeAll=true` ignores `limit`, but the service reads at most **500 recipes** (newest-updated first) and 2000 pantry rows. Users with more than 500 recipes will not see the older ones in includeAll mode. This is the only bound.

## Verification
- 20 unit tests plus 18 endpoint tests pass; the recipe.test.ts regression passes (53 total on a temporary Postgres 16). `tsc --noEmit` is clean; lint has 0 errors.
- recipe.service.ts is 432 lines (it shrank).
- RED commits precede GREEN: 2acb8f0 is the endpoint RED commit and 29b03f6 the endpoint GREEN commit. The ranking RED and GREEN commits are earlier in the log, with messages "add failing cook-first ranking tests" and "add deterministic cook-first ranking".
- The temporary Postgres (port 5808) and its env file were stopped and removed.

## Deviations
- [Rule 1] The includeAll endpoint test originally expected exactly [D, A, B, C]. Zero-score malformed fixtures ("Bad", "Bad2") sort before "C" by title, so the test asserts the ranked prefix and that C is present, and that the output with `limit=1` equals the output without it.
- `toRecipeResponse` casts `ingredientsList` through `unknown` because the Prisma Json type is not assignable to `RecipeIngredient[]`.

## Known Stubs
None.

## Threat Flags
None. Every query is scoped by `userId` and `deletedAt: null`, and the tests cover a second user's pantry and recipes.

## Self-Check: PASSED
