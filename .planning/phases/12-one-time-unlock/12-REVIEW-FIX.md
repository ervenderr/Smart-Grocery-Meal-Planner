---
phase: 12-one-time-unlock
fixed_at: 2026-10-11T12:56:21Z
review_path: .planning/phases/12-one-time-unlock/12-REVIEW-2.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
# Iteration 1 (12-REVIEW.md): 8 in scope, 8 fixed, 0 skipped, all_fixed. Details below.
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-10-11T13:30:00Z
**Source review:** .planning/phases/12-one-time-unlock/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, WR-01..WR-07; Info findings IN-01..IN-08 out of scope)
- Fixed: 8
- Skipped: 0

## Verification (after all fixes)

| Gate | Result |
|------|--------|
| Backend `npx jest --runInBand` | 102/102 suites, 1590/1590 tests pass (was 1576 before; +14 new tests) |
| Backend `npx jest` (parallel) | 1588-1589/1590. A different unrelated test fails each run (ai-quota, rate-limiter, shopping-finish-limit 30s timeout, untrusted-chain). Each passes alone; these are the existing load flakes noted in 12-VERIFICATION |
| Backend `tsc --noEmit`, `npm run lint` | clean (0 errors; 1 existing warning) |
| Backend migration | `20261018000000_app_store_revocations` (additive CREATE TABLE) applied to local dev DB with `prisma migrate deploy` |
| Frontend `npx vitest run` | 172/172 files, 1717/1717 tests (was 171/1689; `rank.bench` timing flake failed once under load, passes when re-run) |
| Frontend `tsc --noEmit` | clean |
| Frontend `eslint .` | 0 errors, 130 warnings (same count as the baseline on main; none in the changed files) |
| `bash mobile/scripts/frontend-build.sh web` | success |
| `bash mobile/scripts/frontend-build.sh native` | success |
| `xcodebuild -scheme KumaunStore -destination 'generic/platform=iOS'` (plugin) | BUILD SUCCEEDED, no warnings in plugin sources |
| `xcodebuild -project App.xcodeproj -scheme App -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO` | BUILD SUCCEEDED |

## Fixed Issues

### CR-01: Refunds that arrive before a claim are lost; a saved JWS can be claimed after the refund

**Files modified:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261018000000_app_store_revocations/migration.sql`, `backend/src/modules/entitlements/revocation-tombstone.ts` (new), `backend/src/modules/entitlements/entitlements.service.ts`, `backend/src/modules/entitlements/notifications.service.ts`, `backend/tests/entitlements-tombstone.test.ts` (new), `docs/store/IAP.md`
**Commit:** c035984
**Applied fix:**
- Added the `app_store_revocations` table. Its key is (environment, originalTransactionId) and it stores revokedAt, revocationReason and lastSignedAt. The migration is additive.
- Every REFUND, REVOKE and REFUND_REVERSED notification now writes this tombstone inside the webhook transaction, even when no account has claimed the purchase. The write is an atomic upsert guarded by `WHERE last_signed_at <= EXCLUDED.last_signed_at`, so ordering follows signedDate. REFUND_REVERSED sets revokedAt to null and keeps its signedAt, so a stale REFUND that arrives later cannot re-revoke.
- `applyVerifiedTransaction` (shared by /verify and the webhook) applies any tombstone whose signedAt is at or after the JWS signedDate. A saved pre-refund JWS is therefore stored as revoked and cannot reactivate the purchase.
- Tombstones survive account deletion.
- The webhook outcome stays `no_entitlement` for unclaimed purchases.
- Added a runbook note on the remaining gap: lost webhooks after Apple exhausts its retries.

**Tests (8 new):**
- Refund before claim leads to a revoked claim.
- REVOKE without a revocationDate.
- REFUND_REVERSED clears the tombstone.
- A stale reversal does not clear a newer refund, and a stale refund does not undo a newer reversal.
- A fresher JWS wins over the tombstone.
- Refund, then account deletion, then a re-claim on a new account stays revoked.
- Tombstones are per environment.

**Status:** fixed: requires human verification (logic). Please confirm that the "a tombstone signed at or after the JWS wins" rule is acceptable.

### WR-01: Sandbox purchases grant Production access, and can re-activate a refunded Production unlock

**Files modified:** `backend/src/modules/entitlements/entitlements.service.ts`, `backend/tests/entitlements-environment.test.ts` (new), `docs/store/IAP.md`
**Commit:** fc66237
**Applied fix:**
- The new `mayReplace()` policy means a non-Production (Sandbox or Xcode) purchase never overwrites a Production row, whatever that row's status. A refunded Production unlock can therefore not be re-activated by a free TestFlight purchase.
- A real Production purchase now supersedes a Sandbox row.
- The older-message and different-purchase-over-active rules are unchanged.
- Sandbox is still accepted, as App Review needs it. No env knob was added: it would have touched the verifier, env schema and config for a mode that would break App Review.
- The accepted residual risk (a free Sandbox unlock on accounts without a Production purchase) is documented in `docs/store/IAP.md`, with a warning not to enable public TestFlight without revisiting it.

**Tests (4 new):**
- A Sandbox purchase cannot re-activate a revoked Production entitlement.
- A Sandbox purchase does not overwrite an active Production entitlement.
- A Production purchase supersedes an active Sandbox one.
- The Sandbox retry after a Sandbox revoke still works.

**Status:** fixed: requires human verification (policy logic)

### WR-02: Claim and webhook can overwrite each other's update (no row lock)

**Files modified:** `backend/src/modules/entitlements/entitlement-lock.ts` (new), `backend/src/modules/entitlements/entitlements.service.ts`, `backend/src/modules/entitlements/notifications.service.ts`, `backend/tests/entitlements-concurrency.test.ts` (new)
**Commit:** 059be32
**Applied fix:**
- Added `pg_advisory_xact_lock(hashtextextended(...))` locks, keyed per purchase (`entitlement:purchase:<env>:<otid>`) and per user (`entitlement:user:<id>`).
- `applyVerifiedTransaction` takes the purchase lock and then the user lock before any read.
- The webhook takes the purchase lock before it writes the tombstone and reads the row.
- The lock order is always purchase, then user. The locks are re-entrant within a transaction.
- The signedDate comparison now runs under the lock.

**Tests (2 new):**
- A claim blocks while another transaction holds the purchase lock. This test fails when the lock is a no-op; I checked that.
- A concurrent REFUND and an older-JWS verify always end revoked (8 iterations).

**Status:** fixed

### WR-03: After a paid purchase, 429 and in-flight 409 are shown as a permanent "verify failed"

**Files modified:** `frontend/lib/native/store/store-service.ts`, `frontend/lib/native/store/store-service.test.ts`
**Commit:** a2b6bd2
**Applied fix:**
- `classifyVerifyError` maps 429 (from either limiter) and 409 `IDEMPOTENCY_IN_FLIGHT` to transient. The result is `verify-pending`, the transaction stays unfinished, and the next recheck or update retries it.
- Other 409 codes still map to verify-failed.

**Tests (5 new):**
- Purchase: 429 from the verify limiter, 429 from the API limiter, and 409 in-flight each give pending.
- A 409 with another code gives failed.
- A rate-limited restore gives pending.

**Status:** fixed

### WR-04: The StoreKit plugin never listens to `Transaction.updates`

**Files modified:** `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift`, `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/StoreMapping.swift`, `mobile/plugins/kumaun-store/README.md`, `frontend/lib/native/store/store-plugin.ts`, `frontend/lib/native/store/store-service.ts`, `frontend/lib/native/store/store-service.test.ts`, `frontend/lib/native/store/mock-store.ts`, `frontend/lib/native/store/mock-store.test.ts`, `frontend/lib/entitlements/refresh.ts` (new), `frontend/lib/hooks/use-store-transaction-updates.ts` (new), `frontend/lib/hooks/use-entitlement.ts`, `frontend/components/entitlements/entitlement-runtime.tsx` (new), `frontend/app/(app)/layout.tsx`
**Commit:** 7c73936
**Applied fix:**
- **Swift:**
  - `load()` starts a detached task that iterates `Transaction.updates`.
  - Each verified transaction is emitted as a `transactionUpdated` event with `{jws, originalTransactionId, transactionId, productId, revoked}`. The event uses `retainUntilConsumed: true`, so launch-time deliveries are not lost.
  - The task is cancelled in `deinit`.
  - New method `finishUnfinished({productId})`.
- **JS:**
  - `handleTransactionUpdate` filters to the product, verifies with the server, then finishes, and only after a 2xx.
  - `subscribeTransactionUpdates` handles deliveries one at a time.
  - `recheckEntitlements` calls `finishUnfinished` when the server already says active, so StoreKit stops re-delivering those transactions. No verify is sent in that case.
  - The listener lives in a new native-only `EntitlementRuntime` mounted once in the app layout.

**Tests (8 new or updated):**
- `handleTransactionUpdate`: verified and finished; other products ignored; transient leaves the transaction unfinished; claimed and failed outcomes; a revoked delivery is still verified.
- `subscribeTransactionUpdates`: deliveries are serialized and unsubscribe works.
- Mock-store listener test.
- The "active" path of `recheckEntitlements` now calls only `finishUnfinished`.

**Status:** fixed (real StoreKit behaviour still needs a device or TestFlight check, as for the rest of 12-15)

### WR-05: Free limit is hard-coded to 25 in user copy while the server limit is configurable

**Files modified:** `frontend/lib/entitlements/copy.ts`, `copy.test.ts`, `upgrade-error.ts`, `upgrade-error.test.ts`, `view-model.ts`, `view-model.test.ts`, `frontend/lib/offline/status/describe-op.ts`, `describe-op.test.ts`, `frontend/lib/offline/outbox/op-types.ts`, `classify-error.ts`, `classify-error.test.ts`, `frontend/lib/offline/transport.ts`, `transport.test.ts`, `frontend/lib/hooks/use-pantry-add-gate.ts`, `use-finish-shopping.ts`, `frontend/components/entitlements/upgrade-sheet-offer.tsx`, `upgrade-sheet-host.tsx`, `frontend/components/settings/kumaun-full-card.tsx`
**Commit:** 5ec6981
**Applied fix:**
- `chipFree`, `sheetLead`, `webLimitInline`, `finishLimitWeb` and the four outbox `upgrade*` reasons are now functions of the limit.
- The limit comes from three places:
  - `me.limits.pantry` (via the new `freeLimitOf`) for the card chip, the sheet lead and the add-gate pre-check.
  - `upgradeLimitFrom(error)` for 403 responses in the add gate and in finish shopping.
  - `LastError.limit` for parked outbox ops. `toFailure` reads it from the 403 details and `park()` stores it.
- The default stays 25.

**Tests (7 new):**
- The copy functions, plus a check that no static copy string contains "25".
- The card chipText and sheet leadText.
- `freeLimitOf`.
- Outbox reason copy with limit 40.
- `classify` keeps the limit.
- `toFailure` carries the limit for UPGRADE_REQUIRED only.

**Status:** fixed

### WR-06: Purchase that comes back `revoked` shows no message

**Files modified:** `frontend/lib/entitlements/copy.ts`, `frontend/lib/entitlements/view-model.ts`, `frontend/lib/entitlements/view-model.test.ts`
**Commit:** 6a1f4c2
**Applied fix:**
- New copy key `purchaseRevoked`: "This purchase was refunded or revoked, so Kumaun Full is not active. Contact support if you were charged."
- `OUTCOME_TEXT.revoked` is now an error message, for both purchase and restore.
- The sheet still returns to the offer state, but it now shows the message.

**Tests (2 new):** the outcome mapping for purchase and restore, and the sheet model keeping the message once the flow is back to idle.

**Status:** fixed

### WR-07: Each `useEntitlement` instance re-verifies on mount and on every resume, sometimes before `/me` loads

**Files modified:** `frontend/lib/hooks/use-entitlement.ts`, `frontend/lib/hooks/use-entitlement-recheck.ts` (new), `frontend/lib/entitlements/recheck-controller.ts` (new), `frontend/lib/entitlements/recheck-controller.test.ts` (new), `frontend/lib/native/store/store-service.ts`, `frontend/lib/native/store/store-service.test.ts`, `frontend/components/entitlements/entitlement-runtime.tsx`
**Commit:** a0b754e
**Applied fix:**
- Removed the mount recheck and the `appStateChange` recheck from `useEntitlement`. That hook is still used by the Settings card and the upgrade sheet.
- The recheck now runs only in `EntitlementRuntime` (one native instance), through `useEntitlementRecheck`:
  - It waits until `/entitlements/me` succeeds from the server (`isSuccess && !isPlaceholderData`), so the localStorage placeholder never drives it.
  - It runs once per signed-in user, then again on resume or when the device comes back online.
- A pure `createRecheckController` provides:
  - an in-flight guard;
  - a 60 s debounce for resume and online triggers;
  - a stop for the session after `claimed-elsewhere`, which `recheckEntitlements` now reports instead of `failed`.
- `useEntitlementMeQuery` is exported so every observer shares one queryFn. This partly addresses IN-02, but `use-pantry-add-gate` still has its own queryFn.

**Tests (6 new):**
- Controller: runs on mount, debounces, never runs two at once, stops after claimed-elsewhere, and a throwing run does not wedge it.
- `recheckEntitlements` reports claimed-elsewhere.

**Status:** fixed: requires human verification (hook wiring is not unit-tested because vitest is Node-only for `lib/**`. Check one verify per launch and per resume on a device)

## Notes

- Work was done in an isolated worktree on branch `gsd-reviewfix/12-*` and fast-forwarded onto `main`. Nothing was pushed or deployed.
- `.planning/STATE.md` (unrelated, uncommitted) was not touched or staged.
- The new migration must be applied on Railway at the next deploy. `entrypoint.sh` already runs `prisma migrate deploy`.

---

_Fixed: 2026-10-11T13:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---

# Iteration 2: fixes for 12-REVIEW-2.md

**Fixed at:** 2026-10-11T12:56:21Z
**Source review:** .planning/phases/12-one-time-unlock/12-REVIEW-2.md
**Scope:** Warnings only (WR-01..WR-03). IN-03 was optional "if trivial". Other Info findings were out of scope.

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0
- Optional IN-03: not attempted (not trivial, see below)

## Verification (after all three commits)

| Check | Result |
|-------|--------|
| Backend `npx jest --runInBand` | 102 suites, 1592 tests passed |
| Backend `tsc --noEmit` | clean |
| Backend eslint | 0 errors, 172 warnings (same as baseline) |
| Frontend `vitest run` | 173 files, 1734 tests passed |
| Frontend `tsc --noEmit` | clean |
| Frontend eslint (touched dirs) | 0 errors. Warnings are pre-existing and none are in changed lines |
| `mobile/scripts/frontend-build.sh web` | succeeded |
| `mobile/scripts/frontend-build.sh native` | succeeded, `out/index.html` present |
| `xcodebuild -scheme KumaunStore -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO` | succeeded (`KumaunStorePlugin.o` built) |

## Fixed Issues

### WR-01: Production-over-Sandbox precedence is gated by a cross-purchase signedDate check

**Files modified:** `backend/src/modules/entitlements/entitlements.service.ts`, `backend/tests/entitlements-environment.test.ts`
**Commit:** ad45586
**Applied fix:**
- `mayReplace` now applies the environment rules first:
  - non-Production never replaces Production;
  - Production always supersedes non-Production.
- The `signedDate` ordering is applied only when the incoming JWS is for the same purchase (`sameIdentity`). Signed dates of unrelated purchases are no longer compared.
- Other cases are unchanged: a different purchase in the same environment replaces only a row that is not active.

**Tests (2 new):**
- A Production JWS signed 60 s before the Sandbox row's `lastSignedAt` still supersedes it. This test failed before the fix.
- An older JWS for the same purchase still never overwrites a newer revoked state.

**Status:** fixed: requires human verification (precedence logic change)

### WR-02: Launch-time unfinished transactions are verified twice at once, and claimed-elsewhere updates are re-sent every launch

**Files modified:** `frontend/lib/native/store/verify-gate.ts` (new), `frontend/lib/native/store/verify-gate.test.ts` (new), `frontend/lib/native/store/store-service.ts`, `frontend/lib/native/store/store-service.test.ts`, `frontend/lib/native/store/store-deps.ts`, `frontend/lib/native/store/store-deps.test.ts`, `frontend/lib/hooks/use-store-product.ts`, `frontend/lib/hooks/use-entitlement-recheck.ts`, `frontend/lib/hooks/use-store-transaction-updates.ts`, `frontend/app/e2e/upgrade/page.e2e.tsx`
**Commit:** 94490d0
**Applied fix:**
- New `VerifyGate`, scoped per signed-in user with `sessionVerifyGate(userId)`, so a new account starts fresh. It is now a required field on `StoreDeps`, and `getStoreDeps(isOnline, userId, e2eFlag)` supplies it.
- `verifyAndFinish` runs through `gate.run(transactionId, ...)`. Only one `/verify` per `transactionId` is in flight at a time. Any concurrent caller (updates listener, launch/resume recheck, restore, purchase) joins that request and gets the same result, instead of sending a second call with a different idempotency key.
- Claimed-elsewhere is recorded per transaction:
  - A 409 `ENTITLEMENT_ALREADY_CLAIMED` from any path marks the `transactionId`.
  - A later 2xx clears the mark.
  - `handleTransactionUpdate` returns `ignored` without a network call for marked transactions, so StoreKit re-deliveries stop costing a 409 for the rest of the session.
  - An explicit Restore still verifies a marked transaction.

**Tests (11 new):**
- Gate unit tests (6):
  - joins an in-flight run;
  - runs different ids independently;
  - re-runs after the previous run settles or rejects;
  - a synchronous throw leaves no stale entry;
  - claimed mark and clear;
  - per-user session gate.
- Store-service tests (5):
  - an update plus the mount recheck for the same transaction send one verify;
  - a sequential re-verify is still sent;
  - a claimed update is not re-sent on re-delivery;
  - a claim seen by the recheck also stops update re-deliveries;
  - an explicit restore still verifies a claimed transaction and clears the mark.

**Status:** fixed: requires human verification (on a device, confirm one `/verify` per unfinished transaction at launch)

### WR-03: `finishUnfinished` finishes every unfinished transaction without checking it is the purchase the server holds

**Files modified:** `backend/src/modules/entitlements/entitlement-status.ts`, `backend/src/modules/entitlements/entitlements.service.ts`, `backend/tests/entitlement-status.test.ts`, `backend/tests/entitlements-claim.test.ts`, `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift`, `mobile/plugins/kumaun-store/README.md`, `frontend/lib/native/store/store-plugin.ts`, `frontend/lib/native/store/mock-store.ts`, `frontend/lib/native/store/mock-store.test.ts`, `frontend/lib/api/entitlements.ts`, `frontend/lib/native/store/store-service.ts`, `frontend/lib/native/store/store-service.test.ts`, `frontend/lib/entitlements/recheck-controller.ts`, `frontend/lib/entitlements/recheck-controller.test.ts`, `frontend/lib/hooks/use-entitlement-recheck.ts`
**Commit:** c5a76cd
**Applied fix:**
- **Backend:** `GET /entitlements/me` (and `getEntitlementSummary`) now returns `originalTransactionId`, the user's own purchase id, or null.
- **Native:** the blind `finishUnfinished` was removed. The new `unfinishedTransactions({productId})` returns `{ jws, originalTransactionId, transactionId }` for each verified unfinished transaction and finishes nothing.
- **JS, when the server says active:**
  - Transactions whose `originalTransactionId` equals the server-held one are finished locally.
  - Every other transaction is verified first. `verifyAndFinish` finishes it only after a 2xx.
  - A 409 claimed-elsewhere transaction is also finished. The server has already recorded it for another account, and this account is already unlocked, so finishing it stops the re-delivery loop that the old WR-04 fix addressed.
  - Transient and hard failures leave the transaction unfinished.
  - If the server omits the id (an older backend), everything is verified and nothing is finished blindly.
  - The result is `verified` when a verify succeeded, so `/me` refreshes when a Production purchase supersedes Sandbox.
- `ServerEntitlement { status, originalTransactionId }` now flows through `useEntitlementRecheck` and the controller. The controller is generic over that value.

**Tests:**
- Backend: the summary and `getMe` include `originalTransactionId`.
- Frontend, 6 new:
  - the held purchase is finished without a verify;
  - a different purchase is verified, then finished, and the result is `verified`;
  - a transient failure leaves it unfinished (`pending`);
  - a hard failure leaves it unfinished;
  - a claimed-elsewhere purchase is finished;
  - with no held id, everything is verified.
- The existing recheck tests were updated to the new contract.

**Status:** fixed: requires human verification (StoreKit behaviour of `Transaction.unfinished` on a device, plus the backend deploy order below)

## Skipped / not attempted

### IN-03 (optional): Lock waits count toward Prisma's 5 s interactive-transaction timeout

**File:** `backend/src/modules/entitlements/entitlements.service.ts:177`, `backend/src/modules/entitlements/notifications.service.ts:109`
**Reason:** Not trivial. A correct fix needs:
- an explicit `{ timeout, maxWait }` at two call sites;
- mapping P2028 to `VERIFICATION_UNAVAILABLE` (503) in `verifyAndClaim`;
- a test that holds the advisory lock past the timeout, which depends on timing (the flake class noted in IN-05).

Impact stays low because clients already treat 5xx as transient.

## Notes (iteration 2)

- **Deploy order:** the app treats a missing `originalTransactionId` as "verify everything", so shipping the app before the backend is safe. It only costs a few extra `/verify` calls.
- **Native plugin contract change:** `finishUnfinished` was replaced by `unfinishedTransactions`. The JS bundle and the iOS plugin must ship together in the same build, which is already the case.
- **Process:** the work was done in an isolated worktree and fast-forwarded onto `main`. Nothing was pushed or deployed. `.planning/STATE.md` was not touched or staged.

_Fixed: 2026-10-11T12:56:21Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
