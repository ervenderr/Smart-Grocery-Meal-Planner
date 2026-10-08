---
phase: 02-reliable-ai-suggestions
plan: 03
subsystem: api
tags: [llm, zod, dietary-filter, meal-plan, substitutions, gemini-removal]
requires: [02-01, 02-02]
provides:
  - features/meal-plan.ts and features/substitutions.ts on runAiFeature
  - features/apply-dietary.ts (recipes, meal plan, substitutions filters)
  - Controller enforcing saved UserPreference restrictions UNION request restrictions, reporting filteredOut and cached
  - Gemini SDK, GEMINI_AI_API_KEY and both legacy ai.service.ts files removed
affects: [02-04]
tech-stack:
  added: []
  removed: ["@google/generative-ai"]
  patterns: [filter after cache read so the cache stays user-independent, restrictions never sent to provider]
key-files:
  created:
    - backend/src/modules/ai/features/meal-plan.ts
    - backend/src/modules/ai/features/substitutions.ts
    - backend/src/modules/ai/features/apply-dietary.ts
    - backend/tests/ai-meal-plan.test.ts
    - backend/tests/ai-substitutions.test.ts
    - backend/tests/ai-dietary.test.ts
  modified:
    - backend/src/modules/ai/ai.controller.ts
    - backend/src/config/env.schema.ts
    - backend/src/config/env.config.ts
    - backend/.env.example
    - README.md
    - backend/package.json
    - backend/package-lock.json
    - backend/tests/env.schema.test.ts
  deleted:
    - backend/src/modules/ai/ai.service.ts
    - backend/src/services/ai.service.ts
key-decisions:
  - "Substitution filter checks the substitute text only; meal plan and recipe filters check names plus ingredients"
  - "Request dietaryRestrictions are re-sanitized in the controller (strings only, max 10, 50 chars) for the substitutions route, which has no validator for them"
requirements-completed: [AI-01, AI-02, AI-05, AI-06]
duration: ~30min
completed: 2026-10-09
---

# Phase 2 Plan 03: Meal plans, substitutions and diet enforcement Summary

All three AI features now run through the validated provider pipeline, are filtered in code against saved plus request dietary restrictions (reported as `filteredOut`), and the Gemini path is gone.

## Commits

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1 RED: failing meal plan, substitution, diet tests | 0a10245 | 15 of 16 failed as expected |
| 2 GREEN: features, apply-dietary, controller | ecf3654 | 28 tests across 4 AI files pass |
| 3 Gemini removal | 0443953 | env test, README, .env.example, package removal |

## Deviations from Plan

**1. [Rule 3 - Process] Legacy service deletions landed in 02-04's commit.**
`git rm` of `ai.service.ts` (both) was staged in the shared index and swept into 7f7dc26 (02-04, orchestrator wiring) by the concurrent plan. Content is correct; only attribution of those two deletions differs.

**2. [Rule 2 - Validation] Controller sanitizes request restrictions.** The substitutions route has no validator for `dietaryRestrictions`, so the controller keeps only strings, max 10 items, 50 chars each.

`features/recipes.ts` needed no change (already compatible). No auth gates; no live provider call and no API key written anywhere.

## Verification

Full backend suite against a temporary local Postgres 16 (with 02-04's migration applied): 24 suites, 344 tests pass. `tsc --noEmit` clean, lint 0 errors (141 pre-existing warnings), `npm run build` exit 0. `git grep GEMINI` in backend/src, .env.example and README.md returns nothing. Temporary cluster stopped and removed.

## Known Stubs

None.

## Notes

README retains a few narrative mentions of "Gemini" (badges, architecture text); only the env/setup instructions were updated. Worth a docs pass in a later phase.

## Self-Check: PASSED
