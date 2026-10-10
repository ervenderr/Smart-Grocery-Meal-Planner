# Kitcha: Monetization + App Store Publishing Research (2026-10-10)

Confidence tags: [H] verified on an Apple/first-party page fetched today, [M] third-party or partly verified, [L] estimate or from memory. No repo files were modified.

## 0. Blocking findings (read first)

1. **Name collision [M-H].** An iOS app named "Kitcha: Save, Plan, Cook" (Kamp Inc, kitcha.io, Food & Drink, free, released 2026-03-04, App Store ID 6758049420, Android package io.kitcha.app) already exists and does the same job (recipe saver, meal planner, shared grocery list, premium tier). Source: https://apppricinglab.com/app/apple/6758049420 and https://apkcombo.com/kitcha-save-plan-cook/io.kitcha.app/. App Store names must be unique, and an identical name in the same category invites a trademark/IP complaint (Guideline 5.2). Verify on the App Store and USPTO/IPOPHL (Philippines) before investing in branding. Plan a fallback name and consider a distinct subtitle.
2. **Account deletion is broken against 5.1.1(v) [H, from code].** `DELETE /api/v1/users/account` (backend/src/modules/users/users.routes.ts:171) calls `deactivateAccount`, a soft delete. The hard-delete `deleteAccount()` exists in users.service.ts:328 but no route calls it. `deactivateAccountValidation` requires `body.password`, and the frontend (frontend/components/settings/data-settings.tsx:137) sends `apiClient.delete(...)` with no body, so it most likely returns 400 today, while the toast claims "Account deleted successfully". Apple requires in-app account deletion for any app with account creation.
3. **Project docs conflict [H].** CLAUDE.md says Gemini is the primary LLM; code defaults are the OpenAI-compatible Dahl provider with `MiniMaxAI/MiniMax-M2.7` (backend/src/config/env.schema.ts:90-95; .planning/PROJECT.md:53). Unit economics below show both. Also PROJECT.md lists "Native app (Expo)" as out of scope, so an iPhone binary needs a deliberate scope change (Capacitor wrapper recommended, section 2.5).
4. **Free-tier AI cannot be the production path [H].** Gemini pricing page: free-tier content "is used to improve Google's products," paid is not (https://ai.google.dev/gemini-api/docs/pricing). Guideline 5.1.2(i) now requires you to disclose sharing personal data with third-party AI and get explicit permission. Use a paid tier, send no PII (already planned in CLAUDE.md), and add a consent screen.

## 1. Apple Developer Program

| Item | Finding | Conf. |
|---|---|---|
| Fee | USD 99 per membership year, or local-currency equivalent where available (https://developer.apple.com/programs/whats-included/ , https://developer.apple.com/programs/enroll/). Lapse removes the app from sale. | H |
| Individual | Needs Apple Account with 2FA, age of majority, legal name (shown as seller name), verified phone and address (no P.O. box). No D-U-N-S, no legal entity. Fastest path for a solo dev. | H |
| Organization | Needs a legal entity (no DBAs/trade names), D-U-N-S number (free from Dun & Bradstreet, can take days to weeks), a public website on the org domain, a work email on that domain, legal binding authority. Seller name = company name. | H |
| Philippines | Apple's pages do not list country specifics; enrollment is available in 220+ countries. Philippines VAT on digital services (RA 12023, 12%) exists; whether Apple collects and remits it on App Store sales is NOT confirmed by anything I could fetch. Check App Store Connect > Business > Tax Forms/Agreements, and ask a BIR-registered accountant. Expect to file US W-8BEN in App Store Connect (treaty claim); income tax on proceeds is your own PH obligation. Payout needs a bank account that can receive USD wires (minimum payout thresholds apply). | M-L |
| 5.1.1(ix) | Regulated fields (healthcare etc.) should be submitted by a legal entity. A pantry/meal planner is not regulated, but avoid medical framing so individual enrollment stays fine. | H |
| Small Business Program | 15% commission (instead of 30%) on paid apps and IAP if proceeds were <= USD 1M in the prior calendar year and stay under in the current year; new developers qualify. Subscriptions are 15% regardless of year. Proceeds are net of commission/taxes. Enroll as Account Holder after accepting the Paid Apps agreement; takes effect ~15 days after the end of the fiscal month of approval, so enroll BEFORE first sale. (https://developer.apple.com/app-store/small-business-program/) | H |
| Bonus | Enrolled developers with < 2M first-time downloads can use Apple Foundation Models on Private Cloud Compute with no cloud API cost (requires an entitlement; it is a native Swift API, so not usable from a pure web/Capacitor layer without a native plugin). Worth a later spike for offline/zero-cost AI. | H (page) / L (feasibility) |
| TestFlight | Included with membership; internal testers (team members) need no Beta App Review, external testers need a first-build beta review. Up to 10,000 external testers and 90-day builds are my recollection, not re-verified. | M-L |
| Individual vs org recommendation | Start as Individual (zero extra cost/time). You can convert or transfer to an organization later with a D-U-N-S and documents (transfer rules apply and proceeds attribute to both accounts for the Small Business test). Downside: your legal name is public as seller. | M |

## 2. Monetization

### 2.1 Competitor pricing (verify on each App Store listing; trackers conflict)

| App | Model | Price observed | Conf. |
|---|---|---|---|
| Mealime Pro | Freemium subscription | $2.99-$5.99/mo conflicting; ~$50/yr in one source | L |
| Paprika 3 | One-time per platform | ~$4.99 iOS (March 2026 tracker) | M |
| Samsung Food+ | Subscription | ~$6.99/mo | M |
| Yummly Pro | Subscription | $4.99/mo or $29.99/yr (2026 roundup) | M |
| NoWaste | Freemium (free caps 6 lists / 500 items) | Pro $6.99/yr or $29.99 lifetime (App Store listing, https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004) | M-H |
| KitchenPal | Freemium | $2.99/mo, $5.99/3mo, $11.99/yr, $29.99 lifetime; family members upgraded free | M |
| Pantry Check | Item-count tiers | Free 200 items; paid tiers around $11.99 and $29.99 | L |
| Cooklist | Subscription, 7-day trial | ~$5.99-$7.99/mo, ~$47.99-$59.99/yr | M |
| "Kitcha: Save, Plan, Cook" (Kamp) | Free + premium (nutrition, auto meal plans, unlimited imports) | price not captured | L |

Read of the market: pantry trackers price low ($7-12/yr, or ~$30 lifetime); meal-planner/recipe apps sit at $30-60/yr. Pantry/inventory is a price-sensitive niche, so a $20+/yr ask must be justified by AI planning and household sharing.

### 2.2 Benchmarks (RevenueCat State of Subscription Apps 2026, https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) [H for these numbers; category-specific data not found]
- Day-35 trial-to-paid median: hard paywall 10.7%, freemium 2.1%. Day-60 revenue per install: $3.09 hard vs $0.38 freemium.
- Trials of 17-32 days convert at a 42.5% median vs 25.5% for under 4 days.
- ~72% of annual subscribers cancelled in year 1 (2026), up from ~56%; 27-28% year-one retention for both models. AI apps earn ~41% more LTV in year 1 but monthly plans retain worse.
- For planning, assume freemium download-to-paid of 1-3% [L, industry rule of thumb] and, because a hard paywall hurts a utility app that needs a habit (pantry data entry), choose freemium with a metered paywall.

### 2.3 What to paywall (cost-driven)
Free (acquisition and habit): pantry (cap, e.g. 40 items... see below), manual recipes, shopping list, expiry alerts, basic budget, barcode scans (Open Food Facts calls are free and cached), 3 AI generations per week.
Plus (paywall): AI meal plan and recipe generation beyond the free quota, unlimited pantry items and recipes, household sharing (needs new backend work, not in schema today: no household/sharing model exists), nutrition (USDA) per meal, budget analytics/export, price-tracking features.
Avoid paywalling: expiry reminders and core scanning (retention drivers); account deletion/export (compliance).
Do NOT meter by barcode scans (cost is ~zero, Open Food Facts allows 15 req/min per IP per CLAUDE.md research; paywalling a free-data feature feels arbitrary).
Existing hooks to reuse: `AiUsage` per-user daily counter and `AI_USER_DAILY_LIMIT` (default 20), `AI_GLOBAL_DAILY_LIMIT` (default 100), `AiCache`. Add `entitlement` lookup so free = 3/week, Plus = 20/day.

### 2.4 Unit economics (AI) [L: token counts are my estimates; check real usage in logs]
Assumptions per call: meal plan ~2k in / ~4k out; recipe suggestions ~1.5k in / ~2.5k out; substitution ~0.5k/0.4k. Prices from https://ai.google.dev/gemini-api/docs/pricing (per 1M tokens):
- Gemini 3.5 Flash-Lite ($0.30 in / $2.50 out): meal plan ~$0.0106, recipes ~$0.0067, substitution ~$0.0012.
- Gemini 2.5 Flash-Lite ($0.10 / $0.40): meal plan ~$0.0018, recipes ~$0.0010.
- Gemini 3.8 Flash ($0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50): meal plan ~$0.0165 now, ~$0.033 from 2027.
- Dahl/MiniMax: price not verified; assume similar to Flash-Lite class.
Typical Plus user: ~15 calls/mo, cache hits ~30% -> ~$0.05-0.10/mo on 3.5 Flash-Lite. Abuser at the 20/day cap: 600 calls x $0.0106 = ~$6.4/mo, which exceeds the net price of a monthly sub. So keep the per-user cap but lower Plus to ~10/day, and add a monthly soft cap.
Revenue side at $19.99/yr: Apple takes 15% -> $17.00 net, minus RevenueCat (free under $2,500 MTR; then 1% of tracked revenue, gross) ~ $17 net before AI. At 15 calls/mo AI is ~$1/yr per paying user, i.e. ~6% of net. Healthy.
Fixed costs: Apple $99/yr + Railway Hobby est. $7-15/mo (CLAUDE.md, LOW-MEDIUM) = ~$185-280/yr. Break-even ~11-17 annual subscribers. Free users: AI quota 3/week x ~$0.01 x 52 = ~$1.5/yr worst case if they use it fully; limit the free tier globally with `AI_GLOBAL_DAILY_LIMIT` (cost ceiling = limit x $0.0106 x 30 = ~$32/mo at 100/day; set a lower number until revenue exists).
Free-tier Gemini is acceptable for dev only (content used to improve products; Terms in EEA/UK/CH apply paid terms).

### 2.5 Getting an iPhone app from a Next.js PWA
- Options: (a) Capacitor wrapper around the existing Next.js frontend (bundled static export or hosted URL) plus native plugins; (b) Expo/React Native rewrite (violates "no rewrite" constraint); (c) SwiftUI native (rewrite). Recommend (a).
- Guideline 4.2: "should include features, content, and UI that elevate it beyond a repackaged website" [H]. A bare webview of the site is the classic rejection. Mitigate with native-only features: camera barcode scanning via native plugin (not the browser BarcodeDetector polyfill), local push notifications for expiry (UNUserNotificationCenter), haptics, share sheet, native IAP, offline shell, Home Screen widget optional. Bundle the web assets in the app (don't load a remote URL as the whole app) where feasible. Evidence from submissions: Capacitor apps with real native features pass routinely [L, from experience, no source fetched].
- The existing Serwist PWA plan in CLAUDE.md is for Android/web; service workers are not used inside WKWebView the same way, so verify offline behavior in the Capacitor build.

### 2.6 StoreKit 2 vs RevenueCat
- Guideline 3.1.1 [H]: unlocking features/subscriptions/premium content must use in-app purchase; no license keys, QR codes, crypto, etc. 3.1.2(a): subscriptions must offer ongoing value, last >= 7 days, and be available on all the user's devices (so entitlement must live on the server and work in the web app too).
- US storefront only: 3.1.1(a) says apps may include buttons/links to external purchase in US storefront apps without an entitlement [H]. Not useful for a PH audience but note it for later (web checkout with Stripe).
- RevenueCat: free to USD 2,500 monthly tracked revenue (MTR), then 1% of tracked revenue; MTR is before Apple's cut (https://www.revenuecat.com/pricing/) [H; whether 1% is on all or the excess is ambiguous in sources]. Gives Capacitor plugin (`@revenuecat/purchases-capacitor`), webhook, receipt validation, entitlements, experiments, paywalls (Growth Tools priced by conversion). Best fit for a solo dev. Avoid RN-specific SDKs because the app is Capacitor.
- StoreKit 2 direct (no vendor): need a Capacitor StoreKit plugin (less mature), your own server verification with `@apple/app-store-server-library` (Node, verifies JWS, supports App Store Server Notifications V2: verify x5c chain to Apple Root CA G3, check `bundleId` and `environment`, dedupe by `notificationUUID`). Doable (~3-5 days) and zero fee, but more edge cases (refunds, billing retry, family sharing, grace).
- Recommendation: RevenueCat now, keep server truth in your DB.
- Backend design with Express/Prisma: add `Entitlement` (userId unique FK onDelete Cascade, plan, status, expiresAt, source, originalTransactionId, updatedAt), `PurchaseEvent` (idempotency by event id). Set RevenueCat `app_user_id` = Kitcha user UUID (not email). Add `POST /api/v1/billing/revenuecat-webhook` (shared-secret Authorization header, idempotent upsert) and `GET /api/v1/billing/me`. Gate AI routes by entitlement in the existing quota guard (ai-quota.repository.ts). Treat client "isPro" as a hint only. Add "Restore Purchases" (required) and "Manage Subscription" deep link.
- If RevenueCat is skipped: also configure App Store Server Notifications V2 URLs (production + sandbox) pointing at an Express route using the Apple library.
- Delete-account + subscription: tell users deletion does not cancel the Apple subscription; link to Manage Subscriptions.

### 2.7 Pricing and paywall proposal (PH-aware)
Set USD base then edit PH price points manually; do not rely on auto-equalization, which can produce a high PH price. Suggested (to A/B in RevenueCat; all [L], market-positioned from section 2.1):

| Plan | USD | PHP (set manually, check Apple's allowed price points) |
|---|---|---|
| Kitcha Plus Annual (hero, 7-day trial) | $19.99 | ~PHP 599-699 |
| Kitcha Plus Monthly | $2.99 | ~PHP 99-129 |
| Lifetime (optional, cap to avoid unbounded AI cost) | $39.99 | ~PHP 1,199-1,499; leave off at launch because AI is a recurring cost |

Launch with freemium plus soft paywall at: 4th AI generation in a week, 41st pantry item (tune), household invite, nutrition panel. No paywall before the first successful scan or first AI result (show value first). Annual shown as default with monthly equivalent ($1.67/mo).

## 3. App Review pitfalls for this app

| # | Rule | Status in repo | Action | Effort |
|---|---|---|---|---|
| 1 | 5.1.1(v) in-app account deletion [H] | Soft delete only, body mismatch, toast lies (see section 0) | Add `DELETE /api/v1/users/me` that hard-deletes via cascade (all relations are `onDelete: Cascade`, verified in schema.prisma; AiUsage `user:<id>` rows have no relation, so delete those too; ZapierWebhook rows cascade), re-auth by password (or typed confirm), invalidate JWTs, call RevenueCat subscriber delete / mark entitlement, return 204; keep deactivate as separate "pause" or remove. Fix frontend to send password and show real status; add integration test. Add also data export check (CSV exists). | S-M (1 day) |
| 2 | 4.8 Sign in with Apple [H] | No Google/Apple/OAuth code found in auth module (email+password only) | Not required today. If you add Google/Facebook login, you must add Sign in with Apple (or equivalent privacy-limited option), then 5.1.1(v) also requires token revocation on deletion. Staying email+password avoids the work. | 0 now |
| 3 | 5.1.2(i) third-party AI disclosure and explicit permission [H] | Pantry/recipe text goes to an external LLM | Show a one-time consent sheet before first AI use naming the provider class; send names, quantities, diet tags only (already planned); privacy policy section. Hide Zapier webhooks on iOS or disclose (user-initiated data export to third parties). | S |
| 4 | Privacy manifest (PrivacyInfo.xcprivacy) and nutrition labels [H/M] | None; Capacitor needs one | Add manifest with required-reason API entries (UserDefaults CA92.1, file timestamp, etc.) and verify every Capacitor plugin ships its own; App Privacy answers: Contact Info (email, name), User Content (pantry, recipes), Identifiers (user id; device id if RevenueCat/anon id), Purchases, Usage Data (if analytics), Diagnostics if crash SDK. Linked to user, not used for tracking. Answers must match actual traffic. Enforcement of manifests for new submissions began 2024 (ITMS-91053 errors). | S-M |
| 5 | ATT [H] | None | No ATT prompt if you do no cross-app tracking and use no ad/attribution SDK; do not add one. Set `NSPrivacyTracking` false. | 0 |
| 6 | Open Food Facts (ODbL) and USDA [M] | Attribution constants exist (backend/src/modules/food/food.attribution.ts) | Show attribution in-app wherever OFF data appears and in an About/Licenses screen. ODbL: attribute; share-alike applies to a derived *database* you publicly distribute (your Postgres product cache is not shipped to users, but do not publish a derived dataset without ODbL). Images are CC BY-SA, so attribute and avoid modifying/re-hosting without compliance. Send a descriptive User-Agent (per CLAUDE.md). I could not load the OFF terms page (bot-blocked): confirm at https://world.openfoodfacts.org/terms-of-use. USDA is CC0. Recipe content: only user-entered and AI-generated recipes; no scraped recipe sites. Spoonacular/Edamam already dropped (their terms forbid caching). TheMealDB: commercial use requires paid supporter key; skip. | S |
| 7 | 4.2 minimum functionality [H] | PWA/web UI | See section 2.5. In App Review Notes, list native features. | M-L |
| 8 | 3.1.1/3.1.2 IAP [H] | No billing yet | IAP only for digital features; Restore Purchases; subscription disclosures on paywall (price, period, auto-renew, cancel, Terms and Privacy links); Terms of Use link in metadata (or standard Apple EULA). | M |
| 9 | AI-generated content safeguards [M] | AI outputs shown to users | No dedicated generative-AI rule found in the guidelines text (last updated June 8, 2026) beyond 1.2/4.7 filtering/report/block patterns and 5.1.2(i). Add: "AI-generated, may contain errors" label, in-app "Report this result" button (store report + prompt hash), prompt-sanitize already exists (ai/prompt-sanitize.ts). Reviewers still flag unfiltered generative output. | S |
| 10 | Health and nutrition claims, 1.4.1 [H] | Dietary filter and nutrition data | No medical claims; add "informational, not medical advice; verify allergens on product labels; consult a doctor" near dietary/allergy filters and nutrition. AI "allergen-free" outputs are a liability: keep `apply-dietary` post-filter and disclaimer. Do not claim calorie accuracy. | S |
| 11 | Push notification permission [M] | Notification module exists; no push client | Ask only in context (after user adds first perishable item), never on launch; app must work if declined; no marketing pushes without opt-in (4.5.4, from memory). Expiry alerts can be local notifications, so no APNs server needed. | S-M |
| 12 | 2.1 demo account [H] | n/a | Create a seeded reviewer account with pantry, recipes, meal plan, and a Plus entitlement (sandbox/promo), keep the Railway backend up, give creds in App Review Notes. Provide notes about AI quota. | S |
| 13 | Privacy Policy, Terms, Support URL [H] | No privacy/terms pages found in frontend/app | Publish pages (privacy URL is mandatory in App Store Connect and in-app; support URL; marketing URL optional). Must cover AI processing, data deletion, Open Food Facts attributions, subscriptions. Policy for PH Data Privacy Act (RA 10173) and GDPR if shipping to EU. | S |
| 14 | Quality/stability, 5.6 conduct [H] | n/a | Test on-device; no private APIs; 5.6.1 use `SKStoreReviewController` for review prompts only. | S |
| 15 | 1.2 UGC [H] | Recipes are private | Not triggered while there is no public/social sharing. Household sharing among invited members is closer to private; if you add public recipe sharing, you need filter, report, block, and contact info. | 0 |
| 16 | Age rating and export compliance [M] | n/a | Complete the new age-rating questionnaire in App Store Connect (should land 4+/9+; AI-generated text may bump questions); set `ITSAppUsesNonExemptEncryption=false` (HTTPS only). | S |

## 4. Launch checklist (prioritized)

P0 (blocks submission)
1. Decide name after availability check (Kitcha conflict) and register domain, brand, support email. [S, 0.5 d plus legal check]
2. Enroll Apple Developer Program (individual), accept Paid Apps agreement, tax and bank info, W-8BEN, enroll Small Business Program. [S, 1-3 d wait for approval; payout setup]
3. Fix account deletion + frontend flow + tests. [S-M]
4. Privacy Policy, Terms, Support pages; in-app links. [S]
5. Capacitor shell with native barcode scanning, local expiry notifications, privacy manifest, icons/launch screen, safe areas; fix PWA-only assumptions. [L, 1-2 wks]
6. Billing: RevenueCat products (Plus annual/monthly), paywall, Restore, webhook + Entitlement table + AI gating. [M-L, 4-7 d]
7. AI consent sheet, AI label and report button, health disclaimers. [S-M]
8. Demo account + review notes; backend production hardening (Railway Hobby, spend cap, `/health`, CORS to app origin `capacitor://localhost`/`https://localhost`, correct JWT storage in native). [M]
9. TestFlight internal then external beta (2 weeks, 10-30 testers incl. PH users). [M]

P1 (launch week)
10. App Store listing: name (30 chars), subtitle (30), keywords field (100 chars, comma-separated, no spaces, no repeated words, no competitor names), promo text, description, category Food & Drink (secondary Lifestyle), 6.9" and 6.5" iPhone screenshots (iPhone-only means no iPad screenshots), optional 15-30s preview video, privacy nutrition labels, age rating, localized PH English/Filipino metadata. [M]
11. Crash/analytics without tracking (Apple's own metrics, or privacy-friendly crash reporter). [S]
12. Pricing experiments plan in RevenueCat. [S]

P2 (post-launch)
13. Household sharing (new schema), widgets, Siri shortcuts, iPad. [L]
14. Web checkout for US via 3.1.1(a); Android via Play Billing. [M]
15. On-device or PCC AI via Foundation Models to cut AI cost. [M, spike first]

ASO basics (all [L] as heuristics):
- Keywords to target: pantry, expiry, meal planner, grocery list, recipes, food waste, shopping list, budget, barcode, fridge tracker. Title format: "<Name>: Pantry & Meal Planner" (30 char limit). Avoid trademarked competitor names. Apple indexes name + subtitle + keyword field, so don't duplicate words across them.
- Screenshots: 5-8; first three carry the story (scan pantry, expiring soon, AI plan for the week); caption text large; show PHP prices for PH storefront; localize at least en-PH.
- Ratings: use `SKStoreReviewController` after a success moment (third completed shopping trip), never on launch.
- Trademark: search IPOPHL, USPTO TESS, and EUIPO for "Kitcha" and variants (Kitchi, Kitch); note the existing Kamp Inc app. A cheap fallback is to adopt a more distinctive coined name.

## 5. Sources
- https://developer.apple.com/programs/whats-included/ , https://developer.apple.com/programs/enroll/
- https://developer.apple.com/app-store/small-business-program/
- https://developer.apple.com/app-store/review/guidelines/ (last updated June 8, 2026)
- https://developer.apple.com/documentation/bundleresources/privacy-manifest-files (page body did not load; content from knowledge, [M])
- https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-v2 (body did not load; knowledge, [M])
- https://www.revenuecat.com/pricing/ , https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- https://ai.google.dev/gemini-api/docs/pricing
- Competitor prices: https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004 , https://apppricinglab.com/app/apple/1303222868 , https://apppricinglab.com/iap/apple/1352600944 , https://haznos.org/2026/best-meal-planning-app-2026/
- PH VAT on digital services: https://www.tripleiconsulting.com/digital-tax-philippines-guide-vat-digital-services-act-for-businesses/ , https://gratanet.com/publications/specifics-of-taxation-of-electronic-services-in-the-philippines
- Name collision: https://apppricinglab.com/app/apple/6758049420

## 6. Open items needing human verification
- Philippines VAT/tax treatment of App Store proceeds and payout mechanics (ask accountant/BIR).
- Actual App Store listing of Kamp Inc's Kitcha and trademark filings.
- Current PH price points in App Store Connect; competitor prices on live listings.
- Real token usage per AI feature from logs; Dahl/MiniMax pricing and ToS for commercial use and data retention.
- OFF terms page (blocked), TestFlight limits, push notification rule 4.5.4 text.
