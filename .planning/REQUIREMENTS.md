# Requirements: Kitcha v2.0 — Kitcha for iPhone

**Defined:** 2026-10-10
**Core Value:** Someone standing in a kitchen or grocery aisle with a phone can quickly see what they have, what to cook, and what to buy — without wasting food or money. v2.0 adds: even with no signal.

Research: `.planning/research-v2/` (01 native path, 02 on-device AI, 03 offline sync, 04 monetization/App Store, 05 tooling/testing).

## v2.0 Requirements

### Store Readiness (STORE)
- [ ] **STORE-01**: User can permanently delete their account and all their data from within the app (hard delete, cascades, incl. AI usage rows); re-auth required
- [ ] **STORE-02**: User sees and must accept an explicit consent screen before any data is sent to a third-party AI provider, and can withdraw consent
- [ ] **STORE-03**: AI-generated recipes and plans are labeled as AI-generated, carry a health/nutrition disclaimer, and can be reported
- [ ] **STORE-04**: App links to hosted Privacy Policy, Terms of Use and Support pages
- [ ] **STORE-05**: Reviewer demo account and review notes exist; app name is cleared (App Store + trademark check) or replaced

### Backend Offline Groundwork (SYNC)
- [ ] **SYNC-01**: Mutating requests accept an `Idempotency-Key`; a replay returns the original result without double-applying
- [ ] **SYNC-02**: Pantry quantity can be adjusted by a delta (`POST /pantry/:id/adjust`), clamped at 0, so queued offline taps merge correctly
- [ ] **SYNC-03**: Clients can create pantry/shopping rows with a client-generated id (safe retries)
- [ ] **SYNC-04**: API accepts the Capacitor origin (CORS) and issues refresh tokens so a session survives offline periods and token expiry
- [ ] **SYNC-05**: Finish-shopping-trip accepts an `occurredAt` and a wider receipt-date window, and merges to pantry in the same transaction
- [ ] **SYNC-06**: A bootstrap endpoint returns everything the app needs to cache (pantry, shopping list, recipes, meal plans) in one paged call; pantry list is no longer capped at 50 rows
- [ ] **SYNC-07**: A 401 no longer wipes unsynced local work

### Native Shell (SHELL)
- [ ] **SHELL-01**: `mobile/` contains a Capacitor 8 iOS project built from a static export of the Next.js frontend, launching to the real app with no server dependency for the UI
- [ ] **SHELL-02**: Session token is stored in native secure storage, not WebView localStorage
- [ ] **SHELL-03**: User scans barcodes with the native scanner (VisionKit/ML Kit) with manual fallback preserved
- [ ] **SHELL-04**: User receives local notifications for items nearing expiry, scheduled on-device (work offline), with opt-in permission flow
- [ ] **SHELL-05**: App uses haptics for key actions and the native share sheet for shopping lists; safe-area and keyboard behavior feel native
- [ ] **SHELL-06**: App builds, installs and launches in the iOS Simulator via a scripted command, and an automated smoke E2E passes

### Offline Experience (OFF)
- [ ] **OFF-01**: User can open the app with no connection and see their pantry, shopping list, recipes and meal plans from the last sync
- [ ] **OFF-02**: User can add, edit, delete and check off shopping items offline; changes sync when back online
- [ ] **OFF-03**: User can add pantry items, change quantities and expiry dates offline; quantity changes merge as deltas
- [ ] **OFF-04**: User can scan a barcode offline; unknown products are saved with the code and resolved when online, previously looked-up products come from a local cache
- [ ] **OFF-05**: User sees clear connectivity and pending-changes status, and can see/retry/discard failed queued changes
- [ ] **OFF-06**: User can cook from a recipe offline (view, servings scaling); Cooked it and Finish trip queue and apply on reconnect with clear conflict messages
- [ ] **OFF-07**: User can view and mark meals in the meal plan offline
- [ ] **OFF-08**: User gets rules-based "what can I cook" recipe ranking from the pantry and ingredient substitutions with no network and no model
- [ ] **OFF-09**: Queued changes survive app kill and reboot, are applied exactly once, and conflicts follow last-write-wins per field with delete-wins

### Subscription (SUB)
- [ ] **SUB-01**: User can subscribe to Kitcha Plus (annual/monthly, 7-day trial) and restore purchases via StoreKit through RevenueCat
- [ ] **SUB-02**: Backend stores entitlements from RevenueCat webhooks and gates paid features (AI quota beyond free tier, unlimited pantry, nutrition) server-side
- [ ] **SUB-03**: Free tier keeps barcode scanning and expiry alerts; paywall appears only at gated actions and can be dismissed

### On-Device AI (AI)
- [ ] **AI-01**: On supported iPhones (Apple Intelligence), user can generate recipe suggestions from the pantry on-device with structured, schema-valid output and no network
- [ ] **AI-02**: Unsupported devices, long plans and failures fall back to the server AI with a clear indicator of where generation ran
- [ ] **AI-03**: A 30-prompt comparison against the server provider is recorded and decides whether a downloadable model is needed

### Release (REL)
- [ ] **REL-01**: App is uploaded to TestFlight from a scripted build and installs on a real iPhone
- [ ] **REL-02**: Store listing is complete (name, subtitle, keywords, screenshots, privacy labels, privacy manifest, Open Food Facts attribution) and the app is submitted for review

## Future Requirements (deferred)
- Downloadable on-device model (Qwen3 via llama.cpp/MLX) — only if AI-03 shows Foundation Models is insufficient
- Household sharing and multi-device real-time sync engine
- Offline AI meal-plan generation for full weeks
- Android app, iPad layout, Apple Watch / widgets
- URL recipe import

## Out of Scope
| Feature | Reason |
|---|---|
| Expo/React Native or SwiftUI rewrite | Capacitor reuses ~90% of code; rewrite costs 2–5 months |
| Remote-URL (server.url) WebView mode | Fails offline; App Review 4.2 risk |
| PowerSync/ElectricSQL/Replicache sync engine | Overkill for hundreds of rows; REST + outbox is enough |
| WebLLM in WKWebView | Memory kills on iOS |
| Sign in with Apple | Only required if third-party login is added |

## Traceability
| Requirement | Phase | Status |
|---|---|---|
| STORE-01 | Phase 7 | Pending |
| STORE-02 | Phase 7 | Pending |
| STORE-03 | Phase 7 | Pending |
| STORE-04 | Phase 7 | Pending |
| STORE-05 | Phase 7 | Pending |
| SYNC-01 | Phase 8 | Pending |
| SYNC-02 | Phase 8 | Pending |
| SYNC-03 | Phase 8 | Pending |
| SYNC-04 | Phase 8 | Pending |
| SYNC-05 | Phase 8 | Pending |
| SYNC-06 | Phase 8 | Pending |
| SYNC-07 | Phase 8 | Pending |
| OFF-08 | Phase 9 | Pending |
| SHELL-01 | Phase 10 | Pending |
| SHELL-02 | Phase 10 | Pending |
| SHELL-03 | Phase 10 | Pending |
| SHELL-04 | Phase 10 | Pending |
| SHELL-05 | Phase 10 | Pending |
| SHELL-06 | Phase 10 | Pending |
| OFF-01 | Phase 11 | Pending |
| OFF-02 | Phase 11 | Pending |
| OFF-03 | Phase 11 | Pending |
| OFF-04 | Phase 11 | Pending |
| OFF-05 | Phase 11 | Pending |
| OFF-06 | Phase 11 | Pending |
| OFF-07 | Phase 11 | Pending |
| OFF-09 | Phase 11 | Pending |
| SUB-01 | Phase 12 | Pending |
| SUB-02 | Phase 12 | Pending |
| SUB-03 | Phase 12 | Pending |
| AI-01 | Phase 13 | Pending |
| AI-02 | Phase 13 | Pending |
| AI-03 | Phase 13 | Pending |
| REL-01 | Phase 14 | Pending |
| REL-02 | Phase 14 | Pending |
