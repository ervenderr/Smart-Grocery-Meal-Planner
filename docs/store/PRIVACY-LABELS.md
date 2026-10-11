# App Privacy ("nutrition label") answers and Privacy Manifest

Derived 2026-10-11 from: `backend/prisma/schema.prisma`, `backend/src/modules/{auth,ai,notification,food,zapier,analytics}`, `backend/src/app.ts` (morgan request logging), `mobile/package.json` + `mobile/ios/App/App/Info.plist`, and `frontend/app/privacy/page.tsx`. Re-check against the shipping build; answers must match actual traffic and the privacy policy.

## Findings that drive the answers

- No analytics, crash-reporting, ad or attribution SDK exists in `frontend/` or `mobile/` (searched for sentry, posthog, gtag, plausible, vercel analytics: none). The backend `analytics` module is the user's own grocery-spend dashboard, not product analytics.
- Auth is email + password (hashed). Tokens are stored in the iOS Keychain via `@aparajita/capacitor-secure-storage`.
- Data stored per user (all `onDelete: Cascade`): email, optional first/last name, optional avatarUrl, pantry items (incl. optional purchase price), recipes (incl. optional nutrition), meal plans, shopping lists and history (prices), budget preferences, notifications and alerts, AI consent timestamp/version, AI reports (user-submitted, optional 500-char note), refresh tokens, idempotency keys, Zapier webhook URLs.
- AI: only ingredient names, quantities and dietary tags go to the AI provider (default config: an OpenAI-compatible endpoint, `AI_PROVIDER=dahl`; docs elsewhere say Gemini; decide the final provider before submitting and name it in the privacy policy). No name or email is sent. Consent is stored (`aiConsentAt`).
- Camera: used for barcode scanning only, frames are not saved (Info.plist NSCameraUsageDescription says so). Not collected.
- Barcodes are looked up through the backend against Open Food Facts; the barcode value is sent to our server and to Open Food Facts, not tied to identity at OFF.
- Notifications: local notifications only (no APNs token, no push server). Nothing collected.
- Location, contacts, photos library, health data, advertising ID, IDFA: not accessed. No ATT prompt needed.
- Server request logs (morgan "combined") include the client IP. See open question 2.
- Zapier webhooks: a user-supplied URL receiving events the user configures. User-directed export, but see open question 3.

## App Store Connect > App Privacy answers

Question 1, "Do you or your third-party partners collect data from this app?": **Yes**.

| Apple data type (category) | Collected? | Linked to user? | Used for tracking? | Purposes | Notes |
|---|---|---|---|---|---|
| Contact Info > Email Address | Yes | Yes | No | App Functionality | Account login, also support. |
| Contact Info > Name | Yes (optional first/last name) | Yes | No | App Functionality | Declare even though optional. |
| User Content > Other User Content | Yes | Yes | No | App Functionality | Pantry, recipes, meal plans, shopping lists, notes, AI report notes. Also what is sent to the AI provider (ingredient names). |
| Identifiers > User ID | Yes | Yes | No | App Functionality | Server user UUID, token subject. |
| Usage Data > Product Interaction | Yes | Yes | No | App Functionality | Per-user AI request counters (`AiUsage`) used for quota and rate limiting. Over-declaring is safe; this is the conservative choice. |
| Purchases > Purchase History | **Phase 12 only** | Yes | No | App Functionality | Add when entitlement (originalTransactionId, status) is stored server-side. Not yet built. |
| Financial Info | No (judgement call) | | | | Grocery prices and budget are entered by the user as list/pantry data; Apple's Financial Info covers payment, credit, salary/assets type data. Treated as User Content. Declare Other Financial Info instead if you prefer a conservative reading. |
| Health & Fitness | No | | | | Recipe calories are reference data, not user health data. |
| Location, Contacts, Photos or Videos, Audio, Browsing History, Search History, Sensitive Info | No | | | | Camera frames are processed on device for scanning and not stored or sent. |
| Identifiers > Device ID | No | | | | Verify `@capacitor/device` `getId` is not sent to the server (not checked; open question 4). |
| Diagnostics (Crash Data, Performance Data, Other) | No | | | | No crash SDK. TestFlight/Apple's own crash data is not "collected by you". |
| Other Data | No | | | | |

Follow-up answers per declared type: **Linked to user's identity: Yes. Used for tracking: No.** For the question "Do you use data for tracking?": **No** (no ad networks, no data brokers, no linking with third-party data for advertising). NSPrivacyTracking in the manifest is false and there are no tracking domains.

Third-party partners that receive data (declare them within the types above, per Apple's rule that partner collection counts): the AI provider (ingredient names, quantities, dietary tags, no identity), Open Food Facts and USDA (barcode and search terms, no identity), hosting (Railway for API and database, Vercel for the website). RevenueCat or App Store Server API only when Phase 12 ships.

Privacy Policy URL: `https://<vercel-host>/privacy` (page exists). Before submission update it to state: the final AI provider, retention of logs/IP, Phase 12 purchase data, deletion behavior, and the Open Food Facts/USDA attributions.

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

## Open questions for the owner

1. Final AI provider (Dahl/MiniMax per env defaults vs Gemini per CLAUDE.md): name it in the policy; check that provider's retention and training terms.
2. Server logs with IP (morgan) retained on Railway: Apple says data collected only counts if retained beyond real-time processing; if you keep logs for days, consider declaring Diagnostics > Other Diagnostic Data or documenting retention. Conservative path: declare nothing extra but state log retention in the policy. Your call.
3. Zapier webhooks: either hide the feature in the iOS build or keep it and state in the policy that it sends user-chosen events to a URL the user provides. Also a 5.1.2(i) consideration.
4. Confirm no device identifier from `@capacitor/device` is transmitted.
5. Whether to treat grocery prices/budget as Financial Info (conservative) or User Content (my recommendation).
