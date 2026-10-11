# In-App Purchase: Kumaun Full (non-consumable)

Status: IMPLEMENTED in code (Phase 12); App Store Connect product exists (MISSING_METADATA until the review screenshot is uploaded). Nothing is deployed from this repo by the agents: the Railway deploy, ASSN URL registration and all real-device checks are owner steps (see "Owner steps").

Field limits verified 2026-10-11 at https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information ; creation steps at https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases .

## Product definition

| Field | Value | Limit / note |
|-------|-------|--------------|
| Type | Non-Consumable | One-time, restorable. No subscription (3.1.2 rules do not apply). |
| Reference name | `Kumaun Full (one-time unlock)` | max 64 chars, internal only |
| Product ID | `app.kitcha.mobile.full` | Cannot be edited or reused after saving. Bundle id is `app.kitcha.mobile`. |
| Display name (en-US) | `Kumaun Full` | 2-30 chars |
| Description (en-US) | `Unlimited pantry and more AI ideas.` (35 chars) | max 45 chars. Still true of what shipped (unlimited pantry, higher AI allowance). |
| Price | USD 9.99 base | Pick the USD price point in "Price Schedule", then review each storefront. |
| Philippines | Open the price list and set PHP manually (see notes) | |
| Family Sharing | Off (recommended for v1) | Cannot be turned off once on, per Apple. |
| Availability | Same countries as the app | |
| Tax category | Default (apps/IAP) | |

Review notes text (matches shipped behavior; the full app-level text is in REVIEW-NOTES.md):

```
Kumaun Full is a one-time non-consumable unlock (no subscription). Free tier: up to 25 pantry items. To test: sign in with the demo account (see App Review Information), add pantry items until the 26th, tap Unlock Kumaun Full, then Restore Purchases under Settings > Kumaun Full. Free users keep barcode scanning, expiry reminders, recipes, meal plans and shopping lists.
```

### Philippines pricing notes
- Apple stores one price per storefront chosen from its fixed price-point list; auto-equalization from USD can land higher than the local market. Set the PHP price yourself.
- USD 9.99 at roughly 56-59 PHP/USD is about PHP 560-590 before Apple's rounding. Expect a nearby point such as PHP 599 (UNVERIFIED: read the actual PHP list in App Store Connect).
- Whether prices are tax-inclusive differs by storefront; check the "Pricing and Availability" preview per country (UNVERIFIED for PH VAT).
- Reference points (`.planning/research-v2/04-monetization-appstore.md`): NoWaste lifetime about USD 30, Paprika about USD 5; USD 9.99 sits between. Enroll in the Small Business Program for the 15 percent commission (https://developer.apple.com/app-store/small-business-program/).

## What shipped

| Piece | Where | Behavior |
|-------|-------|----------|
| Purchase client | `mobile/plugins/kumaun-store` (custom StoreKit 2 Capacitor 8 SPM plugin) | Returns Apple-signed transaction JWS to JS. No third-party account or keys. `@capgo/native-purchases` is the documented fallback behind the same TS interface. RevenueCat is NOT used. |
| Test config | `mobile/storekit/Kumaun.storekit` | Product `app.kitcha.mobile.full`, for Xcode runs. |
| Frontend | `frontend/lib/native/store`, `frontend/lib/entitlements`, Settings "Kumaun Full" card, upgrade sheet, pantry/finish/pending handling | Price comes from StoreKit `localizedPrice`, never hardcoded. Native only; web shows a link-free note. Restore Purchases is always reachable (Settings and the sheet). |
| Verify | `POST /api/v1/entitlements/verify` | Idempotency-Key required. Backend re-verifies the JWS (x5c chain pinned to Apple Root CA G3, bundleId, productId, environment) and claims it for exactly one account. Restore = verify again with the device's current entitlement JWS. |
| Status | `GET /api/v1/entitlements/me` | Entitlement status plus effective limits. The client treats it as the truth; local cache is display-only. |
| Webhook | `POST /api/v1/webhooks/app-store` (public, authenticated only by Apple's JWS chain) | App Store Server Notifications V2. Handles `REFUND`, `REVOKE` (revoke) and `REFUND_REVERSED` (restore). Deduped by notificationUUID, ordered by signedDate. |
| Env keys | `backend/.env.example` | `APPLE_BUNDLE_ID`, `APPLE_APP_APPLE_ID`, `IAP_PRODUCT_ID`, `IAP_ONLINE_CHECKS`, `IAP_ALLOW_XCODE_ENV`, `FREE_PANTRY_LIMIT`, `AI_PAID_USER_DAILY_LIMIT`, `AI_FREE_MONTHLY_LIMIT`, `AI_PAID_MONTHLY_LIMIT`. |

Error and status codes: verify returns 400 `INVALID_TRANSACTION` (bad JWS, wrong bundle/product), 409 `ENTITLEMENT_ALREADY_CLAIMED` (the purchase belongs to another Kumaun account), 503 `IAP_NOT_CONFIGURED` / `VERIFICATION_UNAVAILABLE` (Apple verification unavailable; client retries later), 429 `ENTITLEMENT_RATE_LIMITED` (after 30 verify requests). Webhook limiter code is `WEBHOOK_RATE_LIMITED`; an unconfigured verifier maps to 400 on the webhook. Pantry limit: 403 `UPGRADE_REQUIRED` with the limit in details.

Rules the server enforces (the client is only a hint):
- Database uniqueness on (environment, originalTransactionId) globally, and (userId, productId): one purchase cannot unlock many accounts. A different purchase never replaces an existing ACTIVE entitlement of the same user (prevents a Sandbox JWS from displacing a Production unlock).
- Refund/revoke state is stored per purchase in `app_store_revocations` even when no account has claimed it yet (and it survives account deletion). A later verify of an older JWS for that purchase is applied as revoked; a newer `REFUND_REVERSED` clears it. Ordering is by notification `signedDate`. Residual gap: if Apple's webhook retries are exhausted (endpoint down for days), a refund is never recorded. After any long outage, check App Store Connect refunds by hand or call the App Store Server API `GET /inApps/v1/transactions/{transactionId}` for recent claims.
- Sandbox transactions are accepted in production, because App Review purchases in Sandbox. Xcode/LocalTesting JWS are not Apple-signed and are accepted only when `IAP_ALLOW_XCODE_ENV=true`, which config validation rejects in production.
- `IAP_ONLINE_CHECKS` defaults to true in production, false otherwise. Leave it at the default.
- Free: 25 active pantry items (`FREE_PANTRY_LIMIT`); existing items are never deleted, only creating is blocked. Paid: unlimited.
- Gated create paths: `POST /pantry` and shopping trip finish. A finish that would create pantry rows past 25 returns 403 `UPGRADE_REQUIRED` and the whole finish is rolled back (the list stays active, nothing half-written). Finishes that only update existing pantry rows, or that do not add to the pantry, still work for free users. The per-user advisory lock makes concurrent creates safe.
- Offline queued creates that hit the limit on replay park in Pending changes as a "Needs upgrade" conflict with an "Unlock Kumaun Full" action; nothing is auto-discarded.
- AI (server): free 20 per day (`AI_USER_DAILY_LIMIT`), no monthly cap (`AI_FREE_MONTHLY_LIMIT=0` disables it); paid 40 per day (`AI_PAID_USER_DAILY_LIMIT`) plus 600 per UTC month (`AI_PAID_MONTHLY_LIMIT`). The global daily cap and provider are unchanged.
- Account deletion removes the user's entitlement rows and monthly AI counters. It does NOT cancel the Apple purchase (the delete-account sheet says so).
- The restore button is mandatory (Guideline 3.1.1): visible on the upgrade sheet and in Settings, works on a fresh install, and a second device unlocks through `GET /me` because entitlement is keyed to the Kumaun account.

Product ID, plugin boundary and the verification design come from 12-CONTEXT.md; per-plan details are in the 12-0x summaries.

## Testing guide

### 1. Automated (agents ran these)
- Backend Jest (`cd backend && npx jest <file>`): `entitlement-status`, `apple-verifier`, `apple-root-cert`, `entitlements-claim`, `entitlements-verify`, `pantry-limit`, `shopping-finish-limit`, `ai-limits`, `ai-quota`, `app-store-webhook`, `account-deletion`, `env.schema`. They use an offline test PKI and signer (`backend/tests/helpers/apple-test-signer.ts`), so no Apple account is needed.
- Frontend vitest (`cd frontend && npx vitest run lib/entitlements lib/native/store lib/api/entitlements.test.ts lib/offline`): purchase/restore service, view models, pantry gate, UPGRADE_REQUIRED classification.
- Mock store: in an E2E build (`mobile/scripts/build-ios.sh --e2e`) the route `/e2e/upgrade/?mock=1` swaps in an in-memory store so purchase and restore UI flows can be scripted. The route and mock are excluded from release builds (`verify-bundle.sh` checks).
- NOT automated: React component behavior (vitest is Node-only for `lib/**`), real StoreKit purchases, and the webhook against Apple.

### 2. Simulator with Xcode (StoreKit configuration)
1. Open `mobile/ios/App` in Xcode. Scheme App > Edit Scheme > Run > Options > StoreKit Configuration = `Kumaun.storekit` (wired in the shared scheme `App.xcscheme` by plan 12-15; confirm Xcode shows it, otherwise pick `mobile/storekit/Kumaun.storekit` by hand).
2. Run a local backend with `IAP_ALLOW_XCODE_ENV=true` in `backend/.env` (never in production; the server refuses to boot with it in production). Xcode-environment JWS are not Apple-signed, so without this flag verify returns `INVALID_TRANSACTION`.
3. Cmd+R, sign in, add items to the 26th, buy from the sheet, then Settings > Kumaun Full > Restore Purchases. Refund: Xcode Debug > StoreKit > Manage Transactions > refund or revoke, then relaunch; the app rechecks on launch and resume.
4. 12-03 CLI probe result: SKIPPED. `SKTestSession(contentsOf: Kumaun.storekit)` loaded, but `Product.products(for:)` threw `URLError -1008` (it went to the real App Store instead of the local config on the iOS 26.5 simulator runtime, consistent with forum thread 826971). `xcodebuild test` therefore cannot prove a purchase; the mapping unit test passes. Real StoreKit checks are human_needed.

### 3. Sandbox on a real iPhone via TestFlight
Source: https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account
1. App Store Connect > Users and Access > Sandbox > +. Use a NEW email never used for an Apple Account (plus-addressing works), country Philippines. Name, email and password cannot be edited later.
2. On the iPhone enable Developer Mode, install the TestFlight build, and sign in under Settings > Developer > Sandbox Apple Account (location varies by iOS version, UNVERIFIED), not the main Apple Account. TestFlight purchases use Sandbox automatically; nothing is charged.
3. Buy Kumaun Full. Confirm Settings shows unlocked and the 26th item can be added. Metadata changes can take up to an hour to reach Sandbox.
4. Delete the app, reinstall, sign in, tap Restore Purchases, confirm it unlocks. Sign in on a second device (or after clearing the app) and confirm `GET /api/v1/entitlements/me` unlocks without buying again.
5. Claim check: sign in with a different Kumaun account on the same Apple account and restore; expect the "already used by another account" message (409 `ENTITLEMENT_ALREADY_CLAIMED`).

### 4. Refund and revoke checks
- Agent-verified: webhook fixtures cover REFUND, REVOKE, REFUND_REVERSED, duplicates and out-of-order delivery (`app-store-webhook` tests).
- Human, after the Railway deploy and ASSN registration: App Store Connect > App Information > Request a Test Notification (confirms the URL and JWS chain; a TEST notification is acknowledged without changing an entitlement). Then request a sandbox refund or use Xcode's refund for a purchase made against the deployed backend and confirm the entitlement becomes revoked (pantry gate returns, AI limits drop) and returns on REFUND_REVERSED.

## Owner steps (only you can do these, in order)

1. Set the Railway variable `APPLE_APP_APPLE_ID` (App Store Connect > the app > App Information > Apple ID, a number). Confirm the defaults `APPLE_BUNDLE_ID=app.kitcha.mobile` and `IAP_PRODUCT_ID=app.kitcha.mobile.full`, and leave `IAP_ONLINE_CHECKS` unset (default true in production). Never set `IAP_ALLOW_XCODE_ENV` on Railway.
2. After the Railway deploy (nothing is deployed yet), register the webhook URL `https://<api-host>/api/v1/webhooks/app-store` as both the Production and the Sandbox Server URL, Version 2, in App Store Connect > App Information > App Store Server Notifications. Then press "Request a Test Notification" and check the Railway logs for a 200.
3. Create a sandbox tester (section 3 above).
4. In Xcode > App target > Signing & Capabilities confirm the In-App Purchase capability is present (plan 12-15 does not edit project.pbxproj, so add it by hand if missing; StoreKit 2 needs no entitlements file or Info.plist key).
5. Run the TestFlight sandbox purchase, delete-and-restore, second-device and refund checks (sections 3 and 4). Record results in the submission checklist.
6. Capture and upload the review screenshot (next section) to the IAP in App Store Connect.
7. Attach the IAP to the 1.0 version (version page > In-App Purchases and Subscriptions) so it is reviewed with the build. The product must be Ready to Submit first.
8. Consider enrolling in the Small Business Program before the first sale.

## Review screenshot

Required for the IAP, shows only to App Review, can be replaced but not removed once uploaded. Apple's page gives no pixel sizes, so use a size the app supports.

1. Build the E2E native app with `mobile/scripts/build-ios.sh --e2e` (needs `E2E_EMAIL` and `E2E_PASSWORD`), run it from Xcode with the Kumaun.storekit scheme option so StoreKit returns a real localized price, and open `/e2e/upgrade/` WITHOUT `?mock=1`. (Alternative: a normal build, sign in with the demo account and add a 26th pantry item to open the sheet.)
2. Capture portrait at 1290x2796 or 1320x2868 using `scripts/store/capture-screenshots.sh <built .app> 6.9` (set `KITCHA_ASSUME_YES=1` to capture whatever is on screen, otherwise it pauses so you can navigate first).
3. The frame must show: "Kumaun Full", the price from StoreKit, the "Unlock for $..." button and "Restore Purchases". It must not show status-bar clutter (clock, battery are fine, notifications and debug overlays are not), offline or pending banners, or any error.
4. Upload it in App Store Connect > the IAP > Review Information > Screenshot.

## Review notes and restore (Guideline 3.1.1)

"You should make sure you have a restore mechanism for any restorable in-app purchases" (https://developer.apple.com/app-store/review/guidelines/ , fetched 2026-10-11). No external payment links or license keys anywhere in the app. The free-tier limit prompt is dismissible and never blocks scanning, expiry alerts, recipes, plans or shopping.

## Paid Apps Agreement, tax and banking checklist (Philippines individual)

All human-only (Account Holder). Per the owner, the agreement, bank and tax are ACTIVE (CONTEXT, 2026-10-11); the list is kept for reference. Source: https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements

- [x] Apple Developer Program enrolled (Individual, 99 USD/yr).
- [x] Paid Apps Agreement accepted; banking and tax forms (W-8BEN style) submitted. Exact forms UNVERIFIED.
- [ ] Philippines taxes: Apple's PH VAT handling and your BIR obligations on payouts are NOT verified. Ask a BIR-registered accountant before the first sale.
- [ ] Small Business Program enrollment BEFORE the first sale (15 percent commission; effective after the next fiscal month end per Apple).
- [ ] Product metadata: price (USD 9.99, PHP manual), localization, review screenshot (this file).
- [ ] App Store Server Notifications V2 URLs (owner step 2).
