---
phase: 12-one-time-unlock
reviewed: 2026-10-11T12:47:12Z
depth: standard
iteration: 2
scope: fix commits c035984..ba562c5 (12-REVIEW-FIX.md)
files_reviewed: 22
files_reviewed_list:
  - backend/prisma/migrations/20261018000000_app_store_revocations/migration.sql
  - backend/prisma/schema.prisma
  - backend/src/modules/entitlements/revocation-tombstone.ts
  - backend/src/modules/entitlements/entitlement-lock.ts
  - backend/src/modules/entitlements/entitlements.service.ts
  - backend/src/modules/entitlements/notifications.service.ts
  - backend/tests/entitlements-concurrency.test.ts
  - mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift
  - mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/StoreMapping.swift
  - frontend/lib/native/store/store-service.ts
  - frontend/lib/native/store/store-plugin.ts
  - frontend/lib/native/store/mock-store.ts
  - frontend/lib/hooks/use-store-transaction-updates.ts
  - frontend/lib/hooks/use-entitlement-recheck.ts
  - frontend/lib/hooks/use-entitlement.ts
  - frontend/lib/entitlements/recheck-controller.ts
  - frontend/lib/entitlements/refresh.ts
  - frontend/lib/entitlements/view-model.ts
  - frontend/lib/entitlements/copy.ts
  - frontend/lib/entitlements/upgrade-error.ts
  - frontend/lib/offline/status/describe-op.ts
  - frontend/components/entitlements/entitlement-runtime.tsx
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 12: Code Review Report (iteration 2, fix commits)

**Reviewed:** 2026-10-11T12:47:12Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This pass covers only the eight fix commits (c035984 through a0b754e). The requested focus areas came out as follows:

- **Migration `app_store_revocations`:** Additive only (a single CREATE TABLE with no FK). Its column types and lengths match `entitlements` (VARCHAR(16)/VARCHAR(40), TIMESTAMP(3)), and the Prisma model matches the SQL. The raw upsert handles NULL `revoked_at`/`revocation_reason` correctly, and the `timestamptz AT TIME ZONE 'UTC'` conversion matches how Prisma stores data. No defects.
- **Advisory lock ordering:** No deadlock was found. Every path takes the purchase lock before the user lock. The webhook takes the purchase lock, then re-enters it inside `applyVerifiedTransaction`, then takes the user lock. No path takes the user lock first. The pantry `pantry-cap:` lock uses a separate key namespace and is never held at the same time. Two duplicate webhooks block on the `app_store_notifications` unique insert and do not hold the purchase lock while they wait. No cycle exists.
- **Tombstone vs signedDate:** The rule "tombstone at or after JWS wins" is correct for every ordering of REFUND, REVERSED and claim that the tests cover. The one gap is in WR-03-adjacent territory (see IN-01).
- **Sandbox/Production precedence:** There is one ordering bug (WR-01).
- **Swift listener:** No leak and no harmful double finish. The task is cancelled in `deinit` and holds `self` weakly. `Transaction.finish()` is idempotent. One overlap problem was found on the JS side (WR-02).
- **EntitlementRuntime effects:** No loop. After `refreshEntitlementQueries` refetches, `serverReady` stays true (data is kept, `isPlaceholderData` is false), so the effect deps do not change. The entitlement query is not persisted to SQLite (`cache-keys.ts` PERSISTED_ROOTS), so `serverReady` really does mean the data came from the server.

No Critical issues.

## Warnings

### WR-01: Production-over-Sandbox precedence is gated by a cross-purchase signedDate check, and the client then finishes the unrecorded Production transaction

**File:** `backend/src/modules/entitlements/entitlements.service.ts:101-108` (with `frontend/lib/native/store/store-service.ts:69-87`)
**Issue:** `mayReplace` runs `verified.signedDate < existing.lastSignedAt` before the environment rules. When `existing` is a different purchase (a Sandbox row) and `verified` is a real Production purchase, this compares the signed dates of two unrelated purchases. A Production JWS signed earlier than the Sandbox row's `lastSignedAt` is rejected. Example: a Production purchase on another device (its cached JWS comes from `currentEntitlements`), followed by a later TestFlight purchase or a later Sandbox webhook. The server returns 200 with the Sandbox view, and `verifyAndFinish` finishes the Production transaction because of the 2xx. The real purchase is then never recorded for this account. The account stays on a Sandbox row, which can be revoked or wiped. The Production purchase also stays claimable by any other Kumaun account on that Apple ID. The WR-01 test for "Production purchase supersedes an active Sandbox one" only uses a newer Production JWS.
**Fix:** Only apply the signedDate ordering to the same purchase, and decide environment precedence first:
```ts
function mayReplace(existing: Entitlement, verified: VerifiedTransaction): boolean {
  const existingProd = existing.environment === PRODUCTION;
  const verifiedProd = verified.environment === PRODUCTION;
  if (existingProd && !verifiedProd) return false;
  if (sameIdentity(existing, verified)) {
    return verified.signedDate.getTime() >= existing.lastSignedAt.getTime();
  }
  if (verifiedProd && !existingProd) return true;
  return existing.status !== ENTITLEMENT_STATUS.ACTIVE;
}
```
Also add a test where the Production JWS signedDate is older than the Sandbox row's.

### WR-02: Launch-time unfinished transactions are verified twice at once, and a `claimed-elsewhere` update is re-sent on every launch

**File:** `frontend/lib/native/store/store-service.ts:218-249`, `frontend/lib/hooks/use-entitlement-recheck.ts:78-83`, `frontend/components/entitlements/entitlement-runtime.tsx:12-15`
**Issue:**
- **Duplicate verify at launch.** StoreKit delivers every unfinished transaction through `Transaction.updates` right after launch. At the same moment `useEntitlementRecheck` fires its `mount` recheck, which reads `currentEntitlements` and verifies the same JWS. The two run independently with different `newKey()` idempotency keys, so one transaction costs two `/verify` calls. The `subscribeTransactionUpdates` comment ("a burst cannot race the verify limiter") does not hold: the serialization only covers the updates chain, not the recheck. Under the verify limiter one call can come back 429. WR-03 maps that to `transient`, so the outcome is not wrong, but it wastes quota.
- **Repeated 409 on every launch.** `handleTransactionUpdate` maps a 409 `ENTITLEMENT_ALREADY_CLAIMED` to `claimed-elsewhere` and leaves the transaction unfinished. StoreKit then re-delivers it on every launch, and each launch sends another 409 `/verify`. The recheck controller stops itself after `claimed-elsewhere`, but the updates path has no matching stop. The transaction is finished only if this account later turns active.
**Fix:**
- Route updates through the same in-flight guard as the recheck, for example by giving the controller a `runExclusive(fn)` used by both. Alternatively, skip the `mount` recheck when an update for the same `transactionId` is already queued.
- For `claimed-elsewhere`, remember the `transactionId` for the session (a module-level Set) and ignore it on re-delivery.

### WR-03: `finishUnfinished` finishes every unfinished transaction for the product without checking that it is the purchase the server holds

**File:** `frontend/lib/native/store/store-service.ts:179-190`, `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift:168-180`
**Issue:** When the cached `/me` status is `active`, `recheckEntitlements` calls `finishUnfinished`, which finishes every verified unfinished transaction of the product. It never sends the JWS to the server. If the active row is a different purchase (a Sandbox unlock, or an unlock from another Apple ID) and the device holds an unclaimed real Production purchase, that purchase is finished without ever being verified. The `transactionUpdated` event may never reach JS: the listener only attaches after sign-in, and the recheck can run first. The purchase then never supersedes Sandbox (see WR-01) and stays claimable by another account. `/me` returns `environment`, but the recheck never compares it.
**Fix:**
- Have `finishUnfinished` return the unfinished `{ jws, originalTransactionId, transactionId }` list instead of finishing blindly.
- In JS, finish locally only the transactions whose `originalTransactionId` the server already reports, and verify the rest. The simplest version: when `me.environment !== 'Production'`, verify instead of finishing.

## Info

### IN-01: The tombstone only records webhook state, so a newer JWS from /verify never updates it

**File:** `backend/src/modules/entitlements/revocation-tombstone.ts:59-78`, `backend/src/modules/entitlements/notifications.service.ts:82-101`
**Issue:** Example sequence:
1. A REFUND_REVERSED is missed or arrives late.
2. The device sends a JWS signed after the reversal with no `revocationDate`. The row becomes active.
3. A stale REFUND notification then arrives. It is ignored for the row, but it is still written to the tombstone because the tombstone has no newer entry.
4. After account deletion, a re-claim with an older JWS is stored as revoked.

This is a rare false revoke. The fix report already notes that the webhook-only design has a "lost webhooks" gap.
**Fix:** In `applyVerifiedTransaction`, when the incoming JWS is newer than the tombstone, call `recordRevocationState` with the JWS's own state (signedAt is the JWS signedDate). Alternatively, document this as accepted.

### IN-02: Retained `transactionUpdated` events are replayed to the next account that signs in

**File:** `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift:36-40`, `frontend/lib/hooks/use-store-transaction-updates.ts:24-41`
**Issue:** The JS listener is removed on sign-out. Capacitor's `retainUntilConsumed` queues every event while no listener is attached (CAPPlugin.m:84-92) and replays the whole queue to the next listener. Updates that arrive while signed out are therefore auto-claimed by whichever account signs in next, without any user action. This matches the existing launch recheck behaviour, but it is not documented.
**Fix:** Document it in `docs/store/IAP.md`, or drop updates delivered while signed out and rely on the recheck.

### IN-03: Lock waits count toward Prisma's default 5 s interactive-transaction timeout

**File:** `backend/src/modules/entitlements/entitlements.service.ts:177`, `backend/src/modules/entitlements/notifications.service.ts:109`
**Issue:** `pg_advisory_xact_lock` blocks with no bound. A slow holder makes waiting callers fail with P2028, which becomes a generic 500 rather than the 503 that `/verify` clients treat as retryable. WR-03 maps 5xx to transient, so the impact is low.
**Fix:** Pass an explicit `{ timeout, maxWait }` to `prisma.$transaction`, or use `SET LOCAL lock_timeout` and map the timeout to `VERIFICATION_UNAVAILABLE`.

### IN-04: `resolveRace` and the P2002 fallback are now effectively dead code

**File:** `backend/src/modules/entitlements/entitlements.service.ts:156-181`
**Issue:** With the purchase and user locks, both unique constraints are serialized before any write, so P2002 cannot occur from these paths. The fallback is harmless but misleading.
**Fix:** Keep it as defence in depth with a comment saying so, or remove it.

### IN-05: Timing-based lock test and an unvalidated persisted `limit`

**File:** `backend/tests/entitlements-concurrency.test.ts:72-85`, `frontend/lib/offline/status/describe-op.ts:80`
**Issue:**
- The "claim waits" test asserts `done === false` after a 300 ms sleep. The real lock makes that hold, but the test is sensitive to timing under load, which is the existing flake class in 12-VERIFICATION.
- `op.lastError?.limit` comes from `last_error_json`, which is cast without validation (`store-rows.ts:55`), so a malformed value is interpolated into the copy as-is.
**Fix:**
- In the test, assert ordering through DB state, for example by checking that no row exists before `release()`.
- In `upgradeCopy`, use `freeLimitOf(op.lastError?.limit)`.

---

_Reviewed: 2026-10-11T12:47:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
