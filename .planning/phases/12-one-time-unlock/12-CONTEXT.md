# Phase 12: One-Time Unlock - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning
**Mode:** Autonomous (owner: one-time $9.99, keep what we have, rest at my discretion; App Store Connect product exists)

<domain>
## Phase Boundary
SUB-01..03 for Kumaun app 1.0. Non-consumable IAP "Kumaun Full" (product id `app.kitcha.mobile.full`, $9.99, already created in App Store Connect, state MISSING_METADATA until a review screenshot exists). Paid Apps Agreement, bank and tax are ACTIVE, so sandbox purchasing is possible. Free tier: up to 25 pantry items + scanning + expiry alerts + recipes/plans/shopping; paid: unlimited pantry, offline/other as built, plus server AI allowance policy (see below). No recurring charges. App is iPhone+iPad; web app stays free of purchase UI (web users: show nothing or a 'unlock in the iOS app' note, decide).
</domain>

<decisions>
## Implementation Decisions
- Purchase client: StoreKit 2 through the best maintained Capacitor 8 / SPM-compatible plugin (verify maintenance; candidates: @capgo/native-purchases, RevenueCat's purchases-capacitor, a thin custom Swift plugin over StoreKit 2). PREFER NO third-party account/keys (owner has no RevenueCat account): a custom thin StoreKit 2 plugin or an account-free plugin that returns the signed JWS transaction. If RevenueCat is clearly far less work and risk, justify and list the owner steps.
- Server verification (source of truth): backend verifies the signed transaction JWS (x5c chain to Apple Root CA G3, bundleId, productId, environment Sandbox/Production, not revoked) and stores an `Entitlement` row (userId, productId, originalTransactionId, environment, status, purchasedAt, revokedAt) via additive migration; originalTransactionId unique per user to prevent sharing one purchase across accounts; `POST /entitlements/verify` (idempotent, uses Phase 8 Idempotency-Key), `GET /entitlements/me`. Handle refunds/revocation via App Store Server Notifications V2 endpoint (public, verified JWS) if feasible; otherwise document and re-check on app launch. Restore Purchases = re-verify current entitlements.
- Gating server-side: pantry create beyond 25 active items returns 403 `UPGRADE_REQUIRED` for free users (existing items never deleted, limits apply to creating); entitlement lifts it. Offline queued creates that hit the limit on replay must surface a clear conflict message in the Phase 11 Pending changes sheet (use its error classification). Server AI: keep current per-user quotas for free; paid users get a higher monthly allowance - define numbers in config with env overrides, no new provider changes.
- UI (iOS native only): Settings > 'Kumaun Full' card (status, price from StoreKit localizedPrice, Buy, Restore Purchases), upgrade sheet shown only when a limit is hit (25th+ pantry add) and dismissible, never blocking scanning/expiry alerts. Must show the product price from StoreKit, not hardcoded. Review-screenshot-ready (Apple requires a screenshot of the paywall for the IAP).
- Testing: Xcode StoreKit configuration file (Kumaun.storekit) with the product for Simulator tests + backend unit/integration tests with a test JWS signer; Sandbox purchase on a real device via TestFlight is human_needed. E2E Simulator: purchase flow with the .storekit config.
- Compliance: restore button present (Guideline 3.1.1), no external payment links, purchase history entry to add to the privacy manifest (docs/store/PrivacyInfo.proposed.xcprivacy) and PRIVACY-LABELS.md Purchase History already marked yes for 1.0.
- Account deletion must remove Entitlement rows (add to the all-models test).

### Claude's Discretion
Plugin vs custom plugin, schema details, copy, numbers for paid AI allowance, file layout. Rules: small files, immutability, zod at boundaries, tests 80%+, additive migrations only. Do NOT deploy backend or push iOS builds; you may push to origin main if everything is green and web unaffected.
</decisions>

<code_context>
Existing: Phase 8 idempotency middleware, refresh tokens, /sync/bootstrap; Phase 11 offline outbox (frontend/lib/offline) and Pending changes UI; Phase 7 account deletion and AI consent; mobile/ Capacitor 8 project, plugins wrappers under frontend/lib/native; docs/store/IAP.md has the product spec. Another agent is concurrently producing the first TestFlight build and touches mobile/ios project signing/icons/scripts: do not edit mobile/ios/App/App.xcodeproj/project.pbxproj or Info.plist until `git log` shows its commit mentioning testflight/archive; do backend + frontend + plugin source first and add the Xcode wiring (capability, storekit config, plugin registration) last.
</code_context>

<specifics>
Product id must stay app.kitcha.mobile.full. Review screenshot capture is a follow-up after the UI exists.
</specifics>

<deferred>
- On-device AI (1.1), subscriptions, family sharing, web purchase, promo codes/offer codes.
</deferred>
