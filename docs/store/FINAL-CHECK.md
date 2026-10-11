# Final pre-submission check (Kumaun 1.0, build 2610111628)

Run 2026-10-12 against App Store Connect (API), the live web and the production API. Read-only except attaching the build to version 1.0.
Legend: PASS = verified by a call or file, FAIL = verified wrong or missing, OWNER = cannot be verified or changed by the API, owner must do or confirm.
No secrets are recorded here (the demo password is present in ASC and deliberately not copied).

## Summary

| # | Area | Result |
|---|------|--------|
| 1 | Build 2610111628 uploaded, processing VALID, attached to 1.0, in Internal Testers | PASS |
| 2 | Version state PREPARE_FOR_SUBMISSION, no review submission exists | PASS |
| 3 | iPhone screenshots (APP_IPHONE_67, 7 x COMPLETE) | PASS |
| 4 | iPad screenshots (APP_IPAD_PRO_3GEN_129, 7 x COMPLETE) | PASS |
| 5 | Description, keywords, promo text, support URL, marketing URL | PASS |
| 6 | Privacy policy URL set in ASC | PASS |
| 7 | Name and subtitle | PASS |
| 8 | Categories (Food & Drink, Lifestyle) | PASS |
| 9 | Age rating answers (result 12+) | PASS (owner to eyeball vs LISTING.md) |
| 10 | Copyright | PASS |
| 11 | Content rights declaration | PASS |
| 12 | Review detail: contact first/last name, phone, email | FAIL / OWNER |
| 13 | Review detail: demo account name, password, required flag, notes | PASS |
| 14 | IAP Kumaun Full: READY_TO_SUBMIT, USD 9.99, 175 territories, screenshot COMPLETE, localization present | PASS |
| 15 | IAP attached to version 1.0 | OWNER |
| 16 | App price (Free) schedule | FAIL / OWNER |
| 17 | App availability (territories) | FAIL / OWNER |
| 18 | Export compliance | PASS |
| 19 | Privacy manifest in archive | PASS |
| 20 | Swift screenshot-injection code compiled out of device archive | PASS |
| 21 | App Privacy (nutrition label) published | OWNER |
| 22 | Privacy page live, 200, no DRAFT banner | FAIL / OWNER |
| 23 | Terms page live, 200, no DRAFT banner | FAIL / OWNER |
| 24 | Support page live, 200, no DRAFT banner | FAIL / OWNER |
| 25 | Support page has a contact method | FAIL / OWNER |
| 26 | Backend healthy | PASS |
| 27 | App Store webhook endpoint exists | PASS |
| 28 | Webhook URLs registered in ASC (V2 prod and sandbox) | OWNER |
| 29 | Sandbox tester, sandbox purchase/restore/refund test | OWNER |
| 30 | Account deletion route on production | PASS |
| 31 | AI consent route on production | PASS |
| 32 | Real-device TestFlight test (iPhone and iPad) | OWNER |
| 33 | Paid Apps Agreement, bank, tax | OWNER |

## Evidence

### Build and version
- App id 6821534286, bundle app.kitcha.mobile, SKU kitcha-ios-1.
- Version 1.0 id 28ad9ed9-..., appStoreState PREPARE_FOR_SUBMISSION, release type AFTER_APPROVAL (manual after approval).
- Build 2610111628: processingState VALID, not expired (expires about 2027-01-09), usesNonExemptEncryption false, internalBuildState IN_BETA_TESTING. Attached to 1.0 by PATCH appStoreVersions/{id}/relationships/build and read back (replaced 2610111532). Build is also in the "Internal Testers" group (tester Erven) along with the two older builds.
- No review submission exists (reviewSubmissions filter empty).

### Release-build hygiene
- `verify-bundle.sh` ran inside `archive-ios.sh`: "verify-bundle OK", bundle 4684 KB of 10240, no server key, https API, no E2E or shot markers. The archived `.app/public` has no `e2e` or `shot` directories.
- Archived binary: 0 matches for `ShotBridge`, `KUMAUN_SHOT`, `__KUMAUN_SHOT__` (also none in `public/`). The `SceneDelegate` class itself is present (expected, it is the normal scene delegate); the `ShotBridgeViewController` and env-injection code are under `#if targetEnvironment(simulator)` in `mobile/ios/App/App/SceneDelegate.swift` and absent from the device binary.
- Info.plist: version 1.0, ITSAppUsesNonExemptEncryption false.
- Upload via `upload-testflight.sh`: "Upload succeeded", "EXPORT SUCCEEDED".

### Privacy manifest
`App.app/PrivacyInfo.xcprivacy` is present in the archive. Collected types include Email, Name, UserID, OtherUserContent, ProductInteraction and PurchaseHistory (all linked, no tracking, app functionality). Apple's upload validation raised no ITMS-91053 or manifest error. Owner should still compare against the App Privacy answers (PRIVACY-LABELS.md).

### Metadata
- Name: "Kumaun: Pantry & Meal Planner". Subtitle: "Expiry alerts & grocery list".
- Keywords present (12 terms), promo text present, description 2379 chars, whatsNew null (not required for a first version).
- Support URL https://kitcha-ai.vercel.app/support, marketing URL https://kitcha-ai.vercel.app/, privacy URL https://kitcha-ai.vercel.app/privacy.
- Primary FOOD_AND_DRINK, secondary LIFESTYLE. Copyright "2026 Erven Sala Idjad".
- Age rating declaration: health or wellness topics true, medical info INFREQUENT_OR_MILD, everything else none/false (no UGC, no web access, no gambling), resulting 12+.
- contentRightsDeclaration USES_THIRD_PARTY_CONTENT.

### Review detail
- Present: demo account name, demo password (not shown here), demoAccountRequired true, notes (sign-in, AI consent, IAP test steps, barcode, account deletion, health URL).
- MISSING: contactFirstName, contactLastName, contactPhone, contactEmail are all null. ASC blocks submission without them.

### IAP (Kumaun Full, app.kitcha.mobile.full)
- NON_CONSUMABLE, state READY_TO_SUBMIT, price point customerPrice 9.99 USD (proceeds 8.49), availability 175 territories with availableInNewTerritories true, en-US localization, review screenshot COMPLETE, review note present.
- The API does not expose whether a first IAP is ticked on the version page, so attachment is OWNER.

### Pricing and availability (found missing)
- `GET /v1/apps/{id}/appPriceSchedule` returns a stub with base territory USA, but `manualPrices` returns 404 (no price set). The app price point for USD "free" exists (0.0) but no schedule row selects it.
- `GET /v2/appAvailabilities/{id}` returns 404 (no territory availability configured).
- Both are required before submission. Set Price = Free (USD 0) and select territories in ASC > Pricing and Availability (the API key could do it if the owner wants it scripted).

### App Privacy (nutrition label)
No App Store Connect API endpoint for App Privacy answers or publish state exists on this account (all candidate paths 404). OWNER: answer and Publish in ASC > App Privacy using PRIVACY-LABELS.md, including Purchase History.

### Live web (https://kitcha-ai.vercel.app)
- /privacy 200, /terms 200, /support 200.
- All three still show the banner "Draft: pending owner review.". Toggle: `DRAFT_BANNER_ENABLED = true` at `frontend/lib/legal/legal-config.ts` line 8 (text at line 9). Not changed. After flipping it, redeploy the frontend to Vercel.
- Support page shows "Contact email not configured." Cause: `NEXT_PUBLIC_SUPPORT_EMAIL` is unset in the Vercel build (and in the local release build, which logged the same warning). Apple rejects a support page without contact info. Set it in Vercel and redeploy.
- The privacy page content was not legally reviewed here; the owner approves the text.

### Backend (https://kitcha-api-production.up.railway.app)
- GET /health 200 `{"status":"ok"}`.
- POST /api/v1/webhooks/app-store (unsigned, `{}`) 400, not 404 (route exists, rejects bad payload). GET returns 404 as expected (POST-only).
- Unauthenticated probes return 401 (not 404): DELETE /api/v1/users/me (permanent delete), DELETE /api/v1/users/account, GET and POST /api/v1/users/me/ai-consent, GET /api/v1/ai/status, POST /api/v1/ai/suggest-recipes, GET /api/v1/entitlements/me. An unknown path returns 404, so these 401s prove the routes exist.
- Not verifiable by API: `APPLE_APP_APPLE_ID` set on Railway, `IAP_ALLOW_XCODE_ENV` unset, 30-day log retention.
- Backend was not deployed or changed by this check.

## Owner actions before clicking Add for Review (in order)

1. Complete the Paid Apps Agreement, bank and tax forms (ASC > Business). The IAP cannot go live without it.
2. Set `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel (a plain email address you monitor) and review the legal text.
3. Set `DRAFT_BANNER_ENABLED = false` in `frontend/lib/legal/legal-config.ts` (line 8), commit, and let Vercel redeploy. Re-check /privacy, /terms, /support show no draft banner and the support page shows the email.
4. Confirm on Railway: `APPLE_APP_APPLE_ID` is set, `IAP_ALLOW_XCODE_ENV` is not set, request-log retention is 30 days.
5. In ASC > App Information / Version 1.0 > App Review Information, fill contact first name, last name, phone, email.
6. In ASC > Pricing and Availability, set the app price to Free (USD 0) and confirm the territories.
7. In ASC > App Privacy, answer the questionnaire per PRIVACY-LABELS.md (include Purchase History, AI provider disclosure) and press Publish.
8. Register App Store Server Notifications V2 URLs for Production and Sandbox (`https://kitcha-api-production.up.railway.app/api/v1/webhooks/app-store`) and use "Request a Test Notification" to see 200.
9. Create a sandbox tester, then on a real iPhone via TestFlight build 2610111628 run: sandbox purchase, delete-app then Restore Purchases, second-device unlock, refund; barcode scan, notification permission and delivery, airplane mode, account deletion, AI consent sheet. Repeat the main pass on a real iPad.
10. On the version 1.0 page, scroll to "In-App Purchases and Subscriptions", add Kumaun Full to the version, and confirm it shows Ready to Submit.
11. Check the version page once more: build 2610111628 selected, screenshots present, age rating 12+ matches LISTING.md, release option (manual or after approval, currently AFTER_APPROVAL), content rights, export compliance shows no prompt.
12. Run NAME-CHECK.md clearance for "Kumaun" if not yet done.
13. Click Add for Review, then Submit for Review.
