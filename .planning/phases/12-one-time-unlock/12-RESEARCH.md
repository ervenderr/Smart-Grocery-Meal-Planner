# Phase 12: One-Time Unlock - Research

**Researched:** 2026-10-11
**Domain:** StoreKit 2 non-consumable IAP in a Capacitor 8 (SPM) iOS shell, with Express/Prisma server-side entitlement verification
**Confidence:** MEDIUM-HIGH (server verification and plugin wiring verified by spike; Simulator purchase automation is a known-broken area)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Purchase client: StoreKit 2 through the best maintained Capacitor 8 / SPM-compatible plugin (verify maintenance; candidates: @capgo/native-purchases, RevenueCat's purchases-capacitor, a thin custom Swift plugin over StoreKit 2). PREFER NO third-party account/keys (owner has no RevenueCat account): a custom thin StoreKit 2 plugin or an account-free plugin that returns the signed JWS transaction. If RevenueCat is clearly far less work and risk, justify and list the owner steps.
- Server verification (source of truth): backend verifies the signed transaction JWS (x5c chain to Apple Root CA G3, bundleId, productId, environment Sandbox/Production, not revoked) and stores an `Entitlement` row (userId, productId, originalTransactionId, environment, status, purchasedAt, revokedAt) via additive migration; originalTransactionId unique per user to prevent sharing one purchase across accounts; `POST /entitlements/verify` (idempotent, uses Phase 8 Idempotency-Key), `GET /entitlements/me`. Handle refunds/revocation via App Store Server Notifications V2 endpoint (public, verified JWS) if feasible; otherwise document and re-check on app launch. Restore Purchases = re-verify current entitlements.
- Gating server-side: pantry create beyond 25 active items returns 403 `UPGRADE_REQUIRED` for free users (existing items never deleted, limits apply to creating); entitlement lifts it. Offline queued creates that hit the limit on replay must surface a clear conflict message in the Phase 11 Pending changes sheet (use its error classification). Server AI: keep current per-user quotas for free; paid users get a higher monthly allowance - define numbers in config with env overrides, no new provider changes.
- UI (iOS native only): Settings > 'Kumaun Full' card (status, price from StoreKit localizedPrice, Buy, Restore Purchases), upgrade sheet shown only when a limit is hit (25th+ pantry add) and dismissible, never blocking scanning/expiry alerts. Must show the product price from StoreKit, not hardcoded. Review-screenshot-ready (Apple requires a screenshot of the paywall for the IAP).
- Testing: Xcode StoreKit configuration file (Kumaun.storekit) with the product for Simulator tests + backend unit/integration tests with a test JWS signer; Sandbox purchase on a real device via TestFlight is human_needed. E2E Simulator: purchase flow with the .storekit config.
- Compliance: restore button present (Guideline 3.1.1), no external payment links, purchase history entry to add to the privacy manifest (docs/store/PrivacyInfo.proposed.xcprivacy) and PRIVACY-LABELS.md Purchase History already marked yes for 1.0.
- Account deletion must remove Entitlement rows (add to the all-models test).
- Product id must stay `app.kitcha.mobile.full`. Review screenshot capture is a follow-up after the UI exists.

### Claude's Discretion
Plugin vs custom plugin, schema details, copy, numbers for paid AI allowance, file layout. Rules: small files, immutability, zod at boundaries, tests 80%+, additive migrations only. Do NOT deploy backend or push iOS builds; you may push to origin main if everything is green and web unaffected.

Also from CONTEXT code_context: another agent is concurrently producing the first TestFlight build and touches mobile/ios project signing/icons/scripts. Do not edit `mobile/ios/App/App.xcodeproj/project.pbxproj` or `Info.plist` until `git log` shows its commit mentioning testflight/archive. Do backend + frontend + plugin source first; Xcode wiring last.

### Deferred Ideas (OUT OF SCOPE)
On-device AI (1.1), subscriptions, family sharing, web purchase, promo codes/offer codes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | User can buy Kitcha Full once for $9.99 (non-consumable IAP, regional tier) and restore on a new install via StoreKit 2 | Custom thin StoreKit 2 Capacitor plugin (Product.products, purchase, currentEntitlements, AppStore.sync); restore = currentEntitlements then AppStore.sync then server verify; GET /entitlements/me covers a new device that signs in |
| SUB-02 | Backend verifies the purchase and stores an entitlement; paid features gated server-side (unlimited pantry, server-AI monthly allowance) | `@apple/app-store-server-library` SignedDataVerifier (spike-verified), Entitlement model, 403 UPGRADE_REQUIRED in pantry create, paid AI limits in the quota path, ASSN V2 webhook for refund/revoke |
| SUB-03 | Free tier useful (scanning, expiry alerts, 25 items); upgrade prompt only at the limit and dismissible; no recurring charges | Gate only direct pantry create; offline replay classified as conflict "Needs upgrade"; UI-SPEC surfaces; non-consumable product |
</phase_requirements>

## Summary

The server half is low risk. Apple's official `@apple/app-store-server-library@3.1.0` (MIT, `github.com/apple/app-store-server-library-node`) verifies a client-supplied `jwsRepresentation` offline (x5c chain to a bundled Apple Root CA G3, bundleId, environment). I proved the approach in a scratch spike: an OpenSSL-generated root/intermediate/leaf chain (with Apple's two custom OID extensions) plus `jsonwebtoken` signing is accepted by `SignedDataVerifier`, and a wrong bundleId is rejected (`VerificationStatus.INVALID_APP_IDENTIFIER`=3). This gives a fully offline, deterministic test signer for Jest. The webhook uses the same verifier (`verifyAndDecodeNotification`); notification types REFUND, REFUND_REVERSED, REVOKE, ONE_TIME_CHARGE, TEST exist in the library enum.

The client half is the risky one. Recommendation: write a thin custom Swift StoreKit 2 plugin (~150 lines) as a local npm package under `mobile/plugins/kumaun-store`, referenced from `mobile/package.json` as a `file:` dependency. Verified in the installed Capacitor CLI source: `cap sync` discovers any dependency whose `package.json` has a `capacitor` key and whose root has a `Package.swift`, then writes it into `CapApp-SPM/Package.swift` itself. That means plugin registration needs NO edit to `project.pbxproj` or `Info.plist`. The only unavoidable Xcode edits are the optional scheme StoreKit config and capability, and those go last. `@capgo/native-purchases@8.9.2` (MPL-2.0, updated 2026-10-09, Capacitor >=8) is a viable account-free fallback that already returns `jwsRepresentation`, but it is ~1,500 lines of Swift covering subscriptions/Android/offer codes, with a Package.swift that sniffs Xcode SDK files at manifest-evaluation time. RevenueCat is not justified (needs an account and keys we do not have, adds a vendor to the payment path, and the server must still be the source of truth).

The biggest planning risk is testing. Command-line StoreKit config injection is unreliable: Apple Developer Forums thread 826971 (FB22237318 / FB23721564) reports `xcodebuild test` does not push the scheme's `.storekit` file to `storekitd` on the iOS 26.5 simulator runtime, which is the only runtime installed here. The Simulator `Product.products` call returns empty when launched via `simctl` without the Xcode IDE. So the purchase E2E and the review-screenshot capture cannot be a fully scripted CLI job; plan a flag-gated mock store for scripted UI E2E (UI-SPEC already asks for a non-production hook) and mark real StoreKit purchase checks as human_needed (Xcode Cmd+R once, then TestFlight sandbox).

**Primary recommendation:** Custom thin local StoreKit 2 plugin + `@apple/app-store-server-library@3.1.0` on the server + Postgres `entitlements` table, gate only `POST /pantry`, add paid AI limits inside the existing atomic quota path (monthly scope reuses the `ai_usage` table, no schema change), and do all Xcode project wiring last.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Price display, purchase, restore, current entitlements | iOS native plugin (StoreKit 2) | Browser/Client (React UI) | Only StoreKit knows the localized price and holds signed transactions |
| Transaction authenticity and entitlement truth | API / Backend | Database | JWS verification and the 25-item/AI gates must be unforgeable by the client |
| 25-item limit enforcement | API / Backend | Browser/Client (UI hint only) | Client count is a hint; offline replays must be re-judged by the server |
| Refund/revoke handling | API / Backend (ASSN V2 webhook) | Database | Apple pushes server-to-server; client cannot be trusted |
| Upgrade sheet / Settings card / Pending-change copy | Browser/Client | — | UI-SPEC surfaces |
| Paid AI allowance | API / Backend | Database (`ai_usage`) | Extends existing atomic quota |
| StoreKit test config, capability | Xcode project (iOS) | — | Wiring last, human-verified |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@apple/app-store-server-library` | 3.1.0 (npm modified 2026-05-06; first published 2023-06) | `SignedDataVerifier` for transaction JWS and ASSN V2 `signedPayload` | Apple's own library (repo under github.com/apple); spike-verified in this session. Depends on `jsrsasign`, `jsonwebtoken`, `node-fetch@2`, `base64url`. Node 16+ (backend runs node:22-alpine) [VERIFIED: npm registry + local spike; slopcheck unavailable, see audit] |
| Custom local plugin `kumaun-store` (Swift, StoreKit 2) | n/a (iOS 15+ matches `.iOS(.v15)` in CapApp-SPM) | `getProduct`, `purchase`, `currentEntitlements`, `sync` | No third-party account; returns `VerificationResult.jwsRepresentation` |
| `zod` | ^4.6.5 (already in backend) | Request/env validation | Existing convention (env.schema.ts) |
| `@capacitor/core` | 8.5.3 (already pinned) | `registerPlugin('KumaunStore')` in the frontend wrapper | No npm install needed in `frontend/` for a local plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsonwebtoken` | ^9.0.2 (already in backend) | Sign test JWS in Jest | Test signer only |
| `openssl` CLI | 4.0.3 here | One-time generation of the committed test PKI | Fixture script; run by a human/agent once, output committed |
| `jose` | 6.2.12 | NOT needed | Only if you drop Apple's library; do not add |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Swift plugin | `@capgo/native-purchases` 8.9.2 | No Swift to write and it already exposes `purchaseProduct` (returns `jwsRepresentation`), `restorePurchases` (`AppStore.sync`), `getPurchases({onlyCurrentEntitlements})`. Costs: 1,561 Swift lines, MPL-2.0, `Package.swift` reads Xcode SDK swiftinterface files, auto-finishing transaction listener, exact-pin and verify-deps entry needed. Keep as documented fallback behind the same TS interface |
| Custom plugin | `@revenuecat/purchases-capacitor` 13.7.3 (MIT, Capacitor >=8) | Needs RevenueCat account and API keys; owner has none. Reject |
| Apple library | Manual x5c verify with `node:crypto`/jose | Must hand-roll Apple OID checks, chain rules, OCSP. Reject |

**Installation:**
```bash
# backend/
npm install @apple/app-store-server-library@3.1.0 --save-exact
# mobile/  (local plugin; after creating mobile/plugins/kumaun-store with package.json + Package.swift)
npm install ./plugins/kumaun-store          # writes "kumaun-store": "file:plugins/kumaun-store"
npx cap sync ios                            # regenerates CapApp-SPM/Package.swift (do this in the wiring wave)
```

**Version verification:** `npm view @apple/app-store-server-library version` -> 3.1.0 (2026-05-06); `npm view @capgo/native-purchases version` -> 8.9.2 (2026-10-09); `npm view @revenuecat/purchases-capacitor version` -> 13.7.3 (2026-10-09). [VERIFIED: npm registry, 2026-10-11]

## Package Legitimacy Audit

slopcheck could not be installed (no `pip` on this machine), so per protocol every package is `[ASSUMED]` for legitimacy and the planner must gate the install behind `checkpoint:human-verify` (or the repo's own `mobile/scripts/verify-deps.mjs` pattern: name, exact version, repository host, install scripts).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @apple/app-store-server-library | npm | 3.3 yrs (2023-06) | not checked | github.com/apple/app-store-server-library-node (linked from Apple docs) | unavailable | Approved pending human-verify checkpoint [ASSUMED]; no postinstall script (`npm view scripts.postinstall` empty) |
| @capgo/native-purchases (fallback only) | npm | not checked | not checked | github.com/Cap-go/capacitor-native-purchases | unavailable | Only if fallback taken; flagged, no postinstall script |

**Packages removed due to slopcheck [SLOP] verdict:** none (tool unavailable)
**Packages flagged as suspicious [SUS]:** none known. Transitive `jsrsasign` is a long-lived crypto lib; add `npm audit` output to the install task and note that the spike's `npm audit` flagged only unrelated moderate `uuid` advisories under `@capacitor/cli` (dev tool).

## Architecture Patterns

### System Architecture Diagram

```
 iOS App (WKWebView, static export)
 ┌────────────────────────────────────────────────────────────────────┐
 │ UpgradeSheet / KumaunFullCard (React)                              │
 │     │ useStore() ──► lib/native/store/* (TS facade, injectable)    │
 │     │                  │ registerPlugin('KumaunStore')             │
 │     │                  ▼                                           │
 │     │          KumaunStore.swift (StoreKit 2)                      │
 │     │   getProduct ► Product.products(for:)  ─► {displayPrice}     │
 │     │   purchase   ► product.purchase() ─► .verified(tx).jws       │
 │     │   currentEntitlements ► Transaction.currentEntitlements      │
 │     │   sync (Restore tap only) ► AppStore.sync()                  │
 │     ▼ jws                                                          │
 └─────┼──────────────────────────────────────────────────────────────┘
       │ POST /api/v1/entitlements/verify {signedTransaction}  (Bearer + Idempotency-Key)
       ▼
 Express: authenticate ► entitlementLimiter ► idempotency ► zod ► verify service
       │  SignedDataVerifier(rootG3, onlineChecks, env, bundleId[, appAppleId])
       │  checks: productId, bundleId, env, type, no revocationDate
       │  claim: unique(environment, originalTransactionId) ─► 409 if other user
       ▼
 Postgres: entitlements  ◄── GET /entitlements/me (client hint + new-device sync)
       ▲
       │ upsert/revoke by originalTransactionId, dedupe notification_uuid
 Apple ASSN V2 ──POST /api/v1/webhooks/app-store {signedPayload}──► verifyAndDecodeNotification
       (REFUND, REVOKE, REFUND_REVERSED, ONE_TIME_CHARGE, TEST)

 Gate points (server):  POST /pantry ─► count(deleted_at IS NULL) >= FREE_LIMIT && !active ─► 403 UPGRADE_REQUIRED
                        AI reserveQuota ─► limits chosen by isEntitled(userId)
 Offline replay:        outbox drain ─► 403 UPGRADE_REQUIRED ─► classify → park('conflict', code) ─► "Needs upgrade" row
```

### Recommended Project Structure
```
backend/src/modules/entitlements/
├── entitlements.routes.ts        # /entitlements/verify, /entitlements/me (auth+limiter+idempotency)
├── entitlements.controller.ts
├── entitlements.validation.ts    # zod: { signedTransaction: string (max 16KB) }
├── entitlements.service.ts       # verify -> claim -> upsert; getStatus; isEntitled
├── apple-verifier.ts             # builds SignedDataVerifier per environment; loads root certs
├── apple-certs/AppleRootCA-G3.cer   # committed, sha256 checked in a test
├── notifications.service.ts      # apply REFUND/REVOKE/REFUND_REVERSED, dedupe
├── notifications.routes.ts       # public POST /webhooks/app-store
└── entitlements.constants.ts     # FREE_PANTRY_LIMIT default, error codes
backend/tests/helpers/apple-test-signer.ts   # signs JWS with committed test PKI
backend/tests/fixtures/apple-test-pki/       # root.der + leaf key + chain (test only, 100y validity)
mobile/plugins/kumaun-store/
├── package.json                  # name, version, "capacitor": {"ios": {"src": "ios"}}
├── Package.swift                 # same shape as @capacitor/share (SPM, iOS 15)
└── ios/Sources/KumaunStorePlugin/KumaunStorePlugin.swift
frontend/lib/native/store/
├── store-plugin.ts               # registerPlugin + StorePlugin interface (TS)
├── store-service.ts              # pure orchestration with injected deps (testable)
├── mock-store.ts                 # flag-gated, compiled out of release (UI-SPEC test hook)
└── use-entitlement.ts            # react-query: GET /entitlements/me + verify mutation
frontend/lib/api/entitlements.ts
frontend/components/entitlements/{upgrade-sheet,upgrade-sheet-host}.tsx
frontend/components/settings/kumaun-full-card.tsx
```

### Pattern 1: Verifier per environment, Sandbox always available
Decode the JWS payload unverified only to read `environment`, then verify with the matching verifier. Construct both once at boot (lazy).
```typescript
// Source: @apple/app-store-server-library dist/jws_verification.d.ts (3.1.0), verified by spike
import { SignedDataVerifier, Environment, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
const roots = [readFileSync(ROOT_G3_PATH)];           // DER
const sandbox = new SignedDataVerifier(roots, onlineChecks, Environment.SANDBOX, bundleId);
// Production REQUIRES appAppleId or the constructor throws:
const production = appAppleId ? new SignedDataVerifier(roots, onlineChecks, Environment.PRODUCTION, bundleId, appAppleId) : null;
const tx = await verifier.verifyAndDecodeTransaction(signedTransaction);
// then assert tx.bundleId, tx.productId === env.IAP_PRODUCT_ID, tx.type === 'Non-Consumable', !tx.revocationDate
```
App Review and TestFlight purchases are Sandbox, so the production API must always accept Sandbox transactions.

### Pattern 2: Atomic limit check inside a transaction
In `PantryService.createItem`: open `prisma.$transaction`, `SELECT pg_advisory_xact_lock(hashtextextended(${'pantry-cap:' + userId}, 0))`, (1) if `id` supplied and a row exists for this user return the replay unchanged BEFORE counting, (2) skip the count if entitled, (3) `count({ userId, deletedAt: null }) >= limit` throws `AppError('...', 403, true, { code: 'UPGRADE_REQUIRED', details: { limit, current, feature: 'pantry_items' } })`, (4) create. The existing `lockUserPantry` locks only existing rows and does not stop concurrent inserts, so use the advisory lock. The error handler already spreads `details` and adds `code` + `error` to the body, so no handler change.

### Pattern 3: Monthly AI cap reuses `ai_usage`
Add scope `usermonth:<userId>` with `day` = first of the UTC month, incremented in the same transaction as the global and daily user counters. No new table or migration. `reserveQuota` gains optional `userMonthlyLimit`; `ai.orchestrator.reserveOrThrow` picks limits from `isEntitled(req.userId)` (one indexed lookup).

### Anti-Patterns to Avoid
- **Trusting the client:** never accept `{isFull: true}`; the verify route only trusts the verified JWS.
- **Calling `AppStore.sync()` automatically:** it prompts for Apple ID sign-in; only on the Restore tap.
- **Production-only verifier:** App Review would fail with a sandbox transaction.
- **Skipping Apple's `Environment.XCODE` check in production:** `SignedDataVerifier` returns decoded data WITHOUT signature verification for `Xcode`/`LocalTesting` environments (verified in `verifyJWT`). Never construct such a verifier when `NODE_ENV=production`; gate behind a non-production-only env flag (see pitfalls).
- **Using `appAccountToken`:** binding to the Kumaun user id would break restore after delete-account + re-signup (new user id, same Apple ID). Do not set it; claim by `originalTransactionId`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| x5c chain, OID, OCSP verification | custom node:crypto/jose chain walker | `SignedDataVerifier` | Apple OIDs `1.2.840.113635.100.6.11.1` (leaf) and `.6.2.1` (intermediate), chain length 3, dates, OCSP, caching |
| ASSN V2 decoding | manual JWS parse | `verifyAndDecodeNotification` (also checks bundleId/environment/appAppleId) | Nested `signedTransactionInfo` needs a second verify |
| Purchase UI sheet | custom native paywall | existing `Modal`, `Button`, `Card` | UI-SPEC says reuse |
| Idempotency | new dedupe store | Phase 8 `idempotency` middleware | Already mounted per router |
| Quota counters | new usage table | `ai_usage` + `reserveQuota` | Atomic INSERT..ON CONFLICT already proven |
| Offline conflict UI | new row component | `PendingChangeRow` conflict badge + `reasonCopy` | Phase 11 contract |

## Runtime State Inventory

Not a rename/refactor phase (additive migration). Omitted.

## Common Pitfalls

### Pitfall 1: Test PKI missing Apple OIDs
**What goes wrong:** Library throws VERIFICATION_FAILURE for any self-made chain.
**Why:** It requires leaf OID `1.2.840.113635.100.6.11.1`, intermediate OID `1.2.840.113635.100.6.2.1`, `intermediate.ca`, issuer/subject matching, and exactly 3 x5c certs (only first 2 are used; root is taken from the trusted list).
**How to avoid:** Generate with the spike recipe (below) and commit root.der + leaf key + chain. Use 36500-day validity. With `enableOnlineChecks=false` the library checks dates against the JWS `signedDate`, so tests are deterministic.
**Warning signs:** `VerificationStatus.VERIFICATION_FAILURE (1)` on a valid-looking chain.

### Pitfall 2: Production verifier needs `appAppleId`
The constructor throws if `Environment.PRODUCTION` and `appAppleId` is undefined. Add env `APPLE_APP_APPLE_ID` (numeric, from App Store Connect > App Information > Apple ID). Until set, production transactions must return 503 `IAP_NOT_CONFIGURED`, while Sandbox keeps working. Log a startup warning in production when unset.

### Pitfall 3: OCSP online checks vs old JWS
`enableOnlineChecks=true` swaps the effective date to now and does live OCSP fetches (30s timeout) to Apple. Recommend `IAP_ONLINE_CHECKS` default true in production, false in test/dev. Map `VerificationStatus.RETRYABLE_VERIFICATION_FAILURE (2)` to 503 `VERIFICATION_UNAVAILABLE` so the client treats it as transient; map other failures to 400 `INVALID_TRANSACTION` (do not echo exception details).

### Pitfall 4: AI prune and refund interplay
`pruneOldUsage(now, 14)` deletes `ai_usage` rows with `day < cutoff`; a monthly row keyed at the 1st of the month is up to 31 days old and would be pruned mid-month, silently resetting the cap. Change the prune to exclude `usermonth:%` scopes (or keep 62 days for them). `refundQuota` must also decrement the monthly scope. Account deletion deletes only `scope = user:${id}`; add `usermonth:${id}` too.

### Pitfall 5: Replay of an already-created item hits the limit
An offline create that reached the server before the connection dropped is replayed with the same client `id`. If the count check runs before the existing-id check, the replay returns 403 for an item that already exists. Check existing id (owner) first. Non-2xx responses are not cached by the idempotency middleware (reservation released), so retry after unlock with the same key works.

### Pitfall 6: Other pantry create path
`shopping-pantry.service.ts` (`createMany` when a shopping trip finishes) also creates pantry rows. Original recommendation was not to gate it. RESOLVED: gated inside the finish transaction (advisory lock + capacity check before createMany; 403 rolls back the whole finish), see Open Question 1.

### Pitfall 7: Webhook is public and behind origin/CORS middleware
`app.ts` mounts `originGuard` and CORS before routes. Apple calls have no `Origin` header. Verify in a supertest that a POST without Origin passes, and that `httpsRedirect` does not 301 the call (Apple will not follow it). Keep the 1 MB JSON limit. Return 200 for verified or already-seen or unknown-transaction notifications, 400 for invalid signature, 5xx for DB errors (Apple retries non-200).

### Pitfall 8: Webhook ordering and duplicates
Dedupe on `notificationUUID` (table `app_store_notifications`) and ignore a notification whose `signedDate` is older than `entitlements.last_signed_at`. REFUND_REVERSED must re-activate (status active, revokedAt null).

### Pitfall 9: Entitlement claimed by another user
`@@unique([environment, originalTransactionId])` makes a purchase belong to one Kumaun account; second claimant gets 409 `ENTITLEMENT_ALREADY_CLAIMED`. CONTEXT says "unique per user"; per-user uniqueness alone does not prevent sharing, so the DB constraint should be global per environment plus `@@unique([userId, productId])`. Account deletion cascades the row, freeing the purchase for a re-signup (restore then works).

### Pitfall 10: Simulator StoreKit config cannot be driven from the CLI
See Validation Architecture. Do not write an automated plan task that depends on `xcodebuild test` + SKTestSession on iOS 26.5; do not promise `simctl launch` price rendering.

### Pitfall 11: Drain classification
`classify()` currently maps unknown 4xx (including 403) to `park('invalid')`, which `canRetry` rejects (no Retry button). A 403 UPGRADE_REQUIRED must park as `conflict` with `code` preserved.

### Pitfall 12: `.xcodeproj` and Info.plist contention
Another agent edits both. The custom plugin approach touches neither (only `CapApp-SPM/Package.swift` via `cap sync`, which is also modified by that agent only if plugins change). Run `cap sync` and any scheme edit after `git log` shows the TestFlight/archive commit.

## Code Examples

### Test PKI recipe (spike-verified, OpenSSL 4.0.3)
```bash
# Source: scratch spike, accepted by SignedDataVerifier 3.1.0
openssl ecparam -name prime256v1 -genkey -noout -out root.key
openssl req -new -x509 -key root.key -sha256 -days 36500 -config root.cnf -out root.pem   # CA:TRUE, keyCertSign
# int.cnf: basicConstraints=critical,CA:TRUE; keyUsage=critical,keyCertSign,cRLSign; 1.2.840.113635.100.6.2.1=ASN1:NULL
openssl req -new -key int.key -subj "/CN=Kumaun Test Intermediate" -out int.csr
openssl x509 -req -in int.csr -CA root.pem -CAkey root.key -CAcreateserial -days 36500 -sha256 -extfile int.cnf -out int.pem
# leaf.cnf: basicConstraints=critical,CA:FALSE; keyUsage=critical,digitalSignature; 1.2.840.113635.100.6.11.1=ASN1:NULL
openssl x509 -req -in leaf.csr -CA int.pem -CAkey int.key -CAcreateserial -days 36500 -sha256 -extfile leaf.cnf -out leaf.pem
openssl pkcs8 -topk8 -nocrypt -in leaf.key -out leaf.pk8.pem
openssl x509 -in root.pem -outform der -out root.der
```
```typescript
// Test signer (spike-verified): x5c = [leaf, int, root] base64-DER, ES256
const tok = jwt.sign(payload, leafKeyPkcs8, { algorithm: 'ES256', header: { alg: 'ES256', x5c } });
new SignedDataVerifier([rootDer], false, Environment.SANDBOX, 'app.kitcha.mobile').verifyAndDecodeTransaction(tok);
```
Payload fields for the fixture: `transactionId, originalTransactionId, bundleId, productId, purchaseDate, originalPurchaseDate, quantity:1, type:'Non-Consumable', inAppOwnershipType:'PURCHASED', signedDate, environment:'Sandbox'`; add `revocationDate`/`revocationReason` for refund cases. For notifications sign `{notificationType:'REFUND', notificationUUID, signedDate, version:'2.0', data:{environment, bundleId, signedTransactionInfo}}`. Note the notification's `data.environment` must equal the verifier environment.

### Apple Root CA G3 (production trust anchor)
Downloaded from https://www.apple.com/certificateauthority/AppleRootCA-G3.cer on 2026-10-11: `CN=Apple Root CA - G3`, valid to 2039-04-30, SHA-256 `63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79` [VERIFIED: Apple PKI download, openssl]. Commit the DER and add a Jest test asserting that fingerprint so a swapped file fails CI.

### Plugin skeleton (Swift, StoreKit 2)
```swift
// Source: shape confirmed against @capgo/native-purchases 8.9.2 sources (jwsRepresentation, AppStore.sync, Transaction.currentEntitlements)
@objc(KumaunStorePlugin)
public class KumaunStorePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "KumaunStorePlugin"; public let jsName = "KumaunStore"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)]
  // purchase: Product.products(for:[id]).first?.purchase() -> .success(.verified(tx)) => resolve ["status":"success","jws": result.jwsRepresentation, "originalTransactionId": String(tx.originalID)]
  //           .userCancelled => ["status":"cancelled"]; .pending => ["status":"pending"]; .unverified => reject("UNVERIFIED")
  // currentEntitlements: for await r in Transaction.currentEntitlements { if case .verified(let tx) = r, tx.productID == id { jws.append(r.jwsRepresentation) } }
  // sync: try await AppStore.sync()   (prompts Apple ID; only from Restore tap)
  // finish: Transaction.unfinished / currentEntitlements match by originalID then await tx.finish() AFTER the server accepted it
}
```
Do not auto-finish on purchase; finish after `POST /entitlements/verify` succeeds so a failed verify is retried via `Transaction.unfinished`/launch re-check. Send `localizedPrice` as `product.displayPrice` and `price` as a string from `product.price` (Decimal) to avoid JSON float issues.

### Pantry gate error body (existing handler shape)
```json
{ "status": "error", "statusCode": 403, "message": "Free pantry limit reached", "code": "UPGRADE_REQUIRED", "error": "Free pantry limit reached", "limit": 25, "current": 25, "feature": "pantry_items" }
```

### Classification change (frontend)
```typescript
// lib/offline/outbox/classify-error.ts: before the final park('invalid')
if (s === 403 && f.code === 'UPGRADE_REQUIRED') return park('conflict', f);
// describe-op.ts: reasonCopy -> conflict && code === 'UPGRADE_REQUIRED' => UPGRADE copy;
//               rowBadge -> conflict && code UPGRADE_REQUIRED => { kind:'conflict', text:'Needs upgrade' }
// No new LastError.reason value, so persisted outbox rows and the SQLite shape are unchanged.
```
`canRetry` stays true for `conflict`. On web, the reason copy uses the web variant from UI-SPEC (decide via `isNative()`); the "Unlock Kumaun Full" action only renders when `isNative()`.

## Proposed Backend Design

### Schema (migration `20261017000000_entitlements`, additive)
```prisma
model Entitlement {
  id                    String    @id @default(uuid())
  userId                String    @map("user_id")
  productId             String    @map("product_id") @db.VarChar(100)
  originalTransactionId String    @map("original_transaction_id") @db.VarChar(40)
  latestTransactionId   String    @map("latest_transaction_id") @db.VarChar(40)
  environment           String    @db.VarChar(16)      // Sandbox | Production
  status                String    @db.VarChar(16)      // active | revoked
  purchasedAt           DateTime  @map("purchased_at")
  revokedAt             DateTime? @map("revoked_at")
  revocationReason      Int?      @map("revocation_reason")
  lastSignedAt          DateTime  @map("last_signed_at")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, productId])
  @@unique([environment, originalTransactionId])
  @@map("entitlements")
}
model AppStoreNotification {
  notificationUuid String   @id @map("notification_uuid") @db.VarChar(64)
  notificationType String   @map("notification_type") @db.VarChar(40)
  subtype          String?  @db.VarChar(40)
  environment      String   @db.VarChar(16)
  receivedAt       DateTime @default(now()) @map("received_at")
  @@map("app_store_notifications")
}
```
Add `entitlements Entitlement[]` to `User`. Hand-write the SQL in the migration folder following the existing style (`prisma migrate dev` is not required; Prisma stays on 5.22.x). `AppStoreNotification` has no user FK so it is not part of the account-deletion model completeness check (verify the DMMF test filters on a `userId` field).

### Endpoints
| Route | Auth | Behavior |
|-------|------|----------|
| `POST /api/v1/entitlements/verify` | JWT + limiter + Idempotency-Key | zod `{ signedTransaction }`; verify; assert `productId`, `type`, no `revocationDate`; claim/upsert; return `{ status, productId, environment, purchasedAt }`. Revoked transaction returns 200 `{ status: 'revoked' }` |
| `GET /api/v1/entitlements/me` | JWT | `{ status: 'active'\|'none'\|'revoked', productId, limits: { pantry: 25 \| null, aiDaily, aiMonthly } }` |
| `POST /api/v1/webhooks/app-store` | none (JWS-verified) | ASSN V2; see pitfalls 7-8 |

Error codes: 400 `INVALID_TRANSACTION`, 409 `ENTITLEMENT_ALREADY_CLAIMED`, 503 `VERIFICATION_UNAVAILABLE` / `IAP_NOT_CONFIGURED`, 403 `UPGRADE_REQUIRED` (pantry).

### Counting "active" items and AI numbers
Active = `PantryItem` rows with `deletedAt IS NULL`, regardless of quantity (zero-quantity items still occupy a slot; the user can delete). Free limit default 25, env `FREE_PANTRY_LIMIT` (int 1-1000).

AI (config via `env.schema.ts` + `env.config.ts` `ai` block, all env-overridable):
| Key | Default | Meaning |
|-----|---------|---------|
| `AI_USER_DAILY_LIMIT` | 20 (existing, unchanged for free) | Free per-user per day |
| `AI_PAID_USER_DAILY_LIMIT` | 40 | Paid per-user per day |
| `AI_FREE_MONTHLY_LIMIT` | 0 = disabled | Optional free monthly cap; see Open Question 2 |
| `AI_PAID_MONTHLY_LIMIT` | 600 | Paid per-user per UTC month |
| `AI_GLOBAL_DAILY_LIMIT` | 100 (existing) | Unchanged global spend guard, still binds first at low traffic |

The existing global daily cap of 100 is the true spend guard; paid numbers only change relative fairness. These numbers are [ASSUMED] product choices.

### New env keys (zod)
`APPLE_BUNDLE_ID` (default `app.kitcha.mobile`), `APPLE_APP_APPLE_ID` (optional int), `IAP_PRODUCT_ID` (default `app.kitcha.mobile.full`), `IAP_ONLINE_CHECKS` (bool, default true in production else false), `IAP_ALLOW_XCODE_ENV` (bool, default false; `superRefine` must reject it when `NODE_ENV=production`). No secret is needed for verification (App Store Server API credentials are NOT required for JWS verification or notifications).

## Frontend Notes

- **Native detection:** `isNative()` from `lib/platform/native.ts` (already used by `native-share.ts`, `native-haptics.ts`); `usePlatform()` is used on the Settings page. Wrap the plugin with `registerPlugin('KumaunStore')` lazily, only when `isNative()`.
- **Settings is tabbed** (`app/(app)/settings/page.tsx`: profile/password/preferences/data/privacy/device). UI-SPEC wants the Kumaun Full card first and visible without scrolling: render it above the tab strip (native only), and the web note in the same slot on web.
- **Offline outbox:** classification lives in `lib/offline/outbox/classify-error.ts` (`TransportFailure.code` is already passed through to `LastError.code`); copy in `lib/offline/status/describe-op.ts`. Add tests next to `classify-error.test.ts` and `describe-op` tests. Also check `lib/api/offline-error.ts` / `errors.ts` so the ONLINE create path (non-queued) exposes `status 403` + `code` to the Add Item form so it can open the upgrade sheet.
- **After unlock:** invalidate pantry queries and re-run the parked rows via the existing Retry/Retry all path (`UPGRADE_REQUIRED` rows are `failed`, so "Retry all" works). Do not auto-discard.
- **Entitlement hint:** `GET /entitlements/me` should be added to the offline cache only as a stale hint; the server remains the judge. On sign-in and app resume (native), call plugin `currentEntitlements`; if non-empty and the server says none, POST verify (this is also the launch re-check for refunds that were missed).
- **Mock store:** the UI-SPEC non-production hook should swap in `mock-store.ts` through an `NEXT_PUBLIC_*` flag that is `undefined` in the release build script (`mobile/scripts/build-ios.sh`/`verify-bundle.sh` already scrub env for release; add a bundle grep that fails if the mock string is present).

## Xcode / StoreKit Wiring (LAST wave)

1. `mobile/ios/App/App/Kumaun.storekit` (JSON file: `identifier`, `nonRenewingSubscriptions: []`, `products: [{ "type": "NonConsumable", "productID": "app.kitcha.mobile.full", "referenceName": "Kumaun Full (one-time unlock)", "displayPrice": "9.99", "familyShareable": false, "internalID": "<unique>", "localizations": [{ "locale": "en_US", "displayName": "Kumaun Full", "description": "Unlimited pantry and more AI ideas." }] }]`, `settings`, `subscriptionGroups: []`, `version`). Keep it out of the app bundle's Copy Bundle Resources (it is a test artifact; referencing it from the scheme does not need target membership). Generating this by hand is feasible; open it once in Xcode to confirm it loads. [ASSUMED format from Xcode-generated files; verify by opening in Xcode.]
2. Attach: shared scheme `App` > Run > Options > StoreKit Configuration, or `xcshareddata/xcschemes/App.xcscheme` `<StoreKitConfigurationFileReference identifier="../../Kumaun.storekit">` (path relative to the scheme). No `xcshareddata` exists today; creating a shared scheme is a project change, so it belongs after the TestFlight agent.
3. Capability: In-App Purchase capability is only an App ID capability for StoreKit 2 (no entitlements file key). Nothing to add to `Info.plist`. If the signing agent uses automatic signing, App Store Connect already has the product. Confirm in Xcode > Signing & Capabilities during the human step. [ASSUMED from Apple behavior; confirm]
4. Plugin registration: `cap sync ios` regenerates `CapApp-SPM/Package.swift` with a new `.package(name: "KumaunStore", path: "../../../plugins/kumaun-store")` line (mirrors the existing `../../../node_modules/...` entries). No pbxproj edit.
5. Privacy manifest: add `NSPrivacyCollectedDataTypePurchaseHistory` (linked true, tracking false, AppFunctionality) per `docs/store/PrivacyInfo.proposed.xcprivacy` into `mobile/ios/App/App/PrivacyInfo.xcprivacy` (that file is currently untracked, owned by the other agent), plus PRIVACY-LABELS.md note. Do this last.
6. Repo scripts: `mobile/scripts/verify-deps.mjs` `checkParity()` only tracks `@capacitor/` and `@aparajita/` names, so a `file:` plugin dependency is not flagged. Add the local plugin to a separate "local plugins exist" assertion if desired.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App receipt + `verifyReceipt` | StoreKit 2 JWS verified by `SignedDataVerifier` | `verifyReceipt` deprecated by Apple | Use JWS only |
| `.storekit` config run via CLI | IDE-driven (Cmd+R/Cmd+U) for config sync | iOS 26.5 runtime regression | Do not script it |
| `railway.json` | not relevant here | n/a | n/a |

**Deprecated/outdated:** `next-pwa` etc. irrelevant. RevenueCat-recommendation in `docs/store/IAP.md` is superseded by CONTEXT (no RevenueCat account); update that doc's "Recommendation" section to match (small doc task).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Packages are legitimate (slopcheck unavailable) | Package Legitimacy Audit | Install gated by human-verify checkpoint |
| A2 | Paid AI numbers (40/day, 600/month, free monthly disabled) | Proposed Backend Design | Owner may want different allowances; env-overridable |
| A3 | `.storekit` JSON schema fields and scheme attachment path syntax | Xcode Wiring | Human opens in Xcode once to confirm |
| A4 | In-App Purchase capability needs no entitlements/Info.plist entry for StoreKit 2 | Xcode Wiring | Human confirms in Signing & Capabilities |
| A5 | ASSN V2: Apple retries non-200; sandbox retries are shorter; two URLs (production + sandbox) configured per app in App Store Connect > App Information | Pitfall 7, owner steps | Missed refunds until launch re-check; owner steps may differ in UI |
| A6 | (Superseded) Shopping-finish pantry creates ARE gated per orchestrator decision; see Open Question 1 RESOLVED | Pitfall 6 | n/a |
| A7 | `AppStore.sync()` prompts for Apple ID and should be user-initiated; `currentEntitlements` first | Plugin skeleton | Extra sign-in prompts if wrong |
| A8 | `originGuard`/`httpsRedirect` allow Apple's origin-less POST | Pitfall 7 | Webhook silently rejected; verify with a supertest |
| A9 | Xcode 26.6 + iOS 26.5 sim still cannot sync `.storekit` from CLI (forum thread is mixed: DTS says fixed in 26.6 RC, a July reply says it persists) | Validation | Planner should include a 10-minute probe task, not rely on it |

## Open Questions (RESOLVED)

1. **Should shopping-finish (bought-it) pantry creates be gated?**
   - Known: only `POST /pantry` and the shopping merge create pantry rows (plus the reviewer seed tool).
   - Unclear: owner intent for the bypass.
   - Recommendation: do not gate; count them; revisit in 1.1.
   - RESOLVED: Gate it (orchestrator decision per CONTEXT "403 UPGRADE_REQUIRED for free users beyond 25"). `applyPantryMergeInTx` checks capacity with the same advisory lock + `assertPantryCapacity(adding = plan.creates.length)` inside the finish transaction; a 403 rolls the whole finish back (trip not completed, nothing created). Updates-only merges and finishes without addToPantry are not blocked. Plan 12-07 (backend), 12-05 / 12-12 (frontend copy and sheet).
2. **"More AI recipe ideas each month" truthfulness.** Free has only a daily cap (20/day = up to 600/month), so a monthly paid cap of 600 is not "more". Recommend enabling `AI_FREE_MONTHLY_LIMIT=100` and paid 600 (a behavior change for free users, contradicting "keep current per-user quotas for free"), OR soften the benefit copy to "Higher daily AI limit". Needs owner decision; default ships with free unchanged and paid 40/day + 600/month.
   - RESOLVED: Free unchanged (20/day, no monthly cap: `AI_FREE_MONTHLY_LIMIT=0`); paid 40/day + 600/month, all env-overridable (12-01, 12-08). Benefit copy softened to "More AI recipe ideas every day" (12-10).
3. **`APPLE_APP_APPLE_ID` value** (numeric App Store Connect Apple ID) is required before Production verification; owner step.
   - RESOLVED: Owner supplies it as Railway variable `APPLE_APP_APPLE_ID`; until set, Production JWS return 503 `IAP_NOT_CONFIGURED` while Sandbox works (12-06). Tracked in IAP.md "Owner steps" (12-13).
4. **Simulator E2E feasibility** on this machine (see Validation); resolve with a quick probe in Wave 0.
   - RESOLVED: Probe runs in 12-03 (SKTestSession test target, XCTSkip if products are empty) and its result is recorded. Scripted UI E2E uses the E2E-only mock store; a real Simulator `.storekit` purchase and the TestFlight sandbox purchase are human_needed regardless of the probe (12-14 validation map).
5. **Offline entitlement cache.** Whether to persist the entitlement hint in the offline SQLite cache (Phase 11) or keep it in memory/react-query only. Recommend react-query + localStorage key per user; the server decides anyway.
   - RESOLVED: Cache the last-known entitlement (GET /entitlements/me) in localStorage keyed per user, for display only (initial card state offline); it never unlocks anything. The server stays authoritative for every gate. Implemented in `useEntitlement` (12-10).
6. **Package legitimacy (slopcheck unavailable).**
   - RESOLVED: Autonomous mode, no human checkpoint. The install task runs `npm view <pkg> name version repository.url scripts maintainers` and aborts unless version 3.1.0, repo github.com/apple/app-store-server-library-node, and no install/postinstall scripts; exact pin plus `npm audit` recorded (12-02). The KumaunStore plugin is a local `file:` package (no registry fetch).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | backend/frontend tests | yes | 24.9.0 local (Docker image node:22) | — |
| Xcode / xcodebuild | plugin compile check, wiring | yes | 26.6 (17F113) | — |
| iOS Simulator runtime | UI checks | yes | iOS 26.5 only (18.1, 26.2 unavailable) | Mock store for scripted E2E |
| openssl | generate test PKI | yes | 4.0.3 | — |
| Postgres (tests) | backend integration tests | existing test setup (`tests/setup.ts`, untracked `pgdata/`) | n/a | follow existing practice |
| slopcheck / pip | legitimacy gate | no | — | human-verify checkpoint |
| Apple sandbox tester / TestFlight device | real purchase | not agent-available | — | human_needed |
| Public backend URL for ASSN V2 | webhook registration | not deployed (do not deploy) | — | owner step after Railway deploy; fixtures cover tests |

**Missing with no fallback:** real-device sandbox purchase (human_needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | Jest 29 + ts-jest + supertest (`backend/jest.config.js`, roots `tests/`, 80% target) |
| Frontend framework | Vitest (`frontend/vitest.config.ts`, `npm test` = `vitest run`) |
| Quick run (backend) | `cd backend && npx jest tests/entitlements*.test.ts tests/pantry-limit.test.ts --coverage=false` |
| Quick run (frontend) | `cd frontend && npx vitest run lib/native/store lib/offline/outbox/classify-error.test.ts lib/offline/status` |
| Full suite | `cd backend && npm test` and `cd frontend && npm test` and `cd frontend && npm run lint` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SUB-02 | Valid sandbox JWS -> active entitlement; wrong bundle/product/env/tampered/expired chain/revoked rejected | unit+integration | `npx jest tests/entitlements-verify.test.ts` | Wave 0 |
| SUB-02 | Same originalTransactionId by 2nd user -> 409; replay with same Idempotency-Key replays | integration | `npx jest tests/entitlements-claim.test.ts` | Wave 0 |
| SUB-02 | Webhook REFUND/REVOKE revokes, REFUND_REVERSED restores, duplicate UUID ignored, bad signature 400, no-Origin accepted | integration | `npx jest tests/app-store-webhook.test.ts` | Wave 0 |
| SUB-02 | Root CA fingerprint pinned | unit | `npx jest tests/apple-root-cert.test.ts` | Wave 0 |
| SUB-02/03 | 26th create -> 403 UPGRADE_REQUIRED; entitled -> 201; soft-deleted not counted; existing-id replay not blocked; concurrent creates cannot exceed limit | integration | `npx jest tests/pantry-limit.test.ts` | Wave 0 |
| SUB-02 | Paid AI limits (daily + monthly), monthly row survives prune, refund decrements monthly | unit/integration | extend `tests/ai-quota.test.ts` | exists (extend) |
| SUB-02 | Env schema keys, IAP_ALLOW_XCODE_ENV rejected in production | unit | extend `tests/env.schema.test.ts` | exists (extend) |
| SUB-02 | Account deletion removes entitlements (DMMF completeness) | integration | extend `tests/helpers/user-owned-fixtures.ts` + `tests/account-deletion.test.ts` | exists (extend) |
| SUB-03 | 403 UPGRADE_REQUIRED parks as conflict with Retry enabled; badge "Needs upgrade"; web copy variant | unit | `npx vitest run lib/offline/outbox/classify-error.test.ts lib/offline/status` | exists (extend) |
| SUB-01/03 | Store service: price load, purchase success/cancel/pending, restore (entitlements then sync), verify-offline pending, no auto-prompt | unit (injected plugin) | `npx vitest run lib/native/store` | Wave 0 |
| SUB-01/03 | Upgrade sheet states, a11y, testids, never shown on web; Settings card states | component | `npx vitest run components/entitlements components/settings/kumaun-full-card` | Wave 0 |
| SUB-01 | Real StoreKit purchase + restore on device (sandbox) | manual | TestFlight | human_needed |
| SUB-01 | Simulator purchase with Kumaun.storekit | manual/probe | Xcode Cmd+R | human_needed (CLI unsupported on iOS 26.5, thread 826971) |
| SUB-03 | Review screenshot of upgrade sheet at 1290x2796 / 1320x2868 | semi-manual | `scripts/store/capture-screenshots.sh` after launching from Xcode with the storekit scheme | human_needed |

### Sampling Rate
- **Per task commit:** quick-run command for the touched area.
- **Per wave merge:** full backend + frontend suites, `npm run lint`, `npx tsc --noEmit` in both.
- **Phase gate:** full suites green, `cap sync`/SPM build of the plugin (`xcodebuild -scheme KumaunStore -destination generic/platform=iOS build` inside the plugin package, no signing), `mobile/scripts/verify-bundle.sh` (mock store absent from release), before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/fixtures/apple-test-pki/` + `scripts/gen-apple-test-pki.sh` + `tests/helpers/apple-test-signer.ts`
- [ ] `backend/tests/{entitlements-verify,entitlements-claim,app-store-webhook,apple-root-cert,pantry-limit}.test.ts`
- [ ] `frontend/lib/native/store/*.test.ts` with injected fake plugin
- [ ] Probe task: confirm whether `.storekit` loads in the CLI on this machine (decide scripted vs human_needed); no work depends on it

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT `authenticate` on verify/me |
| V3 Session Management | no (unchanged) | — |
| V4 Access Control | yes | Server-side gate keyed on user id; entitlement claim unique per purchase |
| V5 Input Validation | yes | zod: JWS string max length (16 KB), webhook body `{signedPayload}` string |
| V6 Cryptography | yes | Apple library only; pinned Root CA G3 fingerprint; never hand-roll |
| V7 Error handling/logging | yes | Do not log full JWS or exception details to clients; log originalTransactionId and user id only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/tampered JWS or self-signed chain | Spoofing/Tampering | `SignedDataVerifier` with Apple root only; bundleId/environment/product checks |
| `Xcode`/`LocalTesting` environment bypasses signature checks | Spoofing | Never build such a verifier in production; reject `IAP_ALLOW_XCODE_ENV` when `NODE_ENV=production` |
| One purchase shared by many accounts | Elevation | Unique `(environment, originalTransactionId)`; 409 on conflict |
| Replay of refunded transaction | Tampering | Reject JWS with `revocationDate`; webhook ordering via `last_signed_at` |
| Fake webhook calls | Spoofing | JWS verification is the auth; 400 on failure; dedupe UUID |
| Limit bypass via offline queue / concurrency | Tampering | Server check at replay, advisory lock around count+insert |
| Free-tier AI data exposure | Info disclosure | No new data sent to AI; purchase data stays in our DB |
| Sandbox purchases granting prod entitlement | Elevation (accepted) | Required for App Review; record `environment` and expose in logs |

## Sources

### Primary (HIGH confidence)
- npm registry (2026-10-11): `@apple/app-store-server-library` 3.1.0, `@capgo/native-purchases` 8.9.2, `@revenuecat/purchases-capacitor` 13.7.3, `jose` 6.2.12
- `@apple/app-store-server-library@3.1.0` tarball: `dist/jws_verification.{js,d.ts}`, `models/NotificationTypeV2`, `JWSTransactionDecodedPayload`, README, CHANGELOG (read locally)
- Local spike (scratchpad): OpenSSL-made chain + `jsonwebtoken` signed JWS accepted; wrong bundleId rejected
- `@capgo/native-purchases@8.9.2` tarball sources (Swift + Package.swift)
- Installed `@capacitor/cli` 8.5.3 `dist/plugin.js` and `ios/update.js` (plugin discovery via `capacitor` key + Package.swift)
- Repo: `backend/src/{middleware,modules/pantry,modules/ai,modules/users,config}`, `frontend/lib/{offline,platform,native}`, `mobile/{package.json,ios/App/CapApp-SPM/Package.swift,scripts}`
- Apple PKI: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer (fingerprint computed locally)

### Secondary (MEDIUM confidence)
- Apple Developer Forums thread https://developer.apple.com/forums/thread/826971 (CLI `.storekit` sync failure on iOS 26.5; DTS says fixed in Xcode 26.6 RC, later reply says not)
- RevenueCat docs/community (StoreKit config only honored when run through Xcode)

### Tertiary (LOW confidence)
- Apple documentation pages for StoreKit setup and ASSN receiving could not be fetched in full (only titles returned); `.storekit` format, scheme attachment, retry schedule are from training knowledge (A3, A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for server library and plugin discovery (both verified locally); MEDIUM for the custom Swift plugin (not yet compiled)
- Architecture: HIGH (follows existing idempotency, quota, error-handler, outbox patterns)
- Pitfalls: HIGH for code-derived ones (prune, replay order, Xcode env bypass, OIDs); MEDIUM for Apple retry/ASC UI details

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (StoreKit simulator behavior is fast-moving; recheck after the iOS 26.6 runtime ships)
