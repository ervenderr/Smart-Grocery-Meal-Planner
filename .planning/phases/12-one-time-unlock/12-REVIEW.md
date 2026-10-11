---
phase: 12-one-time-unlock
reviewed: 2026-10-11T12:21:51Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - backend/.env.example
  - backend/prisma/migrations/20261017000000_entitlements/migration.sql
  - backend/prisma/schema.prisma
  - backend/scripts/gen-apple-test-pki.sh
  - backend/src/app.ts
  - backend/src/config/env.config.ts
  - backend/src/config/env.schema.ts
  - backend/src/modules/ai/ai-limits.ts
  - backend/src/modules/ai/ai-quota.repository.ts
  - backend/src/modules/ai/ai.deps.ts
  - backend/src/modules/ai/ai.errors.ts
  - backend/src/modules/ai/ai.orchestrator.ts
  - backend/src/modules/entitlements/apple-root-g3.ts
  - backend/src/modules/entitlements/apple-verifier.ts
  - backend/src/modules/entitlements/entitlement-status.ts
  - backend/src/modules/entitlements/entitlements.constants.ts
  - backend/src/modules/entitlements/entitlements.controller.ts
  - backend/src/modules/entitlements/entitlements.deps.ts
  - backend/src/modules/entitlements/entitlements.routes.ts
  - backend/src/modules/entitlements/entitlements.service.ts
  - backend/src/modules/entitlements/entitlements.validation.ts
  - backend/src/modules/entitlements/notifications.routes.ts
  - backend/src/modules/entitlements/notifications.service.ts
  - backend/src/modules/entitlements/notifications.validation.ts
  - backend/src/modules/pantry/pantry.limit.ts
  - backend/src/modules/pantry/pantry.service.ts
  - backend/src/modules/shopping/shopping-finish.service.ts
  - backend/src/modules/shopping/shopping-pantry.service.ts
  - backend/src/modules/users/account-deletion.service.ts
  - frontend/app/(app)/layout.tsx
  - frontend/app/(app)/settings/page.tsx
  - frontend/app/e2e/upgrade/page.e2e.tsx
  - frontend/components/entitlements/upgrade-sheet-host.tsx
  - frontend/components/entitlements/upgrade-sheet-offer.tsx
  - frontend/components/entitlements/upgrade-sheet.tsx
  - frontend/components/offline/pending-change-row.tsx
  - frontend/components/offline/pending-changes-sheet.tsx
  - frontend/components/pantry/add-pantry-item-modal.tsx
  - frontend/components/settings/delete-account-sheet.tsx
  - frontend/components/settings/kumaun-full-card.tsx
  - frontend/components/settings/kumaun-full-web-note.tsx
  - frontend/lib/api/entitlements.ts
  - frontend/lib/entitlements/copy.ts
  - frontend/lib/entitlements/entitlement-cache.ts
  - frontend/lib/entitlements/pantry-gate.ts
  - frontend/lib/entitlements/upgrade-error.ts
  - frontend/lib/entitlements/upgrade-sheet-store.ts
  - frontend/lib/entitlements/view-model.ts
  - frontend/lib/hooks/use-entitlement.ts
  - frontend/lib/hooks/use-finish-shopping.ts
  - frontend/lib/hooks/use-pantry-add-gate.ts
  - frontend/lib/hooks/use-store-product.ts
  - frontend/lib/native/store/mock-store.ts
  - frontend/lib/native/store/store-deps.ts
  - frontend/lib/native/store/store-plugin.ts
  - frontend/lib/native/store/store-service.ts
  - frontend/lib/offline/outbox/classify-error.ts
  - frontend/lib/offline/status/describe-op.ts
  - frontend/lib/offline/status/sheet-model.ts
  - mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift
  - mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/StoreMapping.swift
  - mobile/ios/App/CapApp-SPM/Package.swift
findings:
  critical: 1
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-11T12:21:51Z
**Depth:** standard. Security-critical paths got a deeper pass: JWS verification, claim, webhook, the pantry cap lock, the quota repo, idempotency and the upgrade flow.
**Files Reviewed:** 62 source files. I also skimmed these files without a full review: `mobile/plugins/kumaun-store/Package.swift`, `mobile/ios/App/App/PrivacyInfo.xcprivacy`, `Info.plist`, `project.pbxproj`, `App.xcscheme`, `mobile/storekit/Kumaun.storekit`, `mobile/scripts/*` (ASC/signing) and the backend/frontend tests (checked for reliability only).
**Status:** issues_found

Scope: `git diff --name-only 15eb311..HEAD`, excluding `.planning/`, `docs/`, lockfiles, generated assets and the four files that only commit f2e5dfa touched (dashboard page, edit-pantry-item-modal, ui/input, cache-keys). I checked the findings against 12-01..12-15 SUMMARY and 12-VERIFICATION.

## Summary

The core verification is solid:
- **Apple signature checks:** `SignedDataVerifier` checks the chain to the pinned Apple Root G3, the bundle id and the environment. Xcode/LocalTesting JWS are refused in production by `env.schema.ts`.
- **Product checks:** the product id and `Non-Consumable` type are enforced.
- **Concurrency:** P2002 claim races map to 409. Webhook dedupe shares one transaction with the entitlement update.
- **Pantry cap:** the cap is enforced on both pantry-creating paths under a per-user advisory transaction lock. I checked the deadlock ordering against `pantry.lock.ts`.
- **Account deletion:** deletion clears the entitlement and the monthly AI counters.

The main defect is in how refunds interact with claims:
- A refund or revoke notification that arrives before the purchase is claimed is acknowledged and then thrown away for good.
- The claim endpoint accepts any Apple-signed JWS with no age limit and no revocation lookup.
- Together, these let someone hold Kumaun Full permanently after a refund (CR-01).

Secondary issues:
- Sandbox JWS can grant (or re-grant) access in production.
- Claim and webhook can lose each other's update in a race.
- The client misclassifies some errors when a paid purchase is being verified.
- The StoreKit plugin has no `Transaction.updates` listener.
- The free-limit copy is hard-coded to 25.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: [BLOCKER] Refunds that arrive before a claim are lost; a saved JWS can be claimed after the refund

**File:** `backend/src/modules/entitlements/notifications.service.ts:81,90-104`; `backend/src/modules/entitlements/entitlements.service.ts:71-82,116-131`

**Issue:** `handleAppStoreNotification` commits the `app_store_notifications` dedupe row, then returns `'no_entitlement'` (HTTP 200) when no entitlement row exists for `(environment, originalTransactionId)`. So a `REFUND`/`REVOKE` for a purchase that nobody has claimed yet is acknowledged and dropped. Apple will not resend it, and the UUID is now deduped.

On the claim side, `verifyJws` only accepts or rejects what the JWS itself says:
- There is no lookup of refund/revocation state (`onlineChecks` only checks certificate OCSP, not the transaction).
- There is no maximum age on `signedDate`.

The original purchase JWS carries no `revocationDate`, so it stays valid forever.

Exploit path:
1. Buy.
2. Capture the JWS and block `/verify`. For example, airplane mode right after purchase leaves the transaction unfinished and returns `verify-pending`, or a proxy on the user's own device records and drops the request.
3. Request a refund. The REFUND notification is recorded as `no_entitlement` and ignored.
4. Replay the saved JWS to `POST /api/v1/entitlements/verify`. The result is a permanent `active` entitlement, and no later notification will ever revoke it.

The same gap applies to `ONE_TIME_CHARGE`/`REFUND_REVERSED` ordering.

**Fix:** Persist the revocation state even when no entitlement exists, and consult it during the claim:
```ts
// notifications.service.ts (inside the tx)
if (!row) {
  if (REVOKING_TYPES.has(n.notificationType)) {
    await tx.revokedTransaction.upsert({            // new table: (environment, originalTransactionId) PK
      where: { environment_originalTransactionId: { environment: n.transaction.environment,
               originalTransactionId: n.transaction.originalTransactionId } },
      create: { environment: n.transaction.environment, originalTransactionId: n.transaction.originalTransactionId,
                revokedAt: n.transaction.revocationDate ?? n.signedDate, signedAt: n.signedDate },
      update: { revokedAt: n.transaction.revocationDate ?? n.signedDate, signedAt: n.signedDate },
    });
  } else if (n.notificationType === 'REFUND_REVERSED') {
    await tx.revokedTransaction.deleteMany({ where: { /* same key */ } });
  }
  return 'no_entitlement';
}

// entitlements.service.ts applyVerifiedTransaction, before the upsert
const tomb = await tx.revokedTransaction.findUnique({ where: { /* env + otid */ } });
const effective = tomb && tomb.signedAt >= verified.signedDate
  ? { ...verified, revocationDate: tomb.revokedAt }
  : verified;
```
A stronger option: call the App Store Server API (`GET /inApps/v1/transactions/{transactionId}`) during the claim so the server reads the current revocation state from Apple. Neither fix covers lost webhooks (Apple's retries are bounded), so also add a short note to the runbook.

## Warnings

### WR-01: [WARNING] Sandbox purchases grant Production access, and can re-activate a refunded Production unlock

**File:** `backend/src/modules/entitlements/apple-verifier.ts:147-152`; `backend/src/modules/entitlements/entitlements.service.ts:107-131`; `backend/src/modules/entitlements/entitlement-status.ts:21-31`

**Issue:** The Sandbox environment is always accepted, and `isEntitled` ignores `environment`. TestFlight purchases are free Sandbox purchases, so anyone who can run a TestFlight or dev build (internal testers today, external testers if a public link is ever enabled) can unlock their production account for free, permanently.

The 12-06 guard only stops a different purchase from overwriting an **active** row. A user whose Production purchase was refunded (row `revoked`) can therefore claim a free Sandbox JWS: `differentPurchase && existing.status === ACTIVE` is false, so the upsert overwrites the revoked Production row with an active Sandbox one.

Accepting Sandbox is needed for App Review, so it cannot simply be rejected.

**Fix:** Add `IAP_SANDBOX_POLICY` (e.g. `allow | reviewer-allowlist | deny`), or store Sandbox rows but count them in `isEntitled` only for allow-listed user ids or emails. At minimum, never let a Sandbox purchase replace a Production row in any status:
```ts
if (existing && existing.environment === 'Production' && verified.environment !== 'Production') {
  return toView(existing);
}
```

### WR-02: [WARNING] Claim and webhook can overwrite each other's update (no row lock)

**File:** `backend/src/modules/entitlements/entitlements.service.ts:94-131`; `backend/src/modules/entitlements/notifications.service.ts:73-83`

**Issue:** Both paths read the entitlement, compare `signedDate` with `lastSignedAt`, then upsert, all under READ COMMITTED with no lock.

Failure sequence:
1. A REFUND webhook and a client `/verify` holding an older pre-refund JWS run at the same time, and both read the pre-refund row.
2. The webhook writes `revoked`.
3. The verify transaction then writes `active` with an *older* `lastSignedAt`.

The stale-message guard is bypassed and the refund is undone. The app's resume recheck makes concurrent verifies routine, so the window is small but real.

**Fix:** Serialize per purchase. Take `SELECT ... FOR UPDATE` on the entitlement row, or take `pg_advisory_xact_lock(hashtextextended('entitlement:'||env||':'||otid, 0))` at the start of `applyVerifiedTransaction`, in the same way as `lockPantryCap`. Alternatively, make the update conditional: `updateMany({ where: { id, lastSignedAt: { lte: verified.signedDate } }, data })`.

### WR-03: [WARNING] After a paid purchase, 429 and in-flight 409 are shown as a permanent "verify failed"

**File:** `frontend/lib/native/store/store-service.ts:46-52`

**Issue:** `classifyVerifyError` returns `'failed'` for any status below 500 except the claimed 409. Two cases that should be retryable are reported as failures:
- 429 from the 30/15-min `ENTITLEMENT_RATE_LIMITED` limiter or the general per-IP `apiLimiter`.
- 409 `IDEMPOTENCY_IN_FLIGHT`.

The user has just been charged, and the message says "We couldn't confirm your purchase yet". The transaction stays unfinished, so it can be recovered, but the UI points at the wrong action. WR-07 makes the limiter easier to hit.

**Fix:**
```ts
if (status === 429) return 'transient';
if (status === 409 && getApiErrorCode(error) === 'IDEMPOTENCY_IN_FLIGHT') return 'transient';
```

### WR-04: [WARNING] The StoreKit plugin never listens to `Transaction.updates`

**File:** `mobile/plugins/kumaun-store/ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift:8-130`

**Issue:** Apple requires a `Transaction.updates` listener from app launch. Without it, three kinds of event are only noticed on the next app resume, and only when the server status is not `active`:
- Ask-to-Buy approvals.
- Interrupted or SCA purchases that finish outside `product.purchase()`.
- Purchases made on another device.

When the server already says `active` (claimed from another device), `recheckEntitlements` skips. The local transaction is then never finished and StoreKit keeps re-delivering it. Xcode also logs "Making a purchase without listening for transaction updates risks missing successful purchases."

**Fix:** In `load()`, start a `Task` that iterates `Transaction.updates`. For each `.verified` transaction of the product, emit a plugin event (`notifyListeners("transactionUpdated", transactionDictionary(...))`). On the JS side, call `verifyAll` and `finish`. Also finish the transaction when the server already reports `active`.

### WR-05: [WARNING] Free limit is hard-coded to 25 in user copy while the server limit is configurable; `upgradeLimitFrom` is dead code

**File:** `frontend/lib/entitlements/copy.ts:4,16,39-42`; `frontend/lib/offline/status/describe-op.ts:16-23`; `frontend/lib/entitlements/upgrade-error.ts:17-22`

**Issue:** `FREE_PANTRY_LIMIT` accepts 1-1000 (`env.schema.ts`), and the server returns `limit` in both the 403 details and `/entitlements/me`. Every user-facing string still says "25", so any change to the env var makes the paywall copy and the outbox reasons wrong. `upgradeLimitFrom()` was written to solve this but has no callers.

**Fix:** Turn these strings into functions of `limit`, e.g. `chipFree: (n) => \`Free: ${n} pantry items\``. Feed them from `me.limits.pantry`, or from `upgradeLimitFrom(error)` / `lastError` details for outbox rows. Store `details.limit` in the outbox `LastError` when parking.

### WR-06: [WARNING] Purchase that comes back `revoked` shows no message

**File:** `frontend/lib/entitlements/view-model.ts:105-122`; `frontend/lib/hooks/use-entitlement.ts:60-64,139-147`

**Issue:** `OUTCOME_TEXT` has no `revoked` entry, and `flowAfter('revoked')` returns `idle`. After paying, the sheet silently returns to the offer state. This happens when the server applied a stale or refunded record and answered `status: 'revoked'`, and the same applies to a revoked restore. A user who was just charged gets no feedback.

**Fix:** Add `revoked: { tone: 'error', text: C.descRevoked + ' Contact support if you were charged.' }`, or a dedicated copy key, and cover it in `view-model.test.ts`.

### WR-07: [WARNING] Each `useEntitlement` instance re-verifies on mount and on every resume, sometimes before `/me` loads

**File:** `frontend/lib/hooks/use-entitlement.ts:91-127`

**Issue:** `statusRef` starts as `'none'`. On a fresh install there is no localStorage placeholder, so the mount-time `recheck()` runs before `/me` resolves and POSTs `/verify` for every current entitlement, even for users who are already unlocked.

Every mounted instance (the Settings `NativeCard` and the `OpenUpgradeSheet`) also registers its own `appStateChange` listener, so each resume fires N verifies. For a user whose purchase is `claimed-elsewhere`, every resume sends another 409.

These calls use up the 30/15-min verify limiter that a real purchase also needs (see WR-03).

**Fix:** Run the recheck once, in a single app-level owner (e.g. next to `UpgradeSheetHost` in the layout, gated on `native`). Wait until `query.isSuccess` is true and use `query.data.status`. Debounce resume events and stop rechecking after a `claimed` result for the session.

## Info

### IN-01: [WARNING] Monthly AI refund can decrement a counter that this request never incremented

**File:** `backend/src/modules/ai/ai.orchestrator.ts:143-178`; `backend/src/modules/ai/ai-quota.repository.ts:87-101`

**Issue:** `Reservation` always carries `month`, but `reserveQuota` increments `usermonth:` only when `userMonthlyLimit > 0`. A failed AI call by a free user (monthly disabled) decrements a `usermonth` row left over from an earlier paid period in the same month (e.g. after a refund).

**Fix:** Return `month: undefined` from `reserveOrThrow` when `limits.userMonthly` is null.

### IN-02: [WARNING] Two observers on the same query key use different `queryFn`s

**File:** `frontend/lib/hooks/use-pantry-add-gate.ts:41-46` vs `frontend/lib/hooks/use-entitlement.ts:79-89`

**Issue:** Both observe `ENTITLEMENT_QUERY_KEY`. Only the `use-entitlement` version writes the localStorage cache and sets `placeholderData`. Whichever observer triggers the fetch decides the behaviour.

**Fix:** Export one `entitlementQueryOptions(userId)` and use it in both places.

### IN-03: [WARNING] Webhook answers 400 when verification is not configured, and for notifications without `data`

**File:** `backend/src/modules/entitlements/notifications.service.ts:30-40`; `backend/src/modules/entitlements/apple-verifier.ts:185-192`

**Issue:** `not_configured` (`APPLE_APP_APPLE_ID` unset) maps to 400 `INVALID_TRANSACTION` rather than 503. Notification types that carry `summary` or `externalPurchaseToken` instead of `data` always fail with 400. Apple keeps retrying both.

**Fix:** Map `not_configured` to 503, and take the environment from `summary.environment` / `externalPurchaseToken` when `data` is missing (or return 200 `ignored`).

### IN-04: [WARNING] `app_store_notifications` is never pruned

**File:** `backend/prisma/schema.prisma` (model `AppStoreNotification`)

**Issue:** The dedupe table only needs to cover Apple's retry window (about 3 days), but it grows forever.

**Fix:** Add a `receivedAt` index and prune rows older than about 30 days in the existing housekeeping job.

### IN-05: [WARNING] Product id is hard-coded on the client but configurable on the server

**File:** `frontend/lib/native/store/store-plugin.ts:4`; `backend/src/config/env.schema.ts` (`IAP_PRODUCT_ID`)

**Issue:** If `IAP_PRODUCT_ID` changes, every verify returns 400 `INVALID_TRANSACTION`.

**Fix:** Return `productId` from `/entitlements/me` (it is already there) and buy that id, or drop the env override.

### IN-06: [WARNING] Settings page checks `native` twice

**File:** `frontend/app/(app)/settings/page.tsx:89`; `frontend/components/settings/kumaun-full-card.tsx:125-128`

**Issue:** `KumaunFullCard` already renders `KumaunFullWebNote` on web, so the page-level ternary is redundant.

**Fix:** Render `<KumaunFullCard />` unconditionally.

### IN-07: [WARNING] Signing scripts put secrets on the command line and replace the keychain search list

**File:** `mobile/scripts/setup-signing.sh:20,23,41-45`

**Issue:**
- `security unlock-keychain -p`, `create-keychain -p` and `-passout pass:` expose passwords in `ps` output while they run.
- `list-keychains -s "$KC" login` drops any other user keychains from the search list.

**Fix:** Pipe passwords via stdin or a file (`-passout file:`, `security unlock-keychain` with no `-p`, which prompts, or `-p "$(...)"` inside a subshell with a short lifetime). Append to the current list (`security list-keychains -d user -s "$KC" $(security list-keychains -d user | tr -d '"')`).

### IN-08: [WARNING] `asc-profile.mjs` deletes the working profile before creating its replacement

**File:** `mobile/scripts/asc-profile.mjs:17-29`

**Issue:** If the POST fails (cert revoked, API error), the only App Store profile is already gone and uploads break until the script succeeds again.

**Fix:** Create the new profile under a temporary name first, then delete the old ones, or delete only after a successful POST.

---

_Reviewed: 2026-10-11T12:21:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (deep on security-critical paths)_
