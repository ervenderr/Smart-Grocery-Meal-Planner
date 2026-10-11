---
phase: 12-one-time-unlock
plan: 06
subsystem: backend
tags: [iap, entitlements, verify, claim, idempotency]
requires: [12-01, 12-02]
provides:
  - POST /api/v1/entitlements/verify and GET /api/v1/entitlements/me
  - verifyAndClaim, getMe, applyVerifiedTransaction (reusable by the 12-09 webhook)
  - getAppleVerifier / setAppleVerifierForTests / resetAppleVerifierForTests
affects: [12-09, 12-11]
tech-stack:
  added: []
  patterns: [lazy injectable verifier, P2002 race mapped to 409, stale signedDate ignored]
key-files:
  created:
    - backend/src/modules/entitlements/entitlements.deps.ts
    - backend/src/modules/entitlements/entitlements.service.ts
    - backend/src/modules/entitlements/entitlements.validation.ts
    - backend/src/modules/entitlements/entitlements.controller.ts
    - backend/src/modules/entitlements/entitlements.routes.ts
    - backend/tests/entitlements-claim.test.ts
    - backend/tests/entitlements-verify.test.ts
  modified:
    - backend/src/app.ts
key-decisions:
  - "Restore is POST /verify with the device's current entitlement JWS; no separate endpoint"
  - "A different purchase never replaces an existing ACTIVE entitlement for the same user (returns current row)"
requirements-completed: [SUB-01, SUB-02]
completed: 2026-10-11
---

# Phase 12 Plan 06: Entitlement verify and claim Summary

Server source of truth for the one-time unlock: re-verifies a StoreKit 2 JWS, claims it for exactly one account, stores or updates the Entitlement row, and reports status plus effective limits.

## Commits
- 3266a2f: deps + service (verifyAndClaim, applyVerifiedTransaction, getMe) and service tests
- 3507f46: validation, controller, routes, app.ts mount, HTTP tests

## Tests
- entitlements-claim: 11 passed (including concurrent two-user claim: exactly one 409, one row)
- entitlements-verify: 13 passed (auth, strict body validation x5, replay with Idempotency-Replayed, 409, revoked, 400 without leakage, 429 ENTITLEMENT_RATE_LIMITED after 30)
- Combined: 2 suites, 24 tests passing. `tsc --noEmit` clean; eslint on all touched files 0 errors.
- Full `npm run lint` reports 1 error in a pre-existing file (`src/middleware/errorHandler.ts:66`, no-loss-of-precision), not touched by this plan and left alone (out of scope).

## Deviations from Plan
- [Rule 2 - Safety] Added guard in applyVerifiedTransaction: a different purchase (different environment/originalTransactionId) cannot overwrite an existing ACTIVE entitlement of the same user; the current row is returned. Prevents a Sandbox JWS from replacing a Production unlock via the (userId, productId) upsert.
- P2002 handling: after a unique violation the service re-reads the winner; same user returns the row (idempotent), another user gets 409.
- Tests were written alongside the service in one pass, so the RED run was "module missing" rather than a separate failing-test commit.
- No `entitlements.mapper.ts` split was needed (service ~190 lines).
- Nothing deployed.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
