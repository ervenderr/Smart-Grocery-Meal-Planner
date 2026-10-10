---
phase: 08-offline-sync-backend
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - backend/src/middleware/idempotency.middleware.ts
  - backend/src/modules/idempotency/idempotency.store.ts
  - backend/src/modules/idempotency/idempotency.hash.ts
  - backend/src/modules/idempotency/idempotency.cleanup.ts
  - backend/src/modules/auth/refresh-token.service.ts
  - backend/src/modules/auth/auth.controller.ts
  - backend/src/modules/users/account-deletion.service.ts
  - backend/src/modules/users/users.service.ts
  - backend/src/config/cors.config.ts
  - backend/src/middleware/rateLimiter.ts
  - backend/src/modules/sync/sync.service.ts
  - backend/src/modules/pantry/pantry.service.ts
  - backend/src/modules/shopping/shopping.service.ts
  - backend/src/modules/pantry/pantry.adjust.ts
  - backend/src/modules/shopping/shopping-finish.service.ts
  - backend/src/modules/shopping/shopping.receipt-window.ts
  - frontend/lib/api/session-refresh.ts
  - frontend/lib/api/token-storage.ts
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard (deep on refresh tokens, idempotency, client-id ownership, CORS, rate limits, account deletion)
**Files Reviewed:** 18 (security-sensitive files read in full; test files, migration SQL, types and remaining shopping/pantry plumbing were only spot-checked)
**Status:** issues_found

## Summary

The security-sensitive pieces are mostly sound. Refresh tokens are CSPRNG, stored hashed, rotated in a transaction, and family revocation survives the throw. Client-id ownership is checked in pantry and shopping. Sync cursors are strictly validated. Account deletion locks the user row. CORS native origins are exact matches, and the Vercel preview regex is tightened. The main defect is in the idempotency middleware: its core promise, that a retry after a flaky network never double-applies, is broken in the exact case it exists for (client disconnect mid-request).

## Critical Issues

### CR-01: Client disconnect releases the idempotency reservation while the handler is still running, so the retry double-applies

**File:** `backend/src/middleware/idempotency.middleware.ts:137-144`
**Issue:** `res.on('close')` fires when the client's socket drops, which is the normal failure mode on mobile and offline-sync. If the socket drops before `res.json` is called, `handled` becomes true and `release(id)` deletes the in_progress row. The handler keeps running and commits its business effect. Because `handled` is now true, the later `res.json` skips `persistOrRelease` and nothing is ever stored. The client retries with the same key, `reserve` succeeds on the freshly deleted row, and the operation runs a second time. This hits non-idempotent endpoints: pantry `adjust` (deltas), cook (pantry decrement), meal-plan mutations, and shopping finish when it is retried concurrently. The same happens when the response is not sent through `res.json` (the `close` path fires after a normal `send`/`end`), but no current handler in the covered routers does that.
**Fix:** Do not release on `close`. Leave the row in_progress, so a retry gets 409 IN_FLIGHT and then the stored result, and let the handler complete the row when it responds. Rely on the stale-takeover timeout for true crashes. Keep the `res.json` wrapper persisting even after `close`:
```ts
res.json = ((body?: unknown): Response => {
  if (handled) return originalJson(body);
  handled = true;
  void persistOrRelease(id, userId, route, res.statusCode, body).then(() => {
    if (!res.writableEnded && !res.destroyed) originalJson(body);
  });
  return res;
}) as Response['json'];
// remove the res.on('close', release) branch entirely
```
(If a non-json send path must be supported, wrap `res.end` the same way instead of releasing on close.)

## Warnings

### WR-01: Query string is excluded from the idempotency request hash

**File:** `backend/src/middleware/idempotency.middleware.ts:168-174`
**Issue:** `route` is `req.baseUrl + req.path`, so `?x=` parameters are not hashed. The same key with the same body but different query parameters replays the first response instead of returning 422 KEY_REUSED. This silently returns a wrong result for any POST/PATCH that takes query options.
**Fix:** Include the canonicalised query in the hash input, for example `computeRequestHash(req.method, route, { body: req.body, query: req.query })`. Update `idempotency.hash.ts` and its tests accordingly.

### WR-02: Stale takeover can run a second copy while the first is still executing

**File:** `backend/src/middleware/idempotency.middleware.ts:76-89`, `backend/src/modules/idempotency/idempotency.constants.ts:12`
**Issue:** An in_progress row older than 120 s is taken over. Finish uses a 15 s transaction timeout, but nothing bounds other handlers (DB lock waits, slow external calls). The original handler may still commit and then call `complete()` on a row it no longer owns. That `complete` is keyed only by `id`, so it overwrites the new owner's state.
**Fix:** Make `complete` and `release` conditional on the claim, for example a `claimToken` or the `createdAt` written by `takeOver`, and ignore a lost claim. Also make sure the stale threshold exceeds the maximum request time (server request timeout).

### WR-03: A failed completion write leaves the key in_progress and the response is still sent

**File:** `backend/src/middleware/idempotency.middleware.ts:115-122, 133`
**Issue:** If `complete()` throws (DB blip), the error is only logged and `originalJson(body)` still sends the 2xx. Retries then get 409 IN_FLIGHT for up to 120 s, and after that a stale takeover re-executes the operation. This is the accepted residual from A3 but is wider than described: it needs only a transient DB error, not a process crash.
**Fix:** Retry `complete` once or twice with a short backoff. If it still fails, best-effort delete the row only when the business effect is known to be non-repeatable. Alternatively document this case explicitly alongside A3.

### WR-04: Refresh tokens have no absolute lifetime and no per-user cap

**File:** `backend/src/modules/auth/refresh-token.service.ts:61, 118`; `backend/src/modules/auth/auth.service.ts:103, 254`
**Issue:** Each rotation issues a fresh `ttlDays` (default 90) from `now`, so a stolen-but-kept-alive token family never expires. Every login also creates a new family with no limit, and successful logins are not rate-limited (`skipSuccessfulRequests`), so token rows can grow without bound until the daily prune.
**Fix:** Store the family's `createdAt` (or `familyExpiresAt`). Cap successor expiry at `min(now + ttl, familyCreatedAt + MAX_FAMILY_DAYS)`. Optionally revoke the oldest families past N per user at login.

### WR-05: Password change is not atomic and does not invalidate outstanding access tokens

**File:** `backend/src/modules/users/users.service.ts:263-270`
**Issue:** `user.update` and `revokeAllForUser` are separate statements. A failure between them leaves the new password set while all old refresh tokens stay valid. Even when both succeed, access JWTs stay valid for the full `JWT_EXPIRES_IN`. The summary notes production keeps 7d until the frontend ships, so an attacker holding a stolen access token keeps access for up to 7 days after a password change.
**Fix:** Wrap both in `prisma.$transaction` (pass `tx` as the `client` argument, which `revokeAllForUser` already supports). Consider a `tokenVersion` or `passwordChangedAt` claim check in `authenticate`. Shorten the production JWT expiry as soon as SYNC-07 is deployed.

### WR-06: Account deactivation does not revoke refresh tokens

**File:** `backend/src/modules/users/users.service.ts:294-322`
**Issue:** Deactivation only flips `isActive`. Rotation does reject inactive users, but reactivation (admin) would silently resurrect all prior sessions, and the tokens sit unrevoked in the table.
**Fix:** Call `revokeAllForUser(userId, 'inactive', tx)` in a transaction with the update.

### WR-07: Client-id create replays do not compare the payload

**File:** `backend/src/modules/pantry/pantry.service.ts:98-117`, `backend/src/modules/shopping/shopping.service.ts:95-112`
**Issue:** When a client id already exists for the same user, the existing row is returned as `created: false` even if the new request body differs (name, quantity). The outbox then believes its edited create was applied. Pantry also returns 410 for a soft-deleted id, but the shopping replay path can return an item that was carried to or removed from another list (the code comment acknowledges this).
**Fix:** Either compare the immutable fields and return 409 CLIENT_ID_CONFLICT on mismatch, or document that clients must never reuse an id with changed content. Pair this with WR-01 so idempotency covers the common case.

## Info

### IN-01: Refresh token held in localStorage

**File:** `frontend/lib/api/token-storage.ts:6-37`
**Issue:** A 90-day refresh token in `localStorage` is readable by any XSS. The file notes native Keychain storage arrives in Phase 10, so this is knowingly temporary. Ensure the web build gets a CSP, and that Phase 10 actually removes the web storage for native.
**Fix:** Track this as a Phase 10 exit criterion.

### IN-02: Shared limiter for refresh and logout, and no limit on successful refreshes

**File:** `backend/src/middleware/rateLimiter.ts:230-243`, `backend/src/modules/auth/auth.routes.ts:91-112`
**Issue:** `refreshLimiter` is one instance, and therefore one counter per IP, for both routes. Malformed logout bodies (400) eat into the refresh failure budget behind a shared NAT. Successful refreshes are unlimited and each creates a row, which feeds the growth noted in WR-04.
**Fix:** Use separate limiter instances, and add a generous per-IP cap on successful refreshes.

### IN-03: Client-id existence oracle and silent no-op cleanup

**File:** `backend/src/modules/pantry/pantry.service.ts:100-105`; `backend/src/modules/idempotency/idempotency.cleanup.ts:53-69`
**Issue:** A foreign user's id returns `CLIENT_ID_CONFLICT`, which confirms a UUID exists. This is low risk because UUIDs are unguessable, but it differs from the 404 policy elsewhere. Separately, `initializeSyncCleanup` swallows a missing `node-cron` as a warning, so cleanup could be disabled in production unnoticed. Use a static import and fail loudly.
**Fix:** Keep the 409 (it is needed for client behaviour). Replace the `require` with a top-level `import cron from 'node-cron'`.

### IN-04: Shopping receipt window / occurredAt clamp is silent

**File:** `backend/src/modules/shopping/shopping.receipt-window.ts:29-37`
**Issue:** Out-of-range `occurredAt` is clamped without telling the client, so an offline trip older than 14 days is recorded as "now" with no signal. The decision is documented in the summary, but the response has no flag (compare the `clamped` flag on adjust).
**Fix:** Return `occurredAtClamped: true` in the finish response so the UI can surface it.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Re-review (iteration 1)

**Scope:** `fix(08)` commits 0cf0f42..df061c2 (idempotency middleware/store/hash, refresh-token service, users.service, pantry/shopping replay guard, client-id-replay).
**New findings:** critical 0, warning 2, info 1.

CR-01 (no release on disconnect), WR-01/02/03 (claim-guarded complete, UTC insert, completion retry), WR-05 and WR-06 were checked and hold. The claim token (`created_at`) is written with the same millisecond value by `reserve` and `takeOver`, and `complete`/`release` match on it.

### WR-08: Family absolute-lifetime cap is defeated by token pruning

**File:** `backend/src/modules/auth/refresh-token.service.ts:103-110, 162-163`; `backend/src/modules/idempotency/idempotency.cleanup.ts:8, 26-27`
**Issue:** `familyStart` uses `MIN(createdAt)` over the family's surviving rows. The daily prune deletes rotated rows 7 days after `revokedAt`, so the family origin row disappears and the computed start drifts forward. The 180-day cap (`MAX_FAMILY_DAYS`) therefore never triggers for an actively rotated family, and WR-04's main goal (a kept-alive stolen family eventually dies) is not met.
**Fix:** Persist the start on the row. Add a `familyStartedAt` column, copied from the predecessor on rotation and set to `now` for a new family. Compute the cap from it instead of the aggregate. As a stopgap, exclude the newest row of each family from pruning and carry the start forward.

### WR-09: Client-id replay compare gives false 409s and is bypassable by a time heuristic

**File:** `backend/src/modules/sync/client-id-replay.ts:34-38`
**Issue:** The compare is skipped when `updatedAt - createdAt > 1000 ms`, and enforced otherwise. A legitimate create replay that arrives after the offline client's own update within 1 s (outbox flushing create then update back to back) sees a differing name and gets 409 CLIENT_ID_CONFLICT, which an outbox will likely treat as a permanent failure. Conversely, any different-content replay after 1 s of row age is silently accepted as `created: false`, so WR-07's "edited create believed applied" case remains for edits that follow the original row by more than 1 s.
**Fix:** Do not infer from timestamps. Store a hash of the create payload (or `createdFromHash`) on the row, and compare that hash on replay.

### IN-05: Responses not sent through `res.json` leave the key in_progress

**File:** `backend/src/middleware/idempotency.middleware.ts:156-172`
**Issue:** Only `res.json` is instrumented. A handler that replies via `res.send`/`res.end`/`res.status(204).end()` never completes or releases, so retries get 409 IN_FLIGHT until the 120 s stale takeover, then re-execute.
**Fix:** Wrap `res.send`/`res.end` too, or ensure idempotent routes only use `res.json`, and add a `res.on('finish')` fallback that releases the claim if `handled` is still false.
