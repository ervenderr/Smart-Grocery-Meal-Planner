---
phase: 04-persistent-shopping-list
plan: 01
subsystem: api
tags: [prisma, postgres, partial-unique-index, express, shopping]
requires: []
provides:
  - "GET /api/v1/shopping/list (lazy, race-safe, one active list per user)"
  - "Partial unique index shopping_lists_one_active_per_user"
  - "Phase 4 DTO/input contracts and limit constants"
affects: [04-04, 04-05, 04-06, 04-11]
tech-stack:
  added: []
  patterns: ["INSERT ... ON CONFLICT DO NOTHING + SELECT ... FOR UPDATE with bounded retry"]
key-files:
  created:
    - backend/prisma/migrations/20261011000000_shopping_active_list_unique/migration.sql
    - backend/src/modules/shopping/shopping.constants.ts
    - backend/src/modules/shopping/shopping.dto.ts
    - backend/src/modules/shopping/shopping.repository.ts
    - backend/src/modules/shopping/shopping.service.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.routes.ts
    - backend/src/types/shopping.types.ts
    - backend/tests/shopping.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/app.ts
key-decisions:
  - "Index is hand-written SQL (Prisma 5.22 cannot model partial indexes); documented in schema.prisma comment"
  - "Duplicates are completed, never deleted, before the index is created"
requirements-completed: [SHOP-01]
duration: ~20min
completed: 2026-10-09
---

# Phase 4 Plan 01: Shopping backend foundation Summary

Database-enforced single active shopping list per user with a lazy, race-safe `GET /api/v1/shopping/list`, plus all phase 4 contracts and limits.

## Tasks
1. Migration, schema comments, constants, types: `246b359`
2. Tests (RED): see `test(04-01)` commit; implementation (GREEN): `7bcf292`

## Migration proof (temp Postgres 16, port 5701)
Seeded one user with two active lists (`l-new` updated now, `l-old` a day older), then applied the migration:

```
  id   | is_completed | has_ts
-------+--------------+--------
 l-new | f            | f
 l-old | t            | t
```
Second active insert:
`ERROR: duplicate key value violates unique constraint "shopping_lists_one_active_per_user"`

Both `prisma migrate diff --exit-code` checks (shadow DB and live DB) returned "No difference detected" (exit 0).

## Verification
- `tests/shopping.test.ts`: 7/7 pass (401, lazy create, other user, 20 concurrent GETs, one active, persist, retry).
- Full backend suite: 31 suites, 446 tests pass. `tsc --noEmit` clean. Lint: 0 errors (pre-existing warnings only).
- No `queryRawUnsafe`/`executeRawUnsafe` in the shopping module.

## Deviations from Plan
- The first dedupe seeding attempt failed because of a shell function quoting error in my script, so the migration initially applied to an empty table. I dropped the index, deleted the `_prisma_migrations` row for it, seeded the duplicates and re-applied. The recorded proof is from the valid second run. No project files affected.
- The objective mentioned a `shopping.units` item that does not appear in the plan's file list or tasks. I did not create it; `UNIT_TEXT_PATTERN` and `MAX_UNIT_LENGTH` live in `shopping.constants.ts`. Flag for the orchestrator if a separate units module is expected.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model.

## Housekeeping
Temporary Postgres cluster stopped and removed. Nothing pushed; STATE/ROADMAP/REQUIREMENTS untouched.

## Self-Check: PASSED
