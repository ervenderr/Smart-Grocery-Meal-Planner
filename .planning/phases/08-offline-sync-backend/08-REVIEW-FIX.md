---
phase: 08
fixed_at: 2026-10-10T00:00:00Z
review_path: .planning/phases/08-offline-sync-backend/08-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Source review:** `.planning/phases/08-offline-sync-backend/08-REVIEW.md`
**Scope:** CR-01, WR-01..WR-07 (Info findings not in scope)

**Summary:** 8 in scope, 8 fixed (3 with a documented deferred remainder), 0 skipped. No schema migration was needed.

## Fixed Issues

### CR-01: Client disconnect released the idempotency reservation
**Commit:** 0cf0f42 | **Files:** `backend/src/middleware/idempotency.middleware.ts`, `backend/tests/idempotency-disconnect.test.ts`
Removed the `res.on('close')` release. The handler finishes and persists completion; the response is only written if the socket is still open. Real-DB test aborts the client mid-request, checks a concurrent retry gets 409 without re-running, the row ends `completed`, and the next retry replays (confirmed to fail without the fix).

### WR-01: Query string missing from request hash
**Commit:** 75aca06 | **Files:** `idempotency.hash.ts`, `idempotency.middleware.ts`, `tests/idempotency.test.ts`, `tests/idempotency-hash.test.ts`
Canonicalised query is hashed when non-empty (empty query hashes as before, so stored keys stay valid). Same key with a different query now returns 422.

### WR-02: Stale takeover / non-owner complete overwrote the new owner
**Commit:** 849974a | **Files:** `idempotency.store.ts`, `idempotency.middleware.ts`, `tests/idempotency-claim.test.ts`
`complete`/`release` are now conditional on `(id, createdAt = claim token, status = in_progress)` and `complete` reports a lost claim. While adding this, found that raw `reserve` stored timestamps in the DB session time zone (non-UTC in dev, Asia/Manila), unlike Prisma's UTC writes; fixed with `::timestamptz AT TIME ZONE 'UTC'` (also corrects expiry comparisons on non-UTC hosts).
**Deferred:** no explicit upper bound on handler runtime; the 120 s stale threshold is unchanged. Operational follow-up: add a server/handler timeout below it if long handlers appear.

### WR-03: Failed completion write left the key in_progress
**Commit:** 1ad6ea9 | **Files:** `idempotency.middleware.ts`, `tests/idempotency-claim.test.ts`
Completion is retried twice (50 ms, 200 ms backoff). Test injects one failure and asserts the row still completes.
**Deferred:** persistent DB outage past the retries is still the documented A3 residual (recorded in the middleware header).

### WR-04: No absolute refresh lifetime / per-user cap
**Commit:** 92c338e | **Files:** `refresh-token.service.ts`, `tests/refresh-token-limits.test.ts`
Family start is derived from the earliest token in the family (no migration). Successor expiry is capped at start + 180 days and rotation is refused past it. A new family evicts the least-recently-rotated active families beyond 10 per user (reason `family_cap`).
**Deferred:** limits are constants, not env config; per-IP cap on successful refreshes (IN-02) untouched.

### WR-05: Password change not atomic
**Commit:** 5bb86cd | **Files:** `users.service.ts`, `tests/users-token-revocation.test.ts`
Password update and refresh revocation run in one transaction; test injects a revocation failure and shows the old password still works.
**Deferred:** invalidating already-issued access JWTs (needs a `passwordChangedAt`/`tokenVersion` column plus an `authenticate` check, i.e. a migration and auth-path change). Mitigation: shorten production `JWT_EXPIRES_IN` once the refresh flow ships in the frontend.

### WR-06: Deactivation did not revoke refresh tokens
**Commit:** 3bee724 | **Files:** `users.service.ts`, `tests/users-token-revocation.test.ts`
Deactivation and `revokeAllForUser(..., 'inactive')` run atomically; tests cover success and rollback.

### WR-07: Client-id create replays ignored payload
**Commit:** df061c2 | **Files:** `sync/client-id-replay.ts` (new), `pantry.service.ts`, `shopping.service.ts`, `tests/pantry-client-ids.test.ts`, `tests/shopping-client-ids.test.ts`
A replay whose name/unit/quantity (only supplied fields) differ from the stored row returns 409 `CLIENT_ID_CONFLICT`. Comparison is skipped when the row was modified after creation (updatedAt more than 1 s past createdAt), since a stale create replay is legitimate then. Two existing tests that asserted "changed replay returns the original" were updated to the new contract.
**Deferred:** shopping replay of an item carried to another list after finish (Phase 11 outbox concern, already noted in code).

## Test Results

- `tsc --noEmit`: clean
- `npm run lint`: 0 errors (172 pre-existing warnings)
- Affected suites (idempotency*, refresh-token*, auth-refresh, auth, users*, pantry/shopping client-ids): all pass
- Full backend jest: 87/87 suites, 1460/1460 tests pass. One earlier full run showed 2 failures in `tests/account-deletion.test.ts` that did not reproduce in isolation or on the next full run (appears to be load/timing flake in parallel; not touched by these changes).

---

_Fixer: Claude (gsd-code-fixer)_

## Iteration 2

**Fixed at:** 2026-10-10
**Scope:** WR-08, WR-09, IN-05 (re-review iteration 1). 3 in scope, 3 fixed, 0 skipped.

### WR-08: Family absolute-lifetime cap defeated by token pruning

**Commit:** 171b079
**Files:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261016000000_refresh_token_family_started_at/migration.sql`, `backend/src/modules/auth/refresh-token.service.ts`, `backend/tests/refresh-token-limits.test.ts`
**Fix:** Additive migration adds nullable `refresh_tokens.family_started_at` (applied to the local DB; no drops). `issueRefreshToken` persists `familyStartedAt` (now for a new family, copied forward on rotation). The 180-day cap reads `row.familyStartedAt ?? row.createdAt`; the MIN(createdAt) aggregate is gone. Tests: pruned-predecessor regression (cap still triggers after rotated rows are deleted) and a legacy-null fallback test; existing WR-04 tests now age `familyStartedAt`. Account-deletion suite passes. Status: fixed, requires human verification (logic change; legacy rows only get a precise origin once rotated, until then createdAt is used).

### WR-09: Client-id replay false 409s / timestamp heuristic

**Commit:** 48198f1
**Files:** `backend/src/modules/sync/client-id-replay.ts` (deleted), `backend/src/modules/pantry/pantry.service.ts`, `backend/src/modules/shopping/shopping.service.ts`, `backend/tests/pantry-client-ids.test.ts`, `backend/tests/shopping-client-ids.test.ts`
**Fix:** Removed the 1-second heuristic and payload comparison. A same-owner create replay returns the existing row unchanged (200, `created: false`); other-owner (409) and soft-deleted (410) handling is unchanged. Tests restored to "replay with different payload returns the original row" and a new test that a stale create replay after a later edit returns the edited row instead of 409. Comments updated.
**Note:** Payload-mismatch detection for client-id creates is deliberately deferred to the Idempotency-Key middleware (request-hash mismatch); a different-content replay under a new/no Idempotency-Key is silently treated as a replay. This supersedes the WR-07 fix behaviour.

### IN-05: Non-json responses leave key in_progress

**Commit:** a9733ec
**Files:** `backend/src/middleware/idempotency.middleware.ts`, `backend/tests/idempotency-non-json.test.ts` (new)
**Fix:** Added a `res.once('finish')` fallback that releases the claim when `res.json` never ran (res.send/res.end/204). `finish` is used rather than `close` so a client disconnect mid-handler still keeps the reservation (CR-01). Such responses are not cached, so retries re-execute. Test covers a 204 handler.

### Verification

- `tsc --noEmit`: clean; lint: 0 errors (warnings only, pre-existing)
- Full backend jest: 88/88 suites, 1462/1462 tests pass (no account-deletion flake this run)
- Work was done directly on `main` (no separate worktree) because the local DB, node_modules and migration application are needed; only explicitly staged paths were committed.

_Iteration: 2_
