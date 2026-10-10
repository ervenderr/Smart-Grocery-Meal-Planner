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
