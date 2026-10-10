---
phase: 8
slug: offline-sync-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-10
---

# Phase 8 — Validation Strategy

See the Validation Architecture section of 08-RESEARCH.md for the requirement-to-test map and Wave 0 gaps.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | jest (backend, real local Postgres), jest/vitest per frontend config |
| Quick run command | `cd backend && npx jest <changed test files>` |
| Full suite command | `cd backend && npm test` and `cd backend && npx tsc --noEmit && npm run lint` |

## Sampling Rate

- After every task commit: quick run for the touched tests
- After every wave: full backend suite
- Before verify-work: full suite green, coverage >= 80% on new files

## Wave 0 Requirements

- Test fixtures for RefreshToken and IdempotencyKey in tests/helpers/user-owned-fixtures.ts (DMMF completeness test)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|-----------|
| Production TTL change and deploy order | SYNC-04/07 | Deploy is out of scope (no push) |
