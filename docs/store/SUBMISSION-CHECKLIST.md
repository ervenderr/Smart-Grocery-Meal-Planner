# App Store submission checklist (Kumaun iPhone and iPad, v1.0.0)

Legend: **H** human-only (account, money, identity, physical device, final click). **A** agent-doable. **H+A** agent prepares, human confirms.
Dated 2026-10-11. Starting point: Apple enrollment pending. Companion docs: LISTING.md, PRIVACY-LABELS.md, IAP.md, SCREENSHOTS.md, NAME-CHECK.md, REVIEW-NOTES.md.

## 0. Enrollment and accounts

1. [H] Finish Apple Developer Program enrollment (Individual, 99 USD/yr, 2FA, legal name, phone, address). Wait for approval email. https://developer.apple.com/programs/enroll/
2. [H] App Store Connect > Business: accept **Paid Apps Agreement** (Account Holder only), add bank (USD-capable PH account) and tax forms (W-8BEN or whatever it requests). See IAP.md checklist. Needed even for a free app only if you sell the IAP; required before Phase 12 goes live.
3. [H] Enroll in Small Business Program after the agreement is active, before first sale.
4. [H] Ask an accountant about PH VAT/BIR treatment (unverified).

## 1. Name, domain, URLs

5. [H] Run NAME-CHECK.md clearance (App Store, USPTO, IPOPHL). Reserve the name by creating the app record. Decision made: Name: Kumaun (Kitcha was taken on the App Store; clearance still owner-run; fallbacks only if it fails). If renamed: update LISTING.md, display name, IAP display name. [A] can rerun the keyword/length script.
6. [H] Domain/hosting decision for support URL and email (`NEXT_PUBLIC_SUPPORT_EMAIL`). [A] pages already exist: `frontend/app/privacy`, `terms`, `support`; update copy per PRIVACY-LABELS.md required clauses (AI provider label, Zapier, 30-day log retention, Phase 12 purchases).
7. [H+A] Deploy backend to Railway and frontend to Vercel; fill API base URL and `<vercel-host>` placeholders in REVIEW-NOTES.md and LISTING.md. Backend must stay up during review (Guideline 2.1: "turn on your back-end service").

## 2. App binary (depends on Phases 9-13)

8. [A] Finish Phase 11 offline core and Phase 12 unlock ($9.99 Kumaun Full): both are in 1.0 scope (decided). Phase 13 on-device AI is deferred to 1.1. If Phase 12 slips, remove the Kumaun Full lines from LISTING.md.
9. [A] Compliance code: privacy manifest from `PrivacyInfo.proposed.xcprivacy` into the App target; `ITSAppUsesNonExemptEncryption=false`; keep `TARGETED_DEVICE_FAMILY=1,2` (iPad supported, decided); app icon 1024 (no alpha) and launch screen; version/build numbers. (Touching mobile/ios is another agent's/owner's area now.)
10. [H] Confirm bundle id `app.kitcha.mobile` is what you want forever; register it (Certificates, Identifiers and Profiles) and set the Team in Xcode (signing).
11. [H] Create the App Store Connect app record (name, primary language, bundle id, SKU).
12. [A] One scripted archive/export/upload to TestFlight (ROADMAP Phase 14; script not written yet). [H] provides signing/API key.
13. [H] Install the TestFlight build on a real iPhone; test camera barcode scan, local notifications permission flow, airplane mode, kill and reboot, account deletion, restore purchase. Internal testers need no Beta App Review; external testers need one (https://developer.apple.com/programs/whats-included/ ; limits UNVERIFIED).
14. [A] Generate and review the archive's Privacy Report; fix any ITMS-91053 required-reason issue by adding only the categories named.

## 3. Store metadata

15. [A] Final copy in LISTING.md; re-run `node scripts/store/check-listing-limits.mjs`.
16. [A] Seed demo account (REVIEW-NOTES.md production procedure; owner-approved, not yet done) [H approves and chooses the password; enter it only in App Store Connect].
17. [A] Run `scripts/store/capture-screenshots.sh <built .app> all` (iPhone 6.9 and 6.3 plus iPad 13-inch); [H] frame/caption and upload all size classes (SCREENSHOTS.md).
18. [H] Fill App Store Connect: description, keywords, promo text, support/marketing URLs, category Food & Drink, copyright, age rating questionnaire (LISTING.md answers), content rights, export compliance.
19. [H+A] App Privacy questionnaire per PRIVACY-LABELS.md; privacy policy URL; must match the manifest and real traffic.
20. [H] Pricing: Free; availability; Phase 12 IAP per IAP.md (create product, price, review screenshot, attach to version), sandbox tester, sandbox purchase and restore test.
21. [H] App Review Information: demo account email/password, contact phone and email, notes from REVIEW-NOTES.md plus a "native features" paragraph (see risk 4.2) and an AI paragraph.
22. [H] Choose release option (manual release recommended for v1) and select the TestFlight build.
23. [H] Final click: **Add for Review / Submit for Review**. Then monitor; reply to App Review messages quickly. [A] can draft replies.

## Kumaun Full (in-app purchase) items

Details and exact steps: IAP.md "Owner steps".

- [ ] [H] `APPLE_APP_APPLE_ID` set on Railway (IAP.md owner step 1).
- [ ] [H] App Store Server Notifications V2 URLs registered for Production and Sandbox (`https://<api-host>/api/v1/webhooks/app-store`) after the Railway deploy; "Request a Test Notification" returned 200.
- [ ] [H] Sandbox tester created; sandbox purchase, delete-and-Restore Purchases, second-device unlock and refund verified on TestFlight.
- [ ] [H+A] IAP review screenshot captured (IAP.md "Review screenshot") and uploaded; product leaves MISSING_METADATA.
- [ ] [H] IAP attached to the 1.0 version and in Ready to Submit.
- [ ] [H+A] Purchase History declared in the App Privacy questionnaire, and the Purchase History entry present in `mobile/ios/App/App/PrivacyInfo.xcprivacy` (PRIVACY-LABELS.md).
- [ ] [H] In-App Purchase capability present in Xcode Signing & Capabilities; `IAP_ALLOW_XCODE_ENV` NOT set on Railway.

## iPad QA (agent-doable, simulator "Kitcha-Store-iPad-13" or any iPad 13-inch simulator)

Required because iPad is supported (Apple reviews on iPad). Run on a built simulator app, with the demo account; record failures as issues for the frontend/mobile owner.

- [ ] A. Layout in portrait and landscape: every main screen (pantry, recipes, meal plan, shopping list, budget, settings, offline banner) fills the screen with no clipped content, no stretched phone layout, no overlap with safe areas; rotate mid-screen and state is kept.
- [ ] A. Navigation: sidebar versus bottom nav is deliberate on iPad (either is fine, but only one is shown, it does not overlap content, and all destinations are reachable in both orientations and in Split View / Slide Over sizes).
- [ ] A. Modals and sheets: add/edit pantry item, consent sheet, Kumaun Full unlock sheet, delete account confirm, and barcode scanner present at a sensible size (not full-bleed edge to edge text), are dismissible, and are not cut off in landscape.
- [ ] A. Keyboard: software keyboard does not cover focused inputs (login, add item, search, budget), scrolls into view, dismisses, and the hardware keyboard Tab/Return works in forms.
- [ ] A. Touch targets and text scale at default and larger Dynamic Type; no horizontal scroll.
- [ ] A. Camera: barcode scan opens and works (simulator has no camera, so the scan itself is H on a real iPad or an iPhone-only claim in review notes: confirm which).
- [ ] H. One pass on a real iPad (or the TestFlight build) before submitting: scan, notifications, purchase sandbox.

## Guideline risks specific to Kumaun

Guideline text checked at https://developer.apple.com/app-store/review/guidelines/ on 2026-10-11 (page body truncated after 5.3.4; later sections not read).

| Rule | Risk | Mitigation / status |
|------|------|---------------------|
| **4.2 Minimum functionality**: "features, content, and UI that elevate it beyond a repackaged website" | HIGH for a Capacitor wrapper of a Next.js app. | Bundled static export (no remote URL; confirmed in `capacitor.config.ts`). Native-only features: camera barcode scanning via native plugin, local expiry notifications, haptics, native share sheet, Keychain token storage, offline cache/queue. In review notes, list these and say where to find them. Ensure the app does not open in a plain web look: safe areas, tab bar, no browser chrome. Ship Phase 10/11 before submitting; a thin first build is the classic rejection. |
| **5.1.1(v) Account deletion**: "If your app supports account creation, you must also offer account deletion within the app." | MEDIUM. Research note 04 found it broken; the repo now has `DELETE` for permanent delete with password re-auth (`users.routes.ts` lines about 182-199) and REVIEW-NOTES says Settings > Data > Delete account. | Verify end to end on the device build before submitting: the UI calls the permanent route (not the soft-delete deactivate), sends the password, shows real errors, signs out, and data is gone. Tell users it does not cancel an Apple purchase. |
| **5.1.2(i) Data use and sharing**: must "clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission" | MEDIUM-LOW. Consent sheet exists (`aiConsentAt`, `require-ai-consent.ts`). | Verify the sheet names the AI provider and what is sent, defaults to off, and that declining leaves the app usable (REVIEW-NOTES says so). Policy must name the final provider. Zapier webhooks: kept; disclosed in the policy as optional and user-configured (PRIVACY-LABELS.md). |
| **3.1.1 In-App Purchase** and restore: "you should make sure you have a restore mechanism" | MEDIUM if Phase 12 ships. | Use IAP only (no external links or license keys) to unlock the pantry limit and AI allowance. Visible Restore Purchases. Do not mention external payment. Server-side enforcement per IAP.md. |
| **1.2 User-generated content** | LOW now (recipes private), but AI output is generated content users did not write. | No public sharing, so 1.2's filter/report/block/contact set is not triggered. AI results carry an "AI-generated" badge, health disclaimer and a Report action (REVIEW-NOTES). Keep the dietary post-filter. Re-evaluate if household or public sharing is added. Apple's guideline text I read has no separate generative-AI rule, but reviewers flag unfiltered AI output (research note 04, item 9; not independently re-verified). |
| 2.1 App completeness and demo account | MEDIUM | Active demo account or demo mode, backend on, seeded data, no placeholder text, working support/privacy URLs. |
| 5.2 Intellectual property (name) | MEDIUM | NAME-CHECK.md. Also Open Food Facts attribution (ODbL/CC BY-SA). |
| 1.4.1 health/medical claims | LOW | Keep "not medical or dietary advice; check labels for allergies" near nutrition and dietary filters. No allergen-free guarantees. |
| 4.5.4 push permission wording (from memory, UNVERIFIED) | LOW | Local notifications only; ask for permission in context after the first perishable item, not at launch; app works if declined. |
| 2.3 Accurate metadata | MEDIUM | Do not advertise unshipped features in LISTING.md or screenshots: offline and Kumaun Full only if they ship in 1.0; no on-device AI or Apple Intelligence claim (deferred to 1.1). See honesty notes in LISTING.md. |

## Open questions: decided (2026-10-11)

| Question | Decision |
|----------|----------|
| App name | Kumaun (Kitcha was taken on the App Store). Listing name `Kumaun: Pantry & Meal Planner` (29 chars). Clearance still owner-run. |
| iPad | Supported (`TARGETED_DEVICE_FAMILY=1,2`): 13-inch iPad screenshots plus the iPad QA above. |
| 1.0 scope | Phase 11 offline plus Phase 12 one-time $9.99 Kumaun Full. Phase 13 on-device AI deferred to 1.1; no on-device claims in the listing. |
| AI provider | Keep current env-configured OpenAI-compatible provider, label default `Dahl Inference`, named via the label. Gemini wording dropped. |
| Zapier webhooks | Keep; disclose in PRIVACY-LABELS.md and the policy. |
| Server logs | 30-day retention for request logs with client IPs; policy clause required; not collected for tracking. |
| Grocery prices/budget | User Content, not Financial Info. |

## Remaining human-only items

- [H] Apple Developer enrollment, Paid Apps Agreement, bank and tax forms, Small Business Program, PH VAT advice (section 0).
- [H] Run name clearance for Kumaun: App Store Connect availability, App Store search, USPTO, WIPO, IPOPHL, EUIPO (NAME-CHECK.md). Switch to a fallback only if it fails.
- [H] Confirm the exact AI provider and operator name (and its retention/training terms) before the privacy policy is published.
- [H] Approve and publish the privacy policy text with the required clauses; fill legal name, support email, domain, `<vercel-host>`, API host.
- [H] Enforce or confirm 30-day log retention on Railway.
- [H] Bundle id, signing team, App Store Connect app record, IAP product creation and price (USD 9.99, PHP manual), sandbox tester.
- [H] Real iPhone and iPad TestFlight testing (camera scan, notifications, airplane mode, account deletion, purchase and restore).
- [H] Demo account password, App Review contact info, age rating answers, App Privacy questionnaire, framing screenshots, final Submit.
- [H] Confirm no `@capacitor/device` identifier is sent to the server.

## Known unverified items

- Apple's own pages for required-reason API codes and privacy manifest data-type keys returned no body when fetched; recalled values are flagged in PRIVACY-LABELS.md.
- Promotional text 170, description 4000, keywords 100 limits not on the fetched Apple page.
- PH VAT, withholding and W-8BEN specifics, payout minimum, PHP price point list.
- Whether the OutSystems barcode SPM dependency requires privacy manifest entries.
