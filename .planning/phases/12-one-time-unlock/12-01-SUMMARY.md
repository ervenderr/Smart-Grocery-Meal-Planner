---
phase: 12-one-time-unlock
plan: 01
subsystem: backend
tags: [iap, entitlements, prisma, config, account-deletion]
requires: []
provides:
  - config.iap, config.entitlements, config.ai paid limits
  - entitlements and app_store_notifications tables (additive migration)
  - isEntitled / getEntitlementSummary
  - grantTestEntitlement / revokeTestEntitlement test helpers
affects: [12-06, 12-07, 12-08, 12-09]
tech-stack:
  added: []
  patterns: [env-overridable limits, DB-level purchase uniqueness]
key-files:
  created:
    - backend/prisma/migrations/20261017000000_entitlements/migration.sql
    - backend/src/modules/entitlements/entitlements.constants.ts
    - backend/src/modules/entitlements/entitlement-status.ts
    - backend/tests/entitlement-status.test.ts
    - backend/tests/helpers/entitlement-fixtures.ts
  modified:
    - backend/src/config/env.schema.ts
    - backend/src/config/env.config.ts
    - backend/tests/env.schema.test.ts
    - backend/prisma/schema.prisma
    - backend/src/modules/users/account-deletion.service.ts
    - backend/tests/helpers/user-owned-fixtures.ts
    - backend/tests/account-deletion.test.ts
key-decisions:
  - "Unique (environment, original_transaction_id) globally, plus (user_id, product_id), so one purchase cannot unlock many accounts"
  - "Paid AI 40/day + 600/month, free unchanged (monthly disabled); all env-overridable"
requirements-completed: [SUB-02]
duration: n/a
completed: 2026-10-11
---

# Phase 12 Plan 01: Entitlement foundation Summary

Config keys, additive entitlements migration, status reader, test fixtures and account-deletion coverage for the one-time unlock.

## Commits
- c904bbe: env config (IAP keys, free pantry limit 25, paid AI limits, production guard for IAP_ALLOW_XCODE_ENV)
- d761f8b: Entitlement + AppStoreNotification schema/migration, isEntitled, getEntitlementSummary, constants, fixtures
- f96bc79: account deletion removes entitlements and `usermonth:<id>` ai_usage rows

## Tests
- env.schema: 53 passed; entitlement-status: 7 passed; account-deletion: 8 passed (incl. DMMF completeness with Entitlement)
- Combined run: 3 suites, 70 tests passing. `tsc --noEmit` clean; lint 0 errors (existing warnings only).
- Migration applied to local dev DB; `prisma migrate diff` against schema shows no drift.

## Deviations from Plan
None in behavior. Notes: the account-deletion test also exercises `usermonth:` seeding via `seedAiUsage`/`countAiUsage` in the shared fixture, so the existing all-rows test covers the monthly scope. A transient network error interrupted execution after Task 2 work; resumed and committed without changes to completed work.

## Known Stubs
None.

## Self-Check: PASSED
