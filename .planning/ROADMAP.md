# Roadmap: Kitcha

## Milestones

- ✅ **v1.0 Kitcha v2 production-ready** — Phases 1-6 (shipped 2026-10-10)
- 🚧 **v2.0 Kitcha for iPhone** — Phases 7-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Kitcha v2 production-ready (Phases 1-6) — SHIPPED 2026-10-10</summary>

- [x] Phase 1: Secure Foundation & Railway Deploy (6/6 plans) — completed 2026-10-08
- [x] Phase 2: Reliable AI Suggestions (8/8 plans) — completed 2026-10-08
- [x] Phase 3: Mobile-First Shell (13/14 plans; 03-14 real-iPhone check deferred) — completed 2026-10-08
- [x] Phase 4: Persistent Shopping List (11/12 plans; 04-12 real-phone check deferred) — completed 2026-10-08
- [x] Phase 5: Pantry-Aware Intelligence (12/13 plans; 05-13 real-phone check deferred) — completed 2026-10-09
- [x] Phase 6: Capture Loops (12/13 plans; 06-13 real-phone check deferred) — completed 2026-10-09

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v2.0 Kitcha for iPhone (In Progress)

**Milestone Goal:** Ship an offline-first iPhone app (Capacitor, in `mobile/`) that reuses the web app, works with no internet, and is monetized via subscription on the App Store.

**Human gates legend:** Phases marked HUMAN GATE contain steps an agent cannot do alone (Xcode install, real iPhone, Apple Developer enrollment, account or legal decisions). Agents prepare everything up to the gate and the work pauses there for the user. The user's Mac currently has only Command Line Tools (no Xcode).

- [ ] **Phase 7: Store Readiness** - Account deletion, AI consent and labels, legal pages, reviewer account, name check (HUMAN GATE: name/trademark decision)
- [x] **Phase 8: Offline Sync Backend** - Idempotency, delta adjust, client ids, refresh tokens, bootstrap endpoint, safe 401 handling (completed 2026-10-10)
- [ ] **Phase 9: Offline Rules Engine** - Network-free "what can I cook" ranking and ingredient substitutions
- [ ] **Phase 10: Capacitor iOS Shell** - Static-export Capacitor app with secure token storage, native scan, local notifications, simulator smoke test (HUMAN GATE: install Xcode, real iPhone)
- [ ] **Phase 11: Offline Core** - SQLite read cache and write outbox so the whole app works with no signal
- [ ] **Phase 12: Subscription** - Kitcha Plus via RevenueCat with server-side entitlement gating (HUMAN GATE: Apple Developer enrollment, App Store Connect products)
- [ ] **Phase 13: On-Device AI** - Apple Foundation Models suggestions with server fallback and a recorded comparison (HUMAN GATE: Apple Intelligence iPhone 15 Pro or newer)
- [ ] **Phase 14: TestFlight & App Store Release** - Scripted TestFlight upload, complete listing, submission (HUMAN GATE: enrollment, screenshots, submit)

## Phase Details

### Phase 7: Store Readiness
**Goal**: The app meets the App Store's account, AI and legal requirements, so nothing blocks review later
**Depends on**: Nothing (first phase of v2.0; no Xcode needed)
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05
**Human gate**: App name decision (App Store availability and trademark check are done by the user; agents prepare the checklist and a fallback name list). Hosting the legal pages publicly may need the user's domain/host choice.
**Success Criteria** (what must be TRUE):
  1. User can delete their account from settings after re-entering their password, and afterwards cannot log in and none of their pantry, recipes, plans, lists or AI usage rows remain in the database
  2. A user who has not accepted AI consent sees a consent screen before any AI feature sends data, accepting enables AI, and withdrawing consent stops AI calls
  3. Every AI-generated recipe or plan shows an "AI-generated" label and a health/nutrition disclaimer, and the user can report an item
  4. Privacy Policy, Terms of Use and Support pages are reachable at public URLs and linked from the app settings and sign-up screen
  5. A reviewer demo account with sample data and written review notes exist, and the app name is either cleared or replaced
**Plans**: 12 plans
Plans:
- [ ] 07-01-PLAN.md — Wave 0: local Postgres 16 + backend/.env, additive migration (consent columns, ai_reports), consent-by-default test helper
- [ ] 07-02-PLAN.md — Public /privacy, /terms, /support pages, shared AI disclosure constants, sign-up legal links
- [ ] 07-03-PLAN.md — Frontend AI consent infrastructure (pure logic, store, hook, consent sheet, central 403 handling)
- [ ] 07-04-PLAN.md — AI badge, disclaimer, Report suggestion sheet and capped report payload helper
- [ ] 07-05-PLAN.md — Delete account UI (Danger zone, password sheet, state cleanup, login notice)
- [ ] 07-06-PLAN.md — Backend hard delete DELETE /users/me (ordered transaction, ai_usage cleanup, DMMF completeness test)
- [ ] 07-07-PLAN.md — Backend requireAiConsent gate on AI routes + rate-limited POST /ai/reports
- [ ] 07-08-PLAN.md — Reviewer demo seed (idempotent, prod-guarded) + REVIEW-NOTES + NAME-CHECK docs
- [ ] 07-09-PLAN.md — Wire consent gate, badge, disclaimer, report into all AI modals and saved AI recipes
- [ ] 07-10-PLAN.md — Settings Privacy tab (AI consent switch, withdrawal, legal links)
- [ ] 07-11-PLAN.md — Backend consent endpoints GET/POST/DELETE /users/me/ai-consent + profile fields
- [ ] 07-12-PLAN.md — Phase gate: full suites, next build, legal page smoke, human browser pass
**UI hint**: yes

### Phase 8: Offline Sync Backend
**Goal**: The API is safe for flaky-network clients: retries never double-apply, quantity taps merge, sessions survive offline, and one call fetches everything to cache
**Depends on**: Nothing (independent of Phase 7; no Xcode needed)
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07
**Success Criteria** (what must be TRUE):
  1. Replaying the same mutating request with the same `Idempotency-Key` returns the original result and changes data exactly once
  2. Two queued quantity adjustments of a pantry item apply as summed deltas and never drop the quantity below 0
  3. A pantry or shopping row created with a client-generated id can be retried without creating duplicates
  4. A request from the Capacitor origin passes CORS, and an expired access token is silently renewed with a refresh token so the session survives time offline
  5. A single paged bootstrap call returns pantry (more than 50 rows), shopping list, recipes and meal plans, and a 401 no longer discards unsynced local work
  6. Finishing a shopping trip with an `occurredAt` and an older receipt date merges purchased items into the pantry in the same transaction
**Plans**: 11 plans
Plans:
- [x] 08-01-PLAN.md — Wave 1: additive migration (idempotency_keys, refresh_tokens), account-deletion coverage + DMMF fixtures, refresh/idempotency config, 1h access default
- [x] 08-02-PLAN.md — Wave 1: Capacitor origins + Idempotency-Key header in CORS; per-user pantry/sync limiters, refresh limiter
- [x] 08-03-PLAN.md — Wave 1: finish trip occurredAt, 14-day receipt window, pantry merge in the same transaction
- [x] 08-04-PLAN.md — Wave 1: frontend pantry pager (no 50-row cap) for list, export, analytics
- [x] 08-05-PLAN.md — Wave 2: generic Idempotency-Key middleware on pantry/shopping/mealplan/cook + daily cleanup cron
- [x] 08-06-PLAN.md — Wave 2: rotating hashed refresh tokens with 60 s grace, /auth/refresh, revoking logout, password-change revocation
- [x] 08-07-PLAN.md — Wave 2: client-generated ids for shopping items (pre-check under list lock)
- [x] 08-08-PLAN.md — Wave 2: GET /sync/bootstrap keyset-paged snapshot (pantry, recipes, meal plans, shopping list, serverTime)
- [x] 08-09-PLAN.md — Wave 3: POST /pantry/:id/adjust delta (Decimal, clamp, lock) + pantry client ids
- [x] 08-10-PLAN.md — Wave 3: frontend single-flight refresh; 401 clears only on definitive refresh failure
- [x] 08-11-PLAN.md — Wave 4: smoke check 15 + full quality gate and deploy-ordering note

### Phase 9: Offline Rules Engine
**Goal**: Users get useful "what can I cook" and substitution answers computed locally, with no network and no model
**Depends on**: Nothing (pure shared TypeScript over the v1.0 intelligence core; no Xcode needed)
**Requirements**: OFF-08
**Success Criteria** (what must be TRUE):
  1. With the network disabled, user sees their recipes ranked by how much of each is covered by the pantry, with expiring items boosted
  2. For a missing ingredient, user sees rules-based substitution suggestions (honoring diet/allergens) with no network call
  3. Ranking and substitutions give identical results online and offline for the same data
**Plans**: 8 plans
Plans:
- [ ] 09-01-PLAN.md — Engine types, unit registry port and diet filter port with shared parity fixtures
- [ ] 09-02-PLAN.md — Curated 150+ entry substitution table with zod schema and integrity test
- [ ] 09-03-PLAN.md — Staples mirror, pantry index and rankRecipes (quantity-aware coverage, expiry boost, missing penalty, filters)
- [ ] 09-04-PLAN.md — Substitution lookup (alias/token matching, ratio scaling, diet filter, in-pantry first)
- [ ] 09-05-PLAN.md — Server parity on rankCookFirst, 100 ms performance gate, determinism/no-network tests
- [ ] 09-06-PLAN.md — Barrel, boundary normalizers, view-model helpers and offline-first useCookFromPantry hook
- [ ] 09-07-PLAN.md — Recipe row, filter card, states and Substitute sheet components
- [ ] 09-08-PLAN.md — /recipes/cook page, nav title, entry points, human offline verification
**UI hint**: yes

### Phase 10: Capacitor iOS Shell
**Goal**: Kitcha runs as a real iPhone app built from the existing frontend, with native scanning, secure login storage and local expiry notifications
**Depends on**: Phase 8 (CORS/refresh tokens for the app origin)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Human gate**: User must install Xcode and accept its license (agents can scaffold `mobile/`, the static-export build and scripts first, but cannot build or run the iOS target until then). Native scanner and haptics need a real iPhone to confirm.
**Success Criteria** (what must be TRUE):
  1. User launches the app from the iOS Simulator (and later a real iPhone) and sees the real Kitcha UI with no server needed to render screens
  2. After login and an app restart the user is still signed in, and the session token is not in WebView localStorage
  3. User scans a barcode with the native scanner and can still enter it manually if the camera is unavailable
  4. User opts in to expiry notifications and receives a local notification for an item nearing expiry, even in airplane mode
  5. Key actions give haptic feedback, a shopping list can be shared via the native share sheet, and layouts respect safe areas and the keyboard
  6. One scripted command builds, installs and launches the app in the Simulator and an automated smoke E2E passes
**Plans**: TBD
**UI hint**: yes

### Phase 11: Offline Core
**Goal**: The installed app is fully usable with no signal: everything is readable from a local cache and every edit is queued and synced exactly once
**Depends on**: Phase 8 (idempotency, deltas, bootstrap), Phase 9 (rules engine), Phase 10 (native shell and SQLite)
**Requirements**: OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09
**Human gate**: Airplane-mode, app-kill and reboot behavior should be confirmed on a real iPhone (agents cover it with Simulator and automated tests).
**Success Criteria** (what must be TRUE):
  1. In airplane mode, user opens the app and sees pantry, shopping list, recipes and meal plans from the last sync
  2. Offline, user can add/edit/delete/check off shopping items, add pantry items, and change quantities and expiry, and everything syncs after reconnect with quantity taps merged as deltas
  3. Offline, user can scan a barcode: a known product comes from the local cache, an unknown one is saved with its code and resolved when back online
  4. Offline, user can view a recipe with servings scaling, mark meals in the plan, and queue "Cooked it" and "Finish trip", with clear messages if a conflict appears on reconnect
  5. User always sees connectivity and pending-changes status and can see, retry or discard failed queued changes
  6. Queued changes survive killing the app and rebooting the phone, are applied exactly once, and conflicts resolve last-write-wins per field with delete-wins
**Plans**: TBD
**UI hint**: yes

### Phase 12: Subscription
**Goal**: Users can subscribe to Kitcha Plus and paid features are enforced on the server while the core pantry stays free
**Depends on**: Phase 7 (store readiness), Phase 10 (native shell), Phase 8 (backend groundwork)
**Requirements**: SUB-01, SUB-02, SUB-03
**Human gate**: Apple Developer Program enrollment, App Store Connect subscription products and sandbox tester, and a RevenueCat account/keys are required (agents build and test the backend webhook and paywall code against mocks first).
**Success Criteria** (what must be TRUE):
  1. User can start a 7-day trial on an annual or monthly plan in the sandbox, and can restore purchases on a fresh install
  2. After purchase or cancellation, the backend entitlement updates from the RevenueCat webhook and paid-only actions (AI beyond the free quota, unlimited pantry, nutrition) succeed or are refused server-side accordingly
  3. A free user can still scan barcodes and get expiry alerts, and the paywall appears only when a gated action is tried and can be dismissed
**Plans**: TBD
**UI hint**: yes

### Phase 13: On-Device AI
**Goal**: Supported iPhones generate recipe suggestions on-device, and everything else falls back to the server transparently
**Depends on**: Phase 10 (native shell), Phase 7 (AI consent and labels), Phase 12 (gated AI quota for the fallback path)
**Requirements**: AI-01, AI-02, AI-03
**Human gate**: Needs an Apple Intelligence-capable iPhone (15 Pro or newer) with Apple Intelligence enabled for real verification; the Simulator is unreliable for Foundation Models.
**Success Criteria** (what must be TRUE):
  1. On a supported iPhone in airplane mode, user generates recipe suggestions from the pantry and receives schema-valid results
  2. On an unsupported device, for a long plan, or after an on-device failure, generation transparently runs on the server and the UI says where it ran (on-device or server)
  3. A recorded 30-prompt comparison of on-device versus server output exists and states whether a downloadable model is needed
**Plans**: TBD
**UI hint**: yes

### Phase 14: TestFlight & App Store Release
**Goal**: Kitcha is installed from TestFlight on a real iPhone and submitted to App Review
**Depends on**: Phases 7-13
**Requirements**: REL-01, REL-02
**Human gate**: Apple Developer enrollment, signing, real-iPhone install, screenshots and the final "Submit for Review" click are the user's; agents script the build/upload and prepare listing text, privacy labels and the privacy manifest.
**Success Criteria** (what must be TRUE):
  1. One scripted build uploads to TestFlight and the build installs and launches on a real iPhone
  2. The store listing is complete: name, subtitle, keywords, screenshots, privacy nutrition labels, privacy manifest and Open Food Facts attribution
  3. The app is submitted for App Review with the reviewer account and notes attached
**Plans**: TBD

## Progress

Phases execute in numeric order. Phases 7, 8 and 9 are independent and need no Xcode, so they can run first (or in parallel).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Secure Foundation & Railway Deploy | v1.0 | 6/6 | Complete | 2026-10-08 |
| 2. Reliable AI Suggestions | v1.0 | 8/8 | Complete | 2026-10-08 |
| 3. Mobile-First Shell | v1.0 | 13/14 | Complete | 2026-10-08 |
| 4. Persistent Shopping List | v1.0 | 11/12 | Complete | 2026-10-08 |
| 5. Pantry-Aware Intelligence | v1.0 | 12/13 | Complete | 2026-10-09 |
| 6. Capture Loops | v1.0 | 12/13 | Complete | 2026-10-09 |
| 7. Store Readiness | v2.0 | 0/0 | Not started | - |
| 8. Offline Sync Backend | v2.0 | 11/11 | Complete    | 2026-10-10 |
| 9. Offline Rules Engine | v2.0 | 0/8 | Planned | - |
| 10. Capacitor iOS Shell | v2.0 | 0/0 | Not started | - |
| 11. Offline Core | v2.0 | 0/0 | Not started | - |
| 12. Subscription | v2.0 | 0/0 | Not started | - |
| 13. On-Device AI | v2.0 | 0/0 | Not started | - |
| 14. TestFlight & App Store Release | v2.0 | 0/0 | Not started | - |
