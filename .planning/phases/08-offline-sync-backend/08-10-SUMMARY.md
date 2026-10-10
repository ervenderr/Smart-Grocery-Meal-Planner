---
phase: 08-offline-sync-backend
plan: 10
subsystem: frontend-auth
tags: [refresh-token, single-flight, axios-interceptor]
requires: [08-06]
provides:
  - Silent single-flight token refresh on 401 with one retry
  - Session cleared only on definitive (401/403) refresh refusal
key-files:
  created:
    - frontend/lib/api/token-storage.ts
    - frontend/lib/api/session-refresh.ts
    - frontend/lib/api/session-refresh.test.ts
  modified:
    - frontend/lib/api/client.ts
    - frontend/lib/api/auth.ts
    - frontend/lib/constants/api-routes.ts
    - frontend/types/auth.types.ts
    - frontend/lib/stores/auth-store.ts
    - frontend/lib/auth/use-logout.ts
    - frontend/components/auth/login-form.tsx
    - frontend/components/auth/signup-form.tsx
key-decisions:
  - "Refresh uses bare axios.post, never the intercepted instance (no recursion)"
  - "Refresh token is kept in localStorage only, not in persisted zustand state"
requirements-completed: [SYNC-07, SYNC-04]
completed: 2026-10-10
---

# Phase 8 Plan 10: Frontend Silent Refresh Summary

A 401 now triggers one shared refresh and a single retry; transient refresh failures (network, timeout, 5xx, 429) keep tokens and local state, and only a 401/403 from `/auth/refresh` (or no stored refresh token) clears the session and redirects to `/login`.

## Commits

- 30d4ab5 feat(08-10): single-flight refresh coordinator and token storage
- bfd8c37 feat(08-10): wire silent refresh into interceptor, auth store, forms, logout

## Verification

- `vitest run lib/api`: 14 tests passed (single-flight, retry with new bearer, transient preserve, definitive clear, `_retry` guard, auth URL skip, no stored token).
- Full `vitest run`: 66 files, 871 tests passed. `tsc --noEmit` clean. eslint: 0 errors (pre-existing `any` warnings only).

## Deviations

None. Deploy note: Railway `JWT_EXPIRES_IN` can now be lowered to 1h once this ships.

## Self-Check: PASSED
