---
phase: 07-store-readiness
plan: 01
subsystem: backend-foundation
tags: [prisma, migration, ai-consent, test-helpers, postgres]
requires: []
provides:
  - local Postgres 16 test DB (kitcha_dev) and git-ignored backend/.env
  - users.ai_consent_at / ai_consent_version columns
  - ai_reports table (cascade FK to users)
  - AI_CONSENT_VERSION constant
  - grantAiConsent / revokeAiConsent test helpers; createUserWithPantry consents by default
affects: [07-06, 07-07, 07-08, 07-11]
key-files:
  created:
    - backend/prisma/migrations/20261014070000_store_readiness/migration.sql
    - backend/src/modules/ai/ai-consent.constants.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/tests/helpers/ai-test-helpers.ts
decisions:
  - kind/reason on AiReport are plain String (no Prisma enums) to keep migration purely additive
metrics:
  tasks: 3
  completed: 2026-10-10
---

# Phase 7 Plan 01: Store Readiness Foundation Summary

Local Postgres 16 plus an additive migration (AI consent columns, `ai_reports` table), a consent-version constant, and a consent-by-default AI test helper.

## Commits

- b02563f: feat(07-01): add AI consent columns and ai_reports table
- 8c282da: feat(07-01): add AI consent version constant and consent-by-default test helper
- Task 1 produced no commit (backend/.env is git-ignored and never staged).

## Results

- Postgres: `brew services start postgresql@16`, db `kitcha_dev`, all 12 migrations applied; `migrate diff --exit-code` returns 0 (no drift).
- DMMF one-liner (`Prisma.dmmf.datamodel.models.length`): **15** (measured before the AiReport model was added, so 16 now). Runtime DMMF access works, so plan 06 can use DMMF rather than the schema-text fallback.
- Baseline jest (before changes): 64 suites / 1222 tests passed, 0 failures.
- Final jest: 65 suites / 1223 tests passed (one suite was added in the tree by a parallel executor). The six AI suites pass: 52 tests.
- `npx tsc --noEmit` clean.

## Deviations from Plan

**[Rule 3 - Blocking] Prisma CLI banner in migration output.** `prisma migrate diff --script` wrote the "Update available" box to stdout, so the first generated file was polluted. I first stripped it with sed, which also removed the AlterTable block, and applied the partial migration locally. I rewrote migration.sql with the exact generated SQL (clean of the banner), dropped the locally created `ai_reports` table and its `_prisma_migrations` row, and re-ran `migrate deploy`. The committed SQL is correct and verified drift-free. This affected the local DB only.

## Known Stubs

None.

## Threat Flags

None. No DROP/RENAME/ALTER COLUMN/SET NOT NULL in the migration; the DB used is localhost only; backend/.env is ignored and not staged.

## Self-Check: PASSED

Migration, constant, helper files exist; commits b02563f and 8c282da exist.
