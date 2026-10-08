---
phase: 03-mobile-first-shell
plan: 02
subsystem: backend-users
tags: [currency, onboarding, prisma-migration, tdd, express-validator]
requires: []
provides:
  - SUPPORTED_CURRENCIES allow-list (backend/src/constants/currencies.ts)
  - UserPreference.onboardingCompletedAt (nullable, backfilled)
  - POST /api/v1/users/onboarding/complete (idempotent, server-stamped)
affects: [03-06, 03-13]
tech-stack:
  added: []
  patterns: [predicate-extraction migration test against real Postgres]
key-files:
  created:
    - backend/src/constants/currencies.ts
    - backend/prisma/migrations/20261010000000_user_onboarding/migration.sql
    - backend/tests/onboarding-backfill.test.ts
  modified:
    - backend/src/modules/users/users.validation.ts
    - backend/src/modules/users/users.service.ts
    - backend/src/modules/users/users.controller.ts
    - backend/src/modules/users/users.routes.ts
    - backend/src/types/user.types.ts
    - backend/prisma/schema.prisma
    - backend/tests/users.test.ts
key-decisions:
  - "Currency validated with trim + upper-case sanitizer + isIn(16-code list)"
  - "completeOnboarding uses updateMany where null so first timestamp wins"
  - "onboardingCompletedAt kept out of UpdatePreferencesRequest and the update whitelist"
metrics:
  completed: 2026-10-09
  tasks: 2
  files: 10
requirements: [MOB-05, MOB-06]
---

# Phase 3 Plan 02: Backend currency allow-list and onboarding state Summary

Server-side 16-code currency allow-list (case-normalised) plus an additive `onboarding_completed_at` column with a backfill for active users and an idempotent, server-stamped `POST /users/onboarding/complete`.

## Commits
- da721ad test(03-02): add failing currency allow-list tests
- dc826ff feat(03-02): enforce currency allow-list
- 2035d42 test(03-02): add failing onboarding tests
- f7f1260 feat(03-02): add onboarding completion state

(RED then GREEN verified for both tasks; see `git log --grep "03-02"`.)

## Verification
- Temporary Postgres 16 (port 5610): `prisma migrate deploy` applied the new migration; full backend suite 434/434 passing, `tsc --noEmit` 0, lint 0 errors.
- Backfill predicate test selects live-pantry, soft-deleted-pantry, USD, budget 50000, dietary, and updated-preferences users, and not a default user.

## Deviations from Plan

**1. [Rule 3 - Blocking] Relative import for constants** - tsconfig has no `@/constants/*` alias, so users.validation.ts imports `../../constants/currencies` instead of adding alias config (would also need jest/runtime alias changes).

**2. Currency and onboarding tests appended as separate top-level describes** in users.test.ts, each with its own user, because the existing describe deactivates its account at the end.

**3. State handling** - `gsd-sdk state.advance-plan` could not parse STATE.md and its other state/requirements calls wrote misleading changes; these were reverted. Only the 03-02 ROADMAP checkbox was ticked. MOB-05/MOB-06 were NOT marked complete because the frontend plans still deliver them; the orchestrator should update STATE.md/REQUIREMENTS.md.

## Deferred Issues
- Pre-existing schema drift: `zapier_webhooks` exists in schema.prisma with no migration, so `prisma migrate diff --exit-code` exits 2 (the diff mentions no user_preferences changes). Logged in `deferred-items.md`; the plan's "exit 0" criterion could not be met for that reason. Note for deploy plan 03-13.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model.

## Self-Check: PASSED
