---
phase: 07-store-readiness
plan: 08
subsystem: store-readiness
tags: [seed, app-review, naming]
requires: [07-01]
provides:
  - reviewer demo seed (guarded, idempotent, no AI consent)
  - docs/store/REVIEW-NOTES.md
  - docs/store/NAME-CHECK.md
key-files:
  created:
    - backend/src/tools/reviewer-seed.ts
    - backend/scripts/seed-reviewer.ts
    - backend/tests/seed-reviewer.test.ts
    - docs/store/REVIEW-NOTES.md
    - docs/store/NAME-CHECK.md
  modified:
    - backend/package.json
    - backend/.env.example
decisions:
  - Seed logic lives in src/tools (testable under rootDir ./src); CLI is a thin wrapper
  - Production guard throws even when ALLOW_SEED=true
requirements: [STORE-05]
completed: 2026-10-10
---

# Phase 7 Plan 08: Reviewer seed and store docs Summary

Idempotent, production-guarded reviewer demo seed (`npm run seed:reviewer`) that leaves AI consent unset and onboarding complete, plus App Review notes and a name-check document with six fallback names.

## Tasks

1. Reviewer seed module (TDD) and CLI: commit 27420b0. RED confirmed (module missing), then 11 tests green: guards, password rules, idempotent counts, consent null, onboarding set, password rotation, other users untouched.
2. Docs: commit acfd0da (plus a small wording fix commit for the grep gates).

## Verification

- `npx jest tests/seed-reviewer.test.ts`: 11/11 pass.
- CLI run twice locally: exit 0, identical counts (8 pantry, 3 recipes, 5 list items, 4 plan items). Throwaway user deleted afterwards.
- `NODE_ENV=production npm run seed:reviewer`: exit 1.
- eslint on src/tools, scripts, test: clean. Acceptance greps pass.

## Deviations from Plan

None to scope. Note: the `seed:reviewer` script was placed in the top-level `scripts` block (not the `prisma` block).

## Deferred / Flags

- App name NOT cleared (human gate); Kitcha collision with Kamp Inc remains open.
- Production seeding NOT done (deferred, owner-approved).
- `npx tsc --noEmit` currently reports duplicate `requireAiConsent` in `src/modules/ai/ai.routes.ts`, from another plan's in-progress work, not this plan's files.
- reviewer-seed.ts is 316 lines (under the 800 cap; mostly fixed sample data).

## Self-Check: PASSED
