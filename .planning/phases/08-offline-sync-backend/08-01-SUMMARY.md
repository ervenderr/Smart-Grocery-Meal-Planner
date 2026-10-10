---
phase: 08-offline-sync-backend
plan: 01
subsystem: database, config
tags: [prisma, migration, refresh-tokens, idempotency, env]
requires: []
provides:
  - idempotency_keys and refresh_tokens tables (Prisma models IdempotencyKey, RefreshToken)
  - config.refreshToken {ttlDays, reuseGraceSeconds}, config.idempotency {ttlHours}
  - JWT_EXPIRES_IN default 1h
affects: [08-02, later 08 plans]
tech-stack:
  added: []
  patterns: [additive migration, FK cascade plus explicit deleteMany]
key-files:
  created:
    - backend/prisma/migrations/20261015000000_offline_sync/migration.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/tests/helpers/user-owned-fixtures.ts
    - backend/src/modules/users/account-deletion.service.ts
    - backend/src/config/env.schema.ts
    - backend/src/config/env.config.ts
    - backend/tests/env.schema.test.ts
    - backend/.env.example
key-decisions:
  - "Migration SQL generated with prisma migrate diff; only CREATE TABLE/INDEX and cascade FKs"
  - "Production keeps JWT_EXPIRES_IN=7d until the frontend refresh logic (SYNC-07) is deployed"
requirements-completed: [SYNC-01, SYNC-04]
duration: 10min
completed: 2026-10-10
---

# Phase 8 Plan 01: Offline Sync Data and Config Foundation Summary

Additive migration for `idempotency_keys` and `refresh_tokens` (both ON DELETE CASCADE to users), account-deletion coverage for both, and env/config keys for refresh TTL, reuse grace and idempotency TTL.

## Tasks

1. Models, migration `20261015000000_offline_sync`, fixtures/counters, explicit deletes in the deletion transaction: commit ad73b42.
2. Config (TDD): RED commit (failing env tests), GREEN commit ffae9b8. Defaults: refresh TTL 90d (1..365), grace 60s (0..300), idempotency 48h (1..168), access token 1h; explicit 7d still accepted.

## Verification

- `prisma migrate status`: schema up to date.
- `jest tests/account-deletion.test.ts tests/env.schema.test.ts`: 51 passed (includes DMMF completeness test).
- `tsc --noEmit`: exit 0.

## Deviations from Plan

None. Note for later plans: `auth.service.ts` still hard-codes `'7d'` in the returned `expiresIn`; the refresh-token plan should derive it from `config.jwt.expiresIn` (per research).

## Self-Check: PASSED
