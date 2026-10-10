---
phase: 08-offline-sync-backend
plan: 06
subsystem: auth
tags: [refresh-tokens, jwt, rotation, rate-limit]
requires: [08-01, 08-02]
provides:
  - POST /api/v1/auth/refresh (rotating refresh tokens, 60s reuse grace)
  - Revoking POST /api/v1/auth/logout
  - refreshToken/refreshExpiresAt on login and signup
key-files:
  created:
    - backend/src/modules/auth/refresh-token.service.ts
    - backend/src/modules/auth/refresh-token.validation.ts
    - backend/tests/refresh-token.service.test.ts
    - backend/tests/auth-refresh.test.ts
  modified:
    - backend/src/modules/auth/auth.service.ts
    - backend/src/modules/auth/auth.controller.ts
    - backend/src/modules/auth/auth.routes.ts
    - backend/src/modules/users/users.service.ts
    - backend/src/types/auth.types.ts
    - backend/tests/auth.test.ts
key-decisions:
  - "Failure outcomes are returned from the rotation transaction and thrown after commit, so family revocation on reuse is not rolled back"
  - "Grace window uses the injected now, enabling deterministic tests"
requirements-completed: [SYNC-04]
completed: 2026-10-10
---

# Phase 8 Plan 06: Refresh Tokens Summary

Rotating, sha256-hashed, revocable refresh tokens with a 60 s reuse grace window; login/signup are additively backwards compatible.

## Commits

- 828971a feat(08-06): refresh-token service with rotation and reuse grace
- 0ce7d6e feat(08-06): /auth/refresh, revoking logout, password-change revocation

## Verification

- jest refresh-token.service, auth-refresh, auth, users, account-deletion: 82 passed. `tsc --noEmit` clean.

## Refresh API contract

- `POST /api/v1/auth/refresh` body `{ "refreshToken": string(20-200, [A-Za-z0-9_-]) }`, strict (extra keys rejected).
  - 200 `{ token, expiresIn, refreshToken, refreshExpiresAt (ISO) }`
  - 400 code `VALIDATION_ERROR`; 401 code `REFRESH_TOKEN_INVALID` (unknown/expired/logout/password/inactive; message "Invalid or expired refresh token") or `REFRESH_TOKEN_REUSED` (rotated token replayed after grace; whole family revoked); 429 `AUTH_REFRESH_RATE_LIMITED` (30 failed/15 min/IP).
- `POST /api/v1/auth/logout` body optional `{ refreshToken }`; no auth header needed; 200 `{ message: "Logout successful" }` always for well-formed bodies; 400 for malformed.
- Login/signup add `refreshToken` (43 chars) and `refreshExpiresAt` (ISO); `expiresIn` = `config.jwt.expiresIn`.
- Password change revokes all user refresh tokens; account deletion removes rows (cascade, 08-01). DELETE /users/me returns 204.

## Deviations

None. Deploy note: keep Railway `JWT_EXPIRES_IN=7d` until the frontend refresh logic (08-10) is live, then lower it. Default is now `1h`.

## Self-Check: PASSED
