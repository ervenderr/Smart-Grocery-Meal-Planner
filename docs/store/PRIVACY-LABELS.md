# App Privacy ("nutrition label") answers and Privacy Manifest

Derived 2026-10-11 from: `backend/prisma/schema.prisma`, `backend/src/modules/{auth,ai,notification,food,zapier,analytics}`, `backend/src/app.ts` (morgan request logging), `mobile/package.json` + `mobile/ios/App/App/Info.plist`, and `frontend/app/privacy/page.tsx`. Re-check against the shipping build; answers must match actual traffic and the privacy policy.

## Findings that drive the answers

- No analytics, crash-reporting, ad or attribution SDK exists in `frontend/` or `mobile/` (searched for sentry, posthog, gtag, plausible, vercel analytics: none). The backend `analytics` module is the user's own grocery-spend dashboard, not product analytics.
- Auth is email + password (hashed). Tokens are stored in the iOS Keychain via `@aparajita/capacitor-secure-storage`.
- Data stored per user (all `onDelete: Cascade`): email, optional first/last name, optional avatarUrl, pantry items (incl. optional purchase price), recipes (incl. optional nutrition), meal plans, shopping lists and history (prices), budget preferences, notifications and alerts, AI consent timestamp/version, AI reports (user-submitted, optional 500-char note), refresh tokens, idempotency keys, Zapier webhook URLs.
- AI: only ingredient names, quantities and dietary tags go to the AI provider (owner decision 2026-10-11: keep the current provider, the env-configured OpenAI-compatible endpoint whose user-facing label is configurable, default `Dahl Inference`; Gemini wording is superseded. The privacy policy and consent sheet must name it via that configurable label, and the OWNER MUST CONFIRM the exact provider and operator name before the policy is published). No name or email is sent. Consent is stored (`aiConsentAt`).
- Camera: used for barcode scanning only, frames are not saved (Info.plist NSCameraUsageDescription says so). Not collected.
- Barcodes are looked up through the backend against Open Food Facts; the barcode value is sent to our server and to Open Food Facts, not tied to identity at OFF.
- Notifications: local notifications only (no APNs token, no push server). Nothing collected.
- Location, contacts, photos library, health data, advertising ID, IDFA: not accessed. No ATT prompt needed.
- Server request logs (morgan "combined") include the client IP. Decision: 30-day retention (see Decisions section).
- Zapier webhooks: kept (owner decision). Optional, user-configured integration: a URL the user supplies receives only the events the user configures. User-directed export, not collection by us for third parties; disclosed below and required in the policy text.

## App Store Connect > App Privacy answers

Question 1, "Do you or your third-party partners collect data from this app?": **Yes**.

| Apple data type (category) | Collected? | Linked to user? | Used for tracking? | Purposes | Notes |
|---|---|---|---|---|---|
| Contact Info > Email Address | Yes | Yes | No | App Functionality | Account login, also support. |
| Contact Info > Name | Yes (optional first/last name) | Yes | No | App Functionality | Declare even though optional. |
| User Content > Other User Content | Yes | Yes | No | App Functionality | Pantry, recipes, meal plans, shopping lists, notes, AI report notes. Also what is sent to the AI provider (ingredient names). |
| Identifiers > User ID | Yes | Yes | No | App Functionality | Server user UUID, token subject. |
| Usage Data > Product Interaction | Yes | Yes | No | App Functionality | Per-user AI request counters (`AiUsage`) used for quota and rate limiting. Over-declaring is safe; this is the conservative choice. |
| Purchases > Purchase History | **Yes in 1.0 (Phase 12 in scope)** | Yes | No | App Functionality | Declare once entitlement (originalTransactionId, status) is stored server-side; the feature is not built yet. |
| Financial Info | No (decided) | | | | Owner decision: grocery prices and budget stay classified as User Content (user-entered list/pantry data; Apple's Financial Info covers payment, credit, salary/assets type data). |
| Health & Fitness | No | | | | Recipe calories are reference data, not user health data. |
| Location, Contacts, Photos or Videos, Audio, Browsing History, Search History, Sensitive Info | No | | | | Camera frames are processed on device for scanning and not stored or sent. |
| Identifiers > Device ID | No | | | | Verify `@capacitor/device` `getId` is not sent to the server (not checked; open question 4). |
| Diagnostics (Crash Data, Performance Data, Other) | No | | | | No crash SDK. TestFlight/Apple's own crash data is not "collected by you". Server request logs (client IP, path, status) are kept 30 days for security and debugging only: not used for tracking, analytics or advertising, not linked to a profile. Treated as not collected under Apple's definition (security/abuse prevention and short operational retention); the 30-day retention is stated in the policy. If you prefer the conservative reading, declare Diagnostics > Other Diagnostic Data, not linked, not tracking, purpose App Functionality. |
| Other Data | No | | | | |

Follow-up answers per declared type: **Linked to user's identity: Yes. Used for tracking: No.** For the question "Do you use data for tracking?": **No** (no ad networks, no data brokers, no linking with third-party data for advertising). NSPrivacyTracking in the manifest is false and there are no tracking domains.

Third-party partners that receive data (declare them within the types above, per Apple's rule that partner collection counts): the AI provider (label default `Dahl Inference`, ingredient names, quantities, dietary tags, no identity), Open Food Facts and USDA (barcode and search terms, no identity), hosting (Railway for API and database, Vercel for the website). RevenueCat or App Store Server API only when Phase 12 ships.

Privacy Policy URL: `https://<vercel-host>/privacy` (page exists). Before submission update it to state the clauses in the next section.

## Privacy manifest (PrivacyInfo.xcprivacy)

Proposal file: `docs/store/PrivacyInfo.proposed.xcprivacy` (lint-checked with `plutil`). It is NOT in `mobile/ios`; adopting it is a change to the iOS project for the mobile agent/owner after Phase 11.

What exists today (2026-10-11):
- `mobile/ios/App/App/` contains no `PrivacyInfo.xcprivacy` (checked). The App target needs its own: Apple requires the app-level manifest for required-reason API use by the app's own code and as the place for data-collection declarations. Third-party SDK manifests are aggregated into the privacy report at archive time.
- `@capacitor/ios` 8.5.3 ships manifests for `Capacitor` and `CapacitorCordova`, both with empty `NSPrivacyAccessedAPITypes`, empty collected data, tracking false.
- None of the installed Capacitor plugins (app, barcode-scanner, device, haptics, keyboard, local-notifications, share, splash-screen, status-bar) or `@aparajita/capacitor-secure-storage` ship an `.xcprivacy`, and none of their Swift sources use UserDefaults, file timestamps, boot time, disk space or active-keyboard APIs (grep). `@capacitor/device` reads `ProcessInfo().environment["SIMULATOR_MODEL_IDENTIFIER"]`, which is not a required-reason API.
- `@capacitor/barcode-scanner` depends on the SPM package `OSBarcodeLib-iOS` (OutSystems), which is not on disk, so its API use and manifest could NOT be inspected. This is the main unknown.

What to add:
1. `NSPrivacyTracking` false, `NSPrivacyTrackingDomains` empty.
2. `NSPrivacyCollectedDataTypes` with the five types above (Email, Name, User ID, Other User Content, Product Interaction), each Linked true, Tracking false, purpose AppFunctionality. Add Purchase History with Phase 12.
3. `NSPrivacyAccessedAPITypes`: empty by evidence. After the first real archive (Xcode: Product > Archive > Distribute, or right-click the archive > Generate Privacy Report) and the first TestFlight upload, add exactly the categories Apple names in any ITMS-91053 email. The likely candidate is UserDefaults with reason `CA92.1` (read/write data only the app itself uses). Do not pre-declare reasons the code does not use.
4. Add the file to the App target resources.

Reason codes recalled (UNVERIFIED, Apple page body did not load; secondary sources agree on CA92.1 and 1C8F.1 only): UserDefaults CA92.1 own data, 1C8F.1 app group; FileTimestamp C617.1 (own container), 3B52.1 (user-chosen files), DDA9.1 (show to user); SystemBootTime 35F9.1 (elapsed time in app), 8FFB.1; DiskSpace 85F4.1 / E174.1 / 7D9E.1; ActiveKeyboards 3EC4.1 / 54BD.1. Authoritative list: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api . Enforcement background: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files .

Note: the Capacitor WKWebView's localStorage/IndexedDB/SQLite plugin usage by the web layer is not a required-reason API. If Phase 10/11 adds `@capacitor-community/sqlite` or similar, re-run the grep above, since SQLite wrappers often use file timestamp APIs (C617.1) and UserDefaults.

## Decisions (2026-10-11) and required privacy policy clauses

The privacy policy text (`frontend/app/privacy`, edited by whoever owns it, not here) MUST contain:

1. **AI provider**: names the provider using the configurable label (default `Dahl Inference`), says what is sent (ingredient names, quantities, dietary tags; no name or email), that it is sent only after explicit consent, and links the provider's retention/training terms. OWNER TO CONFIRM the exact provider and operator name before publishing. AI is not available in on-device form in 1.0.
2. **Zapier webhooks**: "Kitcha offers optional Zapier webhook integrations. If you configure one, Kitcha sends the events you select (for example pantry or shopping list changes) to the webhook URL you provide, which may be a Zapier or other third-party endpoint. You choose the URL and the events; we do not enable it by default. Data sent there is governed by that service's policy, and you can remove the webhook at any time."
3. **Server logs**: "Our servers keep request logs, which include your IP address, for 30 days for security, abuse prevention and debugging, then delete them. We do not use them for tracking or advertising." Server logs are not collected for tracking.
4. Purchase data (Kitcha Full entitlement) now that Phase 12 is in 1.0 scope; account deletion behavior; Open Food Facts and USDA attributions.
5. Offline: data cached on the device for offline use stays on the device until sync or sign-out.

Implementation follow-up for the backend owner: the 30-day log retention must be enforced on Railway (log retention setting or log drain), not just stated. Human/agent task, tracked in SUBMISSION-CHECKLIST.md.

Phase 12 is in 1.0 scope, so Purchases > Purchase History is declared in 1.0 (add the manifest entry; see the commented block in `PrivacyInfo.proposed.xcprivacy`).

## Open questions for the owner

DECIDED: AI provider (keep current, name via label), Zapier (keep, disclose), log retention (30 days), grocery prices/budget (User Content). Remaining:

1. Owner confirms the exact AI provider/operator name and its retention and training terms.
2. Confirm no device identifier from `@capacitor/device` is transmitted (not checked).
3. Enforce the 30-day log retention on Railway.
