---
phase: 08-offline-sync-backend
plan: 05
subsystem: api, idempotency
tags: [idempotency, middleware, cron, offline-sync]
requires: [08-01, 08-02, 08-03]
provides:
  - idempotency middleware mounted on pantry, shopping, mealplan, cook routers
  - pruneExpiredSyncRows and initializeSyncCleanup (daily 03:30 cron)
affects: [08-06, 08-07, 08-08, phase 11 outbox]
key-files:
  created:
    - backend/src/modules/idempotency/idempotency.constants.ts
    - backend/src/modules/idempotency/idempotency.hash.ts
    - backend/src/modules/idempotency/idempotency.store.ts
    - backend/src/modules/idempotency/idempotency.cleanup.ts
    - backend/src/middleware/idempotency.middleware.ts
    - backend/tests/idempotency-hash.test.ts
    - backend/tests/idempotency.test.ts
    - backend/tests/sync-cleanup.test.ts
  modified:
    - backend/src/modules/pantry/pantry.routes.ts
    - backend/src/modules/shopping/shopping.routes.ts
    - backend/src/modules/mealplan/mealplan.routes.ts
    - backend/src/modules/cook/cook.routes.ts
    - backend/src/index.ts
key-decisions:
  - "Only 2xx responses are cached; non-2xx releases the reservation so a corrected retry with the same key works"
  - "Response persisted before it is sent; residual crash window accepted on single replica (research A3)"
requirements-completed: [SYNC-01, SYNC-05]
completed: 2026-10-10
---

# Phase 8 Plan 05: Idempotency Middleware and Cleanup Summary

One generic `idempotency` middleware (reserve via `INSERT ... ON CONFLICT (user_id, key) DO NOTHING`, persist-before-send, replay) mounted after authenticate/limiter on the pantry, shopping (incl. finish), mealplan and cook routers, plus a daily prune of expired keys and stale refresh tokens.

## Idempotency contract

- Request header: `Idempotency-Key` (8..255 chars of `[A-Za-z0-9._:-]`). Optional; absent header or GET/HEAD/OPTIONS means no-op.
- Scope: per authenticated user. Identity = sha256(METHOD + baseUrl+path + canonical key-sorted JSON body).
- Malformed key: 400, `code: IDEMPOTENCY_KEY_INVALID`.
- Same key, different method/route/body: 422, `code: IDEMPOTENCY_KEY_REUSED`.
- Duplicate while first is in flight: 409, `code: IDEMPOTENCY_IN_FLIGHT`, header `Retry-After: 1`.
- Replay of a completed request: original status (2xx) and body, plus header `Idempotency-Replayed: true`.
- Non-2xx first attempts are not cached (reservation deleted); same key can be retried.
- TTL 48 h (`config.idempotency.ttlHours`); expired row treated as absent. In-progress rows older than 120 s are taken over. Stored body cap 512 KB (larger responses are not cached).
- Error bodies use the standard shape (`status`, `statusCode`, `message`, top-level `code`, `error`).
- Deleted user during reserve (FK violation) maps to 401.
- Finish: a retried `POST /shopping/finish` with the same key returns the first 200 (not SHOPPING_LIST_EMPTY), one history row, pantry merged once.

## Commits

- 7beb02d: constants, canonical hash, store (14 unit tests)
- f83fe89: middleware and router mounts (14 integration tests)
- 3a1b7f1: cleanup job and index.ts startup call (2 tests)

## Verification

- `jest idempotency-hash idempotency sync-cleanup`: 30 passed.
- Regression: pantry, mealplan, cook-endpoints suites pass. `shopping-items.test.ts` has 1 failure, "ignores unknown body fields (mass assignment)": it asserts a client-supplied id is ignored, which conflicts with the in-progress client-id (SYNC-03) work by another executor in shopping.service/validation; unrelated to this plan.
- `tsc --noEmit`: only errors are in `auth.service.ts` (AuthResponse refreshToken fields), from the concurrent refresh-token plan, not this one.

## Deviations from Plan

None. `AppError` takes `{ code }` via its options argument (not `details`), used accordingly. The cleanup test runs the global prune, so counts are asserted with `>=`.

## Known Stubs

None.

## Self-Check: PASSED
