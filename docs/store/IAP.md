# In-App Purchase setup: Kitcha Full (non-consumable)

Status: PLANNED (ROADMAP Phase 12). Nothing here exists in App Store Connect or code yet. Field limits verified 2026-10-11 at https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information ; creation steps at https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases .

## Product definition

| Field | Value | Limit / note |
|-------|-------|--------------|
| Type | Non-Consumable | One-time, restorable. No subscription (3.1.2 rules do not apply). |
| Reference name | `Kitcha Full (one-time unlock)` | max 64 chars, internal only |
| Product ID | `app.kitcha.mobile.full` | max 100 chars, letters/digits/hyphen/period/underscore. Cannot be edited or reused after saving, so decide the bundle id first. The Xcode bundle id today is `app.kitcha.mobile` (verified in project.pbxproj and capacitor.config.ts); changing the name does not require changing it. |
| Display name (en-US) | `Kitcha Full` | 2-30 chars |
| Description (en-US) | `Unlimited pantry and more AI ideas.` (35 chars) | max 45 chars. Must be true of what Phase 12 ships. |
| Price | USD 9.99 base | Pick the USD price point in "Price Schedule", then review each storefront. |
| Philippines | Open the price list and set PHP manually (see notes) | |
| Family Sharing | Off (recommended for v1) | Off by default; cannot be turned off once on, per Apple. Verify at https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases (not fetched). |
| Availability | Same countries as the app | |
| Review notes | See below | max 4000 chars |
| Tax category | Default (apps/IAP) | |

Review notes text:

```
Kitcha Full is a one-time non-consumable unlock (no subscription). Free tier: up to 25 pantry items. To test: sign in with the demo account (see App Review Information), add pantry items until the 26th, tap Unlock Kitcha Full, then Restore Purchases under Settings > Kitcha Full. Free users keep barcode scanning, expiry reminders, recipes, meal plans and shopping lists.
```

### Philippines pricing notes
- Apple stores one price per storefront chosen from its fixed price-point list; auto-equalization from USD can land higher than the local market. Set the PHP price yourself.
- USD 9.99 at a rough 56-59 PHP/USD is about PHP 560-590 before Apple's rounding. Expect a nearby point such as PHP 599 (UNVERIFIED: read the actual PHP list in App Store Connect; I could not fetch it).
- Prices shown to users are tax-inclusive or exclusive depending on the storefront; check the "Pricing and Availability" preview per country (UNVERIFIED for PH VAT handling, see checklist).
- Competitor reference points from `.planning/research-v2/04-monetization-appstore.md`: pantry apps sell lifetime unlocks at about USD 30 (NoWaste) and Paprika about USD 5 (iOS); USD 9.99 sits in between. 15 percent commission applies after enrolling in the Small Business Program (https://developer.apple.com/app-store/small-business-program/).

## Review screenshot requirement

- Required for every IAP; shows the item being offered; it is for App Review only, not shown on the store. Once uploaded it can be replaced but not removed.
- Must meet one of the screenshot specs the app supports (Apple page above does not give pixels). Use the 1290 x 2796 or 1320 x 2868 portrait capture of the paywall/upgrade sheet that shows the name `Kitcha Full`, the price and the Restore button. Take it with `scripts/store/capture-screenshots.sh` once Phase 12 UI exists.
- The IAP must also be attached to the app version when submitting the first time (App Store Connect > version page > In-App Purchases and Subscriptions) and in "Ready to Submit" state, otherwise it is not reviewed with the build.

## Restore purchases (mandatory)

- Guideline 3.1.1: "you should make sure you have a restore mechanism for any restorable in-app purchases" (https://developer.apple.com/app-store/review/guidelines/ , fetched 2026-10-11).
- Implement a visible "Restore Purchases" button on the upgrade sheet and in Settings. It must work on a fresh install and after account switch; a user who signs in on another device should also get the entitlement from the server (entitlement is keyed to the Kitcha account).
- Free-tier limit prompt may be dismissed (ROADMAP success criterion 3); Restore must be reachable without hitting the limit.
- The purchase does not cancel on account deletion: Apple purchases belong to the Apple Account. Say so in the delete-account screen, and keep the server entitlement row deletable with the account (Cascade).

## Sandbox tester steps

Source: https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account

1. Human: App Store Connect > Users and Access > Sandbox > + (Account Holder/Admin/App Manager/Developer role). Name, a NEW email never used for an Apple Account (plus-addressing works, e.g. `you+kitchasbx1@gmail.com`), strong password, country Philippines. Name/email/password cannot be edited afterwards; the country can.
2. Create the IAP in App Store Connect (Missing Metadata is fine for sandbox, but it must have a localization, price and review screenshot to reach "Ready to Submit"). Metadata changes can take up to 1 hour to reach sandbox.
3. Real iPhone: enable Developer Mode, install a development-signed or TestFlight build. Sign in with the sandbox account under Settings > Developer > Sandbox Apple Account (location of the toggle varies by iOS version, UNVERIFIED), not the main Apple Account. You do not need to sign out of your own account.
4. Buy Kitcha Full; confirm the server entitlement flips (webhook or verification call logged). Delete the app, reinstall, tap Restore Purchases, confirm entitlement returns.
5. Refund test: Sandbox cannot easily simulate a user-requested refund from device; use the App Store Server API test notification and your webhook with a mocked REFUND payload (agent-doable with fixtures).
6. Simulator: StoreKit Configuration file testing in Xcode works without a tester account but cannot exercise the server path (UNVERIFIED for Capacitor plugin compatibility).
7. TestFlight purchases use the sandbox environment automatically; no real charge.

## Paid Apps Agreement, tax and banking checklist (Philippines individual)

All human-only (Account Holder). Sources: https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements (Account Holder only; agreement must be active to submit or update paid apps and IAP; tax and banking must be kept current).

- [ ] Apple Developer Program enrolled as Individual (legal name appears as seller; 99 USD/yr). Wait for approval.
- [ ] App Store Connect > Business > Agreements: accept **Paid Apps Agreement** (Account Holder, 2FA, irreversible). The IAP cannot be created or submitted before it is active (Apple: you cannot create a new app or IAP while a new agreement version is unaccepted).
- [ ] Contacts: set legal/financial contact details (Apple prompts; exact fields UNVERIFIED).
- [ ] Banking: add a bank account that can receive USD wire payouts (PH bank; confirm with the bank that it accepts incoming USD from Apple and the fees). Payout minimum threshold applies (UNVERIFIED value).
- [ ] Tax forms: complete the US tax forms in App Store Connect. A non-US individual typically files **W-8BEN** (treaty claim; the US-Philippines treaty exists but confirm rate and your TIN with an accountant). UNVERIFIED which forms App Store Connect asks for in your case.
- [ ] Philippines taxes: whether Apple collects/remits PH VAT on digital sales, and your own BIR registration/income-tax obligations on payouts, are NOT verified (research note 04 section 1). Ask a BIR-registered accountant before first sale.
- [ ] Enroll in the **Small Business Program** after the Paid Apps agreement is active and BEFORE the first sale (15 percent commission; takes effect after the next fiscal month end per Apple's page).
- [ ] Create the IAP, set price (USD 9.99, PHP manual), localization, review screenshot.
- [ ] Optional: App Store Server Notifications V2 URLs (production and sandbox) for the Express route, if verifying directly.

## Entitlement verification with the Express API

Options:

A. **RevenueCat**: Capacitor plugin `@revenuecat/purchases-capacitor` handles StoreKit, restore and receipt validation; RevenueCat calls our webhook. Free under USD 2,500 monthly tracked revenue then 1 percent (from research note 04, https://www.revenuecat.com/pricing/; the 1 percent basis is ambiguous in sources, so confirm). Set `app_user_id` to the Kitcha user UUID (never the email) after login.

B. **Direct StoreKit 2 + `@apple/app-store-server-library` (Node)**: client buys via a Capacitor StoreKit 2 plugin (the weakest link; community plugins are less mature, not evaluated here), sends the signed transaction JWS to `POST /billing/verify`; server verifies the x5c chain to Apple Root CA G3, checks `bundleId` (`app.kitcha.mobile`), `productId`, `environment`, then upserts the entitlement. Refunds/revocation arrive through App Store Server Notifications V2 (`REFUND`, `REVOKE`; dedupe by `notificationUUID`). No fee but about 3-5 days of work and more edge cases.

### Recommendation

Use RevenueCat as the purchase and restore client (RevenueCat is already optional in ROADMAP Phase 12), but keep the **server database as the source of truth**:
- `Entitlement` table (userId unique with onDelete Cascade, `plan='full'`, `status`, `originalTransactionId`, `purchasedAt`, `revokedAt`, `source`), plus an idempotent `PurchaseEvent` table keyed by event id.
- `POST /api/v1/billing/revenuecat-webhook` guarded by a shared secret in the Authorization header (Railway variable, not committed); on events granting the product set active, on refund/revocation set revoked. On any webhook, optionally re-fetch the subscriber from RevenueCat's REST API instead of trusting the payload (defense in depth).
- `GET /api/v1/billing/me` returns entitlement; the client treats "isFull" as a UI hint only. Pantry-item cap (25) and AI allowance are enforced in the backend (existing `ai-quota.repository.ts` and the pantry create path), so refund, tamper or jailbreak cannot unlock paid limits.
- Reason for recommending over B: non-consumable restore and cross-device behavior are handled by a maintained SDK, and for one-time purchases the vendor fee is likely zero at this scale. Risk: vendor dependency; the entitlement table makes switching to B later a webhook swap.
- Event names and webhook shape are from memory (UNVERIFIED); read RevenueCat's webhook docs when building Phase 12.
- Agents can build the backend, tables, webhook and mocked tests now; the products, sandbox tester and live keys are human gates.
