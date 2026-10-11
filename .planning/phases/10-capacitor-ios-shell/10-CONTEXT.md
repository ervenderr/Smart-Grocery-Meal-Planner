# Phase 10: Capacitor iOS Shell - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning
**Mode:** Autonomous (decisions from research-v2/01 + 05; user confirmed: keep name "Kitcha", Xcode 26.6 installed, real iPhone connected)

<domain>
## Phase Boundary
SHELL-01..06: a real iPhone app in `mobile/` built from a static export of `frontend/`, with native barcode scan, secure token storage, local expiry notifications, haptics/share, and a scripted Simulator build + smoke E2E. Phases 7-9 are deployed (refresh tokens, CORS for capacitor://localhost, consent, delete account).
</domain>

<decisions>
## Implementation Decisions
- Capacitor 8 + Swift Package Manager (no CocoaPods). `mobile/` is its own npm package; `webDir` points at the Next static export (`frontend/out`). Add a documented build script (`npm run build:ios`) that exports the frontend with the production API URL baked in (env), syncs, and builds with xcodebuild for the Simulator.
- Next `output: 'export'` ONLY for the mobile build (env-switched, the Vercel web build must stay unchanged and working). Fix what the export needs (`images.unoptimized`, no server-only features, dynamic routes). Keep one codebase; platform checks via Capacitor.isNativePlatform().
- Never use `server.url` (remote mode). App must render its UI with no network.
- Bundle id placeholder `app.kitcha.mobile`, display name "Kitcha", iOS min deployment per Capacitor 8; the user sets the signing team in Xcode (free Apple ID is enough for running on their own iPhone). Document exact steps.
- Secure token storage (SHELL-02): Keychain-backed plugin (evaluate @aparajita/capacitor-secure-storage or equivalent maintained SPM-compatible plugin); the existing auth token + Phase 8 refresh token move behind a storage adapter (web keeps localStorage).
- Native barcode (SHELL-03): prefer `@capacitor/barcode-scanner` (ships Package.swift); keep the existing manual entry and web scanner as fallback; plug into the existing scan sheet via an adapter, keep the Phase 6 resolution flow.
- Local notifications (SHELL-04): `@capacitor/local-notifications`; schedule expiry reminders on-device from pantry data (e.g. morning-of and N days before, respecting existing notification preferences), opt-in permission flow with explanation, reschedule on pantry change; works in airplane mode.
- Haptics + share (SHELL-05): `@capacitor/haptics` on key actions (check item, quantity step, cooked it), `@capacitor/share` for the shopping list; safe-area insets, keyboard resize, status bar style, no rubber-band glitches.
- Testing (SHELL-06): scripted Simulator build/install/launch (xcodebuild + simctl; XcodeBuildMCP if installed), automated smoke E2E (Maestro or XCUITest or simctl+screenshots - spike Maestro on WKWebView first, fall back if taps fail) verifying: launch shows real UI offline, login against production API with a throwaway account, secure storage persists across relaunch, local notification scheduling. Camera/scan can't run in Simulator: inject a test code path and mark real-device check as human_needed.
- Real iPhone: provide run instructions; the connected phone check is human_needed (scanner, haptics, notification delivery).

### Claude's Discretion
Plugin choices (verify maintenance and SPM support), folder layout, test tool, UI touches. Respect rules: small files, immutability, validation at boundaries, no secrets in the bundle (only public API URL).
</decisions>

<code_context>
Research: .planning/research-v2/01-native-path.md (static export notes, CORS origin, gotchas) and 05-tooling-testing.md. Frontend uses Bearer token in localStorage, React Query, barcode-detector WASM scan sheet (components/scan, lib/scan), notifications module. CLAUDE.md claims Serwist but no service worker exists in tree.
</code_context>

<specifics>
Do NOT push or deploy; do not change the Vercel web build behavior. UI hint: yes (native feel).
</specifics>

<deferred>
- Offline cache/outbox (Phase 11), subscription (12), on-device AI (13), App Store submission (14).
</deferred>
