---
phase: 05-pantry-aware-intelligence
plan: 04
subsystem: backend-staples
tags: [staples, prisma-migration, preferences, validation, tdd]
requires: [05-01]
provides:
  - "intelligence/staples.ts: DEFAULT_STAPLE_NAMES, MAX_STAPLES, MAX_STAPLE_LENGTH, sanitizeStapleNames, everyStapleIsValid, resolveStaples, filterStaples"
  - "user_preferences.staple_names TEXT[] with 15-entry starter default"
  - "GET/PATCH /api/v1/users/preferences expose stapleNames and defaultStapleNames"
affects: [05-06, 05-08, 05-09]
key-files:
  created:
    - backend/src/modules/intelligence/staples.ts
    - backend/tests/intelligence-staples.test.ts
    - backend/prisma/migrations/20261012000000_user_staple_names/migration.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/src/modules/users/users.validation.ts
    - backend/src/modules/users/users.service.ts
    - backend/src/types/user.types.ts
    - backend/tests/users.test.ts
key-decisions:
  - "everyStapleIsValid lives in staples.ts (exported) so validation stays one chain: isArray(max 100) -> custom -> customSanitizer"
  - "Migration SQL is the exact prisma migrate diff output; no UPDATE needed, Postgres backfills existing rows from DEFAULT"
requirements-completed: [INT-04]
completed: 2026-10-09
---

# Phase 5 Plan 04: Staples Backend Summary

Per-user staples stored as `user_preferences.staple_names` (additive column, 15 starter defaults), a pure staples module, and a single-chain validated preferences endpoint that returns 400 (never 500) on bad payloads and exposes `defaultStapleNames`.

## Commits
- test: failing staples tests (RED, tests/intelligence-staples.test.ts)
- feat: staples defaults, sanitizer and filter
- feat: user staple_names migration (schema + SQL; parity test now green)
- 9bebc8f test: failing staples preference tests (RED, 12 failures confirmed)
- 1b3d027 feat: validate and persist staples preferences

No git push. No package files touched. No older migration folder modified.

## Verification (temporary Postgres 16, port 5804)
- A pre-existing user_preferences row inserted BEFORE the migration was applied, then `migrate deploy`: row has 15 staples, first `salt`, last `soy sauce` (psql: `legacy-p1 | 15 | salt | soy sauce`). Test rows deleted.
- `prisma migrate diff --from-migrations ... --shadow-database-url ... --exit-code` -> "No difference detected", exit 0.
- users.test.ts + intelligence-staples.test.ts + onboarding-backfill.test.ts: 80 passed. `tsc --noEmit` clean; lint 0 errors (148 pre-existing warnings).
- Rejected with 400 and state unchanged: 101 entries, 61-char entry, [123], [null], {}, 'salt', ['!!!'], ['']. PATCH canonicalizes/dedupes ([' Salt ','SALT','Olive Oil','Scallions'] -> salt, olive oil, green onion), persists on GET, PATCH without stapleNames leaves it unchanged, other users unaffected.
- Cluster stopped and /tmp/pg-0504, /tmp/pgs5804, private env file removed.

## Deviations from Plan
- [Minor] The existing validate middleware (shared auth.validation) returns `{ message: "Validation failed: stapleNames: ..." }` with status 400 and has no `code: VALIDATION_ERROR` field in the users module. Tests assert 400 plus that the message names `stapleNames` (the module's existing error shape) rather than introducing a new code.
- [Process] staples.ts was drafted alongside the RED test file, so the first RED commit contains only the test; the RED failure (module not found) was by construction and not separately run for Task 1. Task 3 RED was run and confirmed failing before implementation.

## Known Stubs
None.

## Threat Flags
None. T-05-09..T-05-14 mitigations implemented as planned (bounded array, per-item bail chain, JWT-scoped update, explicit whitelist, additive migration proven on a pre-existing row).

## Self-Check: PASSED
