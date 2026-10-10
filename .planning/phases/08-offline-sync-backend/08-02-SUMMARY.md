---
phase: 08-offline-sync-backend
plan: 02
subsystem: api, security
tags: [cors, capacitor, rate-limit, idempotency]
requires: []
provides:
  - NATIVE_APP_ORIGINS (capacitor://localhost, ionic://localhost) always allowed, exact match
  - CORS allows Idempotency-Key; exposes Idempotency-Replayed, Retry-After, RateLimit-Reset
  - isUserScopedApiRequest, createUserScopedLimiter, pantryLimiter, syncLimiter, refreshLimiter
affects: [08-06 (refreshLimiter), 08-08 (syncLimiter)]
key-files:
  modified:
    - backend/src/config/cors.config.ts
    - backend/src/middleware/rateLimiter.ts
    - backend/src/modules/pantry/pantry.routes.ts
    - backend/tests/cors.test.ts
    - backend/tests/rate-limiter.test.ts
key-decisions:
  - "Native origins are a code constant (env parseOrigin accepts only http(s)); android https://localhost excluded"
  - "createShoppingLimiter reimplemented on createUserScopedLimiter, behaviour unchanged"
requirements-completed: [SYNC-04, SYNC-01, SYNC-06]
duration: 10min
completed: 2026-10-10
---

# Phase 8 Plan 02: CORS for Capacitor and per-user limiters Summary

Capacitor/Ionic WebView origins pass CORS with Idempotency-Key preflight allowed, and authenticated pantry/sync/shopping traffic is limited per user (600/300 per 15 min) instead of by the 100/15min IP limiter; a 30/15min refresh limiter is exported.

## Commits

- 3db6a35 feat(08-02): CORS native origins and idempotency headers
- 1548c6a feat(08-02): per-user pantry/sync limiters and refresh limiter

## Verification

- jest cors, rate-limiter, rate-limiter-notifications, pantry: 78 passed (TDD RED confirmed first for both tasks).
- `tsc --noEmit`: exit 0. rateLimiter.ts is 323 lines.
- A first run of the notification/rate-limiter suites failed with empty errors under concurrent DB load; rerun passed.

## Deviations from Plan

None.

## Self-Check: PASSED
