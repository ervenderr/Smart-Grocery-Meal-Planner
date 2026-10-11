# Phase 10: Capacitor iOS Shell - Research

**Researched:** 2026-10-11
**Domain:** Capacitor 8 iOS shell (SPM) around a Next.js 16.4 static export; Keychain, native barcode, local notifications, haptics/share, Simulator E2E
**Confidence:** HIGH on stack, export, build and SPM (all spiked locally); MEDIUM on Maestro-on-WKWebView and on deep-reload behavior (analyzed from source, not executed)

## Summary

A throwaway spike in the scratchpad (not in the repo) proved the core path. A copy of `frontend/` with `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true` plus one fix to `app/manifest.ts` builds cleanly (22 static routes). `@capacitor/{core,cli,ios}@8.5.3` plus all six target plugins and the Keychain plugin installed, `cap add ios` generated an SPM project (`ios/App/CapApp-SPM/Package.swift`, no Podfile), `xcodebuild` for `iPhone 17` / iOS 26.5 Simulator with `CODE_SIGNING_ALLOWED=NO` returned BUILD SUCCEEDED in about 95 s cold, and `simctl install/launch` rendered the Kitcha landing page from the bundle. First paint took about 4 s, probably because `public/top-view-tasty-food-devices.jpg` is 23.6 MB and `out/` is 27 MB. The status bar overlapped the header because no StatusBar/contentInset config was applied yet.

The real engineering risks are not the build. They are (1) the Capacitor iOS router serves `/index.html` (the ROOT page) for EVERY extension-less path, so any hard navigation or reload to `/login/` or `/pantry/` loads the landing page payload; the app must navigate client-side only and the shell route `/` must act as an auth router in native; (2) token storage is synchronous today (`getAccessToken()` in the axios interceptor) while Keychain is async, and the zustand `auth-storage` persist also writes `token` to localStorage, which violates SHELL-02 unless removed natively; (3) `@capacitor/local-notifications` 8.3.x `schedule()` auto-requests permission, so scheduling must be hard-gated behind an opt-in; (4) the UI-SPEC's transparent-WebView scan overlay is NOT needed because `@capacitor/barcode-scanner` presents its own full-screen scanner; (5) the E2E tool: Maestro is not installed, and `brew install maestro` resolves to an UNRELATED cask.

**Primary recommendation:** Build `mobile/` as its own npm package with exact-pinned Capacitor 8.5.3 and SPM plugins; add a `BUILD_TARGET=native` branch to `frontend/next.config.ts`; introduce an async-initialised in-memory `tokenStore` with Keychain write-through; drive Simulator E2E with a bash script (xcodebuild + simctl) plus a test-only in-app self-check surface, with Maestro as an optional spike layer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- Offline cache/outbox (Phase 11), subscription (12), on-device AI (13), App Store submission (14).

Also from CONTEXT specifics: do NOT push or deploy; do not change the Vercel web build behavior. The approved 10-UI-SPEC.md is the visual contract (treat as locked, with the corrections flagged in Pitfalls 4 and 7).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | `mobile/` Capacitor 8 iOS project from static export, no server dependency for UI | Spike proved export + `cap add ios` + xcodebuild + launch. Export blockers: only `app/manifest.ts` (needs `dynamic = 'force-static'`), `images.unoptimized`. Router/deep-reload pitfall (P1). |
| SHELL-02 | Session token in native secure storage, not localStorage | `@aparajita/capacitor-secure-storage@8.0.1` (Keychain, SPM `Package.swift` verified). Must also strip `token` from the zustand persist partialize natively (P2). Async init pattern. |
| SHELL-03 | Native barcode scan with manual fallback | `@capacitor/barcode-scanner@3.1.3` (SPM verified, Apple Vision on iOS, modal full-screen UI). Adapter in `lib/scan`; Simulator has no camera. |
| SHELL-04 | On-device expiry notifications, opt-in permission flow | `@capacitor/local-notifications@8.3.1`. Gate `schedule()` behind `checkPermissions()` (it auto-prompts since 8.3.0). 64 pending cap. Existing `lib/pantry/expiry.ts` for date math. |
| SHELL-05 | Haptics, share sheet, safe-area/keyboard feel | `@capacitor/haptics@8.0.2`, `@capacitor/share@8.0.3`, `@capacitor/status-bar@8.0.4`, `@capacitor/keyboard@8.0.6`, `@capacitor/splash-screen@8.0.2`; config keys in Code Examples. |
| SHELL-06 | Scripted Simulator build/install/launch + automated smoke E2E | Verified commands, simulator UDIDs, 95 s cold build. Tool decision table; Maestro not installed and brew name collision. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI rendering / routing | Browser/Client (WKWebView, bundled static assets) | CDN/Static (bundle in IPA) | No SSR; all routes prerendered and client-routed |
| Session token storage | Native (iOS Keychain via plugin) | Browser/Client (in-memory cache) | SHELL-02; sync reads served from memory, durable copy in Keychain |
| Barcode scan | Native (Apple Vision via plugin) | Browser/Client (WASM fallback, manual form) | Camera access and decoding are native; resolution flow stays in existing TS |
| Barcode lookup / product data | API/Backend (existing `/food` lookup) | — | Unchanged from Phase 6 |
| Expiry reminders | Native (UNUserNotificationCenter via plugin) | Browser/Client (scheduling logic from cached pantry data) | Must fire offline; JS computes schedule, OS delivers |
| Haptics / share | Native (plugins) | Browser/Client (wrapper no-ops on web) | Platform API |
| Safe area / keyboard / status bar | Native config (capacitor.config) + CSS | Browser/Client | WebView insets handled in CSS (`contentInset: 'never'`) |
| Auth / refresh | API/Backend (Phase 8, unchanged) | Browser/Client (axios interceptor) | Only the storage backend changes |
| CORS for `capacitor://localhost` | API/Backend | — | Already shipped in `NATIVE_APP_ORIGINS` (Phase 7), verify on device |
| Simulator build/E2E | Dev tooling (bash + xcodebuild + simctl) | — | No CI macOS runner required |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/core` | 8.5.3 | Runtime bridge | npm latest 2026-10-09 [VERIFIED: npm view] |
| `@capacitor/ios` | 8.5.3 | iOS runtime, `peerDependencies @capacitor/core ^8.5.0` | [VERIFIED: npm view] |
| `@capacitor/cli` (dev) | 8.5.3 | `cap init/add/sync`, SPM generation | [VERIFIED: npm view + spike] |
| `@capacitor/barcode-scanner` | 3.1.3 | Native scan (Apple Vision via OSBarcodeLib-iOS) | Official; `Package.swift` verified in tarball; peer `core >=8` [VERIFIED: npm pack + spike build] |
| `@capacitor/local-notifications` | 8.3.1 | Expiry reminders | Official; `Package.swift` verified [VERIFIED: npm pack + spike build] |
| `@capacitor/haptics` | 8.0.2 | Haptics | Official [VERIFIED: spike build] |
| `@capacitor/share` | 8.0.3 | Share sheet | Official [VERIFIED: spike build] |
| `@capacitor/status-bar` | 8.0.4 | Status bar style/overlay | Official [VERIFIED: spike build] |
| `@capacitor/splash-screen` | 8.0.2 | Launch screen control | Official [VERIFIED: spike build] |
| `@capacitor/keyboard` | 8.0.6 | Resize mode, show/hide events | Official [VERIFIED: spike build] |
| `@capacitor/app` | 8.1.2 | `openSettings`, resume events | Official [VERIFIED: spike build] |
| `@aparajita/capacitor-secure-storage` | 8.0.1 | Keychain key/value (keychain-swift 21 dependency) | Capacitor 8 line, `Package.swift` verified, published 2026-09-23, 3rd-party but maintained [VERIFIED: npm pack + spike build] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/device` | 8.0.3 | `Device.getInfo().isVirtual` to detect Simulator (no camera) | Route scan to manual on Simulator; plan must `npm view` and install in `mobile/` AND `frontend/` as needed [VERIFIED: npm view version only; not spiked] |
| `@capacitor/assets` (dev) | 3.0.5 | Generate icon/splash from a 1024 source | Optional, offline asset generation [VERIFIED: npm view only] |

Where to install JS packages: plugin JS APIs (`import { Haptics } from '@capacitor/haptics'`) are imported by `frontend/` code, while `cap sync` discovers native plugins from `mobile/node_modules`. Recommended: install `@capacitor/core` and every plugin in BOTH `frontend/package.json` (for TS imports and vitest) and `mobile/package.json` (for native SPM resolution) with identical exact versions; or use a single `frontend` install and point `mobile` `capacitor.config` at it. The simpler, verified-by-spike form is `mobile/` owning the native packages. See Open Question 1 and Pitfall 8 (Package.swift refers to `../../../node_modules/...`, so `mobile/node_modules` MUST exist before xcodebuild).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@aparajita/capacitor-secure-storage` | `capacitor-secure-storage-plugin` 0.13.0 (martinkasa, also has Package.swift, published 2026-01-10) | Less recently maintained, 0.x; use only if aparajita fails on device |
| `@aparajita/capacitor-secure-storage` | `@capacitor/preferences` 8.0.1 | UserDefaults, NOT Keychain; fails SHELL-02 intent. Reject. |
| `@capacitor/barcode-scanner` | `@capacitor-mlkit/barcode-scanning` 8.2.1 | CocoaPods only (no Package.swift), violates locked SPM decision. Reject. |
| Maestro | XCUITest / simctl + screenshots | See Validation Architecture |

**Installation (mobile/):**
```bash
cd mobile
npm init -y   # then set "private": true, "name": "kitcha-mobile"
npm i --save-exact @capacitor/core@8.5.3 @capacitor/ios@8.5.3 \
  @capacitor/barcode-scanner@3.1.3 @capacitor/local-notifications@8.3.1 \
  @capacitor/haptics@8.0.2 @capacitor/share@8.0.3 @capacitor/status-bar@8.0.4 \
  @capacitor/splash-screen@8.0.2 @capacitor/keyboard@8.0.6 @capacitor/app@8.1.2 \
  @aparajita/capacitor-secure-storage@8.0.1
npm i -D --save-exact @capacitor/cli@8.5.3
npx cap add ios        # SPM is the default; do not pass --packagemanager
```
**Version verification:** all versions above were returned by `npm view` on 2026-10-11 and all plugins installed together and compiled in the spike. `npm view <pkg> scripts.postinstall` was not run for the spike packages; the planner should run it in the install task (npm audit on the spike reported advisories, details not inspected).

## Package Legitimacy Audit

slopcheck was NOT run (not installed; no network install attempted per "install nothing global"). Per protocol every package is therefore `[ASSUMED]` for legitimacy and the plan must gate the first `npm i` behind a `checkpoint:human-verify`. Mitigating evidence gathered: all `@capacitor/*` packages are published from `github.com/ionic-team/*` repos (npm `repository.url` verified), have recent `time.modified`, and were resolved by `npm view` and `npm pack`; the Capacitor plugin docs name them. `@aparajita/capacitor-secure-storage` repo: `github.com/aparajita/capacitor-secure-storage`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @capacitor/core, cli, ios | npm | years | high | github.com/ionic-team/capacitor | not run | [ASSUMED] gate on human-verify (low real risk) |
| @capacitor/{barcode-scanner,local-notifications,haptics,share,status-bar,splash-screen,keyboard,app} | npm | years | high | github.com/ionic-team/* | not run | [ASSUMED] gate on human-verify (low real risk) |
| @aparajita/capacitor-secure-storage | npm | multi-year (Capacitor 8 line) | not checked | github.com/aparajita/capacitor-secure-storage | not run | [ASSUMED] human-verify; transitive SPM dep `evgenyneu/keychain-swift` from GitHub |
| @capacitor/device, @capacitor/assets | npm | years | not checked | github.com/ionic-team | not run | [ASSUMED] |

**Packages removed due to [SLOP]:** none (tool unavailable). **Packages flagged [SUS]:** none known.
Non-npm supply chain note: SPM resolves `capacitor-swift-pm` (exact 8.5.3), `OSBarcodeLib-iOS` (>=3.0.0) and `keychain-swift` (>=21.0.0) from GitHub on first build. Commit `Package.resolved` (see Pitfall 9).

## Architecture Patterns

### System Architecture Diagram

```
 repo root
 ├─ frontend/ (Next 16.4)            ├─ mobile/ (npm pkg, Capacitor 8)
 │   BUILD_TARGET=native             │   capacitor.config.ts  webDir=../frontend/out
 │   next build -> out/  ───────────▶│   cap sync ios  (copies out/ -> ios/App/App/public,
 │   (NEXT_PUBLIC_API_URL baked)     │                 regenerates CapApp-SPM/Package.swift)
 │                                   │   ios/App (Xcode project, SPM)
 └─ scripts: npm run build:ios       └─ scripts/ (build, simulator, e2e)

 RUNTIME (iPhone / Simulator)
 launch ─▶ Splash (manual hide) ─▶ WKWebView  capacitor://localhost  (bundled out/)
            │                         │
            │             first paint └─▶ `/` route in native = auth router
            │                              tokenStore.init() (Keychain -> memory) ─▶ router.replace('/dashboard' | '/login')
            ▼
   React app (client-only navigation) ── axios ──HTTPS──▶ Railway API (CORS allows capacitor://localhost)
      │  tokenStore (sync read from memory, async write-through)───▶ Keychain plugin
      │  scanAdapter ─▶ BarcodeScanner.scanBarcode() (full-screen native UI) ─▶ existing resolve-barcode flow
      │                 └─ fallback: WASM scanner / manual form (web, Simulator, denied)
      │  reminderScheduler(pantry items, prefs) ─▶ LocalNotifications.cancel+schedule (<=60)
      │                 notification tap ─▶ localNotificationActionPerformed ─▶ router.push('/pantry/?filter=expiring')
      └─ haptic(kind) / share(list) wrappers ─▶ Haptics / Share (no-op or Web Share on web)
```

### Recommended Project Structure
```
mobile/
├── package.json            # exact-pinned Capacitor deps, scripts: build:ios, sim:run, e2e:ios
├── package-lock.json       # commit; use npm ci
├── capacitor.config.ts     # appId app.kitcha.mobile, appName Kitcha, webDir ../frontend/out, plugin config
├── scripts/
│   ├── build-ios.sh        # export frontend, cap sync, xcodebuild (Simulator, no signing)
│   ├── sim-run.sh          # boot device, install, launch
│   └── e2e-smoke.sh        # simctl-driven smoke (+ optional maestro flows)
├── e2e/                    # maestro/*.yaml (optional spike result)
├── README.md               # exact signing steps, iPhone run, human_needed checklist
└── ios/App/...             # generated by cap add ios; commit it (see Pitfall 9)
frontend/
├── next.config.ts          # BUILD_TARGET=native branch
├── lib/platform/           # isNative(), usePlatform(), native.ts (dynamic import of plugins)
├── lib/api/token-storage.ts  # becomes sync facade over lib/auth/token-store (init + write-through)
├── lib/scan/scan-adapter.ts  # native vs web engine
├── lib/native/haptics.ts, share.ts, reminders/*.ts
```

### Pattern 1: Env-switched static export (web build untouched)
```ts
// frontend/next.config.ts  (shape; keep existing release-check and API-URL guard)
const native = process.env.BUILD_TARGET === 'native';
return native
  ? { output: 'export', trailingSlash: true, images: { unoptimized: true } }
  : {};
```
Plus `export const dynamic = 'force-static';` in `app/manifest.ts` (harmless on web, required for export; verified failure message in spike) [VERIFIED: local next build]. `distDir` stays `.next`; export output is `frontend/out` [VERIFIED].

### Pattern 2: Async-initialised token store with synchronous reads
The axios request interceptor and `session-refresh` use sync `getAccessToken()/getRefreshToken()`. Keep that API: `token-storage.ts` reads from an in-memory object; native `initTokenStore()` (awaited once in `Providers`/app bootstrap BEFORE `ProtectedRoute` decides) hydrates memory from Keychain; `setTokens`/`clearTokens` update memory synchronously and write to Keychain fire-and-forget with error logging, returning a promise that tests and logout await. Web branch keeps localStorage. Immutable updates (replace the object, never mutate). [ASSUMED design; derived from reading `lib/api/token-storage.ts`, `client.ts`, `auth-store.ts`]

### Pattern 3: Native-only code via dynamic import
Import plugins lazily inside `if (isNative())` so the web bundle does not load them and vitest (node env) can mock them. `isNative()` = `Capacitor.isNativePlatform()` from `@capacitor/core` (pure JS, safe on web).

### Anti-Patterns to Avoid
- `window.location.href = ...` / `window.location.reload()` in native (see P1). Use a router navigate.
- `server.url` anywhere in `capacitor.config` (locked).
- Calling `LocalNotifications.schedule` before an explicit opt-in (P3).
- Adding `railway.json`/web-only config to the native build; do not touch Vercel behavior.
- `npx cap sync` run concurrently by two agents in the same dir.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keychain access | Custom Swift plugin | `@aparajita/capacitor-secure-storage` | Accessibility classes, JSON typing, error types |
| Barcode decode on native | AVFoundation/VisionKit plugin | `@capacitor/barcode-scanner` | Ships UI, torch, cancel, permission prompt |
| Notification scheduling | Background tasks | `LocalNotifications.schedule({at})` | OS delivers offline; no background execution needed |
| Share text | Custom UIActivityViewController bridge | `@capacitor/share` | Standard |
| Haptic engine | Vibration API | `@capacitor/haptics` | iOS Safari/WKWebView has no `navigator.vibrate` |
| Static export routing shim | Custom Capacitor Router subclass | Client-side nav + `/` auth router | Avoid editing generated native code (`cap sync` safe) |
| Date math for expiry | New date utils | existing `frontend/lib/pantry/expiry.ts` (+ `expiry-tz.test.ts` timezone tests) | Already tested for TZ issues |

**Key insight:** every native capability here has an official or maintained plugin; the custom work is the TypeScript adapters and the state-machine glue, which are unit-testable without a device.

## Runtime State Inventory

Not a rename/refactor phase, but one migration exists: existing web sessions are irrelevant (new app), however **iOS Keychain items survive app deletion** (documented by the plugin), so a reinstall can resurrect a stale refresh token.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None for the shell. Keychain tokens persist across app reinstall on device | Add a first-launch marker (UserDefaults-style via `localStorage` flag in WebView, which IS wiped on reinstall) and clear Keychain tokens when the marker is absent |
| Live service config | Railway `CORS_ORIGIN`: native origins are a code constant (`NATIVE_APP_ORIGINS` in `backend/src/config/cors.config.ts`), already shipped | None; verify real Origin on device |
| OS-registered state | Pending local notifications are OS state, keyed by integer id | Own an id range; `cancel` own ids before reschedule; on logout `cancelAll` |
| Secrets/env vars | `NEXT_PUBLIC_API_URL` baked at build (public). No secrets in bundle | Build script must fail if unset (existing next.config guard does, only in `PHASE_PRODUCTION_BUILD`; native build uses that phase too) |
| Build artifacts | `frontend/out/`, `mobile/ios/App/App/public/`, DerivedData | gitignore `out`, `ios/App/App/public`, `ios/App/build`, `DerivedData`; keep out of git |

## Common Pitfalls

### Pitfall 1: Capacitor iOS serves root `index.html` for every extension-less URL
**What goes wrong:** `CapacitorRouter.route(for:)` returns `basePath + "/index.html"` whenever the path has no file extension (source read from `@capacitor/ios@8.5.3` `Router.swift`). A hard load or reload of `capacitor://localhost/login/` therefore loads the ROOT page document with pathname `/login/`. Next's client then hydrates a payload that does not match the URL (landing page flash, hydration error, or wrong page).
**Why it happens:** Capacitor assumes SPA routing; Next export emits `login/index.html` but the handler never looks for it.
**How to avoid:** (a) In native, never do full navigations: replace `window.location.href = '/login'` in `lib/api/client.ts` (session expired) and `window.location.href='/'` / `reload()` in `components/common/error-boundary.tsx` with soft navigation (inject a navigate callback, or `router.replace`) guarded by `isNative()`. (b) Make `/` in the native build an auth router: wait for `tokenStore.init()` then `router.replace` to `/dashboard/` or `/login/`; do not render the marketing landing page (also avoids the 23 MB hero JPEG). (c) Spike-verify with a deliberate reload in the Simulator and record the result. [CITED: @capacitor/ios 8.5.3 Router.swift (local tarball)] — behavior at runtime MEDIUM until the spike run.
**Warning signs:** landing page appears after "session expired"; blank screen after `reload()`.

### Pitfall 2: SHELL-02 leak through zustand persist
`lib/stores/auth-store.ts` persists `{user, token, isAuthenticated}` under `auth-storage` in localStorage, so the access token still lands in WebView localStorage even if `token-storage.ts` moves to Keychain. **Fix:** in native, `partialize` must omit `token` (and ideally keep `user` only), and `isAuthenticated`/`token` must be re-derived from the hydrated token store at boot; `ProtectedRoute` currently requires `token` truthy. Provide a native persist `storage` (or skip persist) and assert in a unit test that no key in the fake localStorage contains the token string after `setAuth`. Also scrub any pre-existing `auth-token`, `refresh-token` and `auth-storage` entries on native boot.

### Pitfall 3: `LocalNotifications.schedule()` prompts for permission by itself
Since 8.3.0 it requests permission if not granted (README). That would show the iOS prompt without the in-app explainer (UI-SPEC and Apple 5.1.2(i) violation). **Fix:** `reminderScheduler` calls `checkPermissions()` first and returns early unless `display === 'granted'`; only the explainer's "Turn on reminders" button calls `requestPermissions()`. Unit-test with a mocked plugin: schedule is never called when state is `prompt`/`denied`.

### Pitfall 4: Native scanner does not need a transparent WebView
`@capacitor/barcode-scanner` exposes only `scanBarcode(options)` (returns `{ScanResult, format}`), presenting its own full-screen camera UI. UI-SPEC section "Native Scan Sheet" describes an optional transparent-DOM overlay "if the plugin requires" it; it does not. Skip `html.scanning` entirely. Cancel returns a rejection or empty result (behavior not documented; verify on device and normalize: treat both as silent cancel). Options available: `hint` (use `EAN_13`/`ALL`; Apple Vision does not distinguish UPC_A from EAN_13), `scanInstructions`, `scanButton`, `cameraDirection`, `scanOrientation`, accessibility labels. Simulator has no camera: use `Device.getInfo().isVirtual` to route to the manual state.

### Pitfall 5: Keychain data outlives uninstall and has web fallback to localStorage
See Runtime State Inventory. Also the plugin's web implementation stores unencrypted in localStorage: the adapter must pick the plugin ONLY when `isNative()`, never on web.

### Pitfall 6: Static export + `useSearchParams`
`settings/page.tsx`, `recipes/page.tsx` and `components/auth/deleted-account-notice.tsx` use `useSearchParams`. The spike export succeeded (22/22 pages), so Suspense boundaries are evidently already adequate. The reminder deep link `/pantry/?filter=expiring` needs the pantry page to read the param inside a Suspense boundary; verify with `next build` after adding.

### Pitfall 7: UI-SPEC items that conflict with verified facts
- UI-SPEC says "`ios.scrollEnabled: false`" and `contentInset: 'never'`: both are real iOS config keys [CITED: capacitorjs.com/docs/config, not re-fetched this session; MEDIUM]; confirm in the generated config types at plan time.
- `@capacitor/keyboard` `resize: 'native'` and `resizeOnFullScreen` are documented keys; `Keyboard.setAccessoryBarVisible` exists in the plugin (verify in its README at plan time).
- UI-SPEC says reminders check the "existing notification preferences"; no `lib/notifications` module beyond `use-notification-stats.ts` exists, so planner must locate the preference source (`lib/api/preferences.ts`, `lib/hooks/use-preferences.ts`).

### Pitfall 8: SPM paths resolve into `mobile/node_modules`
`CapApp-SPM/Package.swift` contains `.package(path: "../../../node_modules/@capacitor/…")` (verified). `npm ci` in `mobile/` must precede `xcodebuild`, and `Package.swift` is auto-generated ("DO NOT MODIFY"): never hand-edit it.

### Pitfall 9: Generated native project and caching
First xcodebuild needs network to clone `capacitor-swift-pm`, `OSBarcodeLib-iOS`, `keychain-swift` (cold build about 95 s). Commit `ios/App/App.xcodeproj` and `Package.resolved` for reproducibility; gitignore `ios/App/App/public` and build output. Use `-derivedDataPath` inside `mobile/build/` (gitignored) for parallel safety. Xcode shows signing errors for device builds only; Simulator builds use `CODE_SIGNING_ALLOWED=NO` [VERIFIED].

### Pitfall 10: Bundle bloat and slow first paint
`frontend/public/top-view-tasty-food-devices.jpg` is 23.6 MB (only used by `app/page.tsx`). It ships in the IPA and in the spike the first paint took about 4 s. The native `/` route must not reference it; exclude it from the native export (copy step deleting it from `out/`, or move to a web-only route). Record `du -sh out` as a verification gate (target under about 10 MB).

### Pitfall 11: Maestro name collision
`brew info maestro` returns an unrelated cask "Maestro: AI agent command center" (runmaestro.ai). The mobile.dev tool installs via `curl -fsSL "https://get.maestro.mobile.dev" | bash` or its own tap; docs say it needs Java (OpenJDK 17.0.18 present). Never run `brew install maestro` blindly. [VERIFIED: brew info; install path CITED from research-v2/05, not re-verified]

### Pitfall 12: Status bar overlap
Verified in spike screenshot: without StatusBar overlay config and `pt-safe` on the native header, the clock overlaps the logo. Apply `contentInset: 'never'` + `viewport-fit=cover` (already set) + StatusBar overlay + CSS insets together, then screenshot-verify.

## Code Examples

### capacitor.config.ts
```ts
// Source: capacitorjs.com/docs/config (shape; confirm key names at plan time) [MEDIUM]
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.kitcha.mobile',
  appName: 'Kitcha',
  webDir: '../frontend/out',
  backgroundColor: '#f9fafb',
  ios: { contentInset: 'never', scrollEnabled: false, backgroundColor: '#f9fafb' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#ffffff', launchFadeOutDuration: 200 },
    Keyboard: { resize: 'native', resizeOnFullScreen: true, style: 'light' },
    StatusBar: { style: 'LIGHT', overlaysWebContent: true },
  },
  // NO server.url
};
export default config;
```
Caveat: Capacitor `StatusBar.Style.Light` means light BACKGROUND (dark text), matching UI-SPEC wording; verify visually.

### Verified Simulator build/run (cold 95 s)
```bash
cd mobile/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath ../../build CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "iPhone 17" || true        # use UDID if name ambiguous
xcrun simctl bootstatus "iPhone 17" -b
xcrun simctl install "iPhone 17" ../../build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "iPhone 17" app.kitcha.mobile
xcrun simctl io "iPhone 17" screenshot out.png
xcrun simctl terminate "iPhone 17" app.kitcha.mobile
```
[VERIFIED: executed in spike; the app printed `app.kitcha.mobile: <pid>`]

### Notification scheduling shape
```ts
// Source: @capacitor/local-notifications 8.3.1 README (schedule/getPending/cancel) [CITED]
const perm = await LocalNotifications.checkPermissions();
if (perm.display !== 'granted') return { scheduled: 0 };           // never auto-prompt (P3)
const pending = await LocalNotifications.getPending();
await LocalNotifications.cancel({ notifications: pending.notifications.filter(isOurs) });
await LocalNotifications.schedule({
  notifications: plan.slice(0, 60).map((n) => ({
    id: n.id, title: 'Kitcha', body: n.body,
    schedule: { at: n.fireAt, allowWhileIdle: false },
    extra: { route: '/pantry/?filter=expiring' },
  })),
});
// tap: LocalNotifications.addListener('localNotificationActionPerformed', e => navigate(e.notification.extra.route))
```
Pure function `buildReminderPlan(items, prefs, now) -> {id, fireAt, body}[]` holds all grouping/truncation/60-cap logic and is the main vitest target.

### Keychain adapter
```ts
// Source: plugin definitions.d.ts (get/set/remove/setKeyPrefix, KeychainAccess) [VERIFIED local]
await SecureStorage.setKeyPrefix('kitcha_');   // blank prefix throws by design
await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
await SecureStorage.set('access', token);       // convertDate arg false for strings
const v = await SecureStorage.get('access', false);
```
Use `whenUnlockedThisDeviceOnly` so tokens do not migrate via backups (confirm enum behavior at implementation). Never enable iCloud sync.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CocoaPods Podfile | SPM default in Capacitor 8 | Dec 2025 | `ios/App/CapApp-SPM`, plugin paths to node_modules |
| `@capacitor-community/barcode-scanner` | `@capacitor/barcode-scanner` (OutSystems libs) | archived 2024-10 | Use official one |
| `schedule()` silent if unpermitted | `schedule()` requests permission (8.3.0) | 2026 | Gate manually |
| `railway.json` | n/a here | — | not relevant to this phase |

**Deprecated/outdated:** `@capacitor-mlkit/barcode-scanning` for this phase (CocoaPods-only). CLAUDE.md "Serwist" claim: no service worker exists in tree (per CONTEXT); do not add one to the native build.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Packages are legitimate (slopcheck not run) | Package Legitimacy Audit | Low; official ionic-team repos. Gate with human-verify |
| A2 | `ios.contentInset`, `ios.scrollEnabled`, Keyboard/StatusBar/SplashScreen config key names | Code Examples | Wrong key silently ignored; check against `@capacitor/cli` types after install |
| A3 | Hard reload in WKWebView loads root document (from source analysis, not run) | Pitfall 1 | If Next handles it gracefully, the soft-nav constraint is merely defensive; low cost |
| A4 | Barcode cancel behavior (reject vs empty string) | Pitfall 4 | Spurious error toast on cancel; normalize both |
| A5 | Maestro can tap WKWebView content via accessibility tree | Validation | Fallback path defined (simctl + in-app self-check) |
| A6 | `whenUnlockedThisDeviceOnly` is exposed as enum value 1 and honored | Code Examples | Falls back to default `whenUnlocked` |
| A7 | Token-store async design fits `ProtectedRoute` 100 ms hydration timer | Pattern 2 | Race shows /login flash; must await init before the timer logic |
| A8 | `Device.isVirtual` true on Simulator | Pitfall 4 | Scan button opens native UI and errors; catch and route to manual |

## Open Questions (RESOLVED)

1. **Single vs dual install of Capacitor JS packages**
   - Known: `cap sync` reads plugins from the directory holding `capacitor.config` (spike: `mobile/node_modules`). Frontend TS imports need the JS packages resolvable from `frontend/`.
   - Unclear: whether to duplicate pins in `frontend/package.json`.
   - Recommendation: duplicate exact pins (only `core` plus the plugin JS) in `frontend/`; add a vitest/CI check that versions match. Alternative: `frontend` dynamic imports resolved via path alias to `mobile/node_modules` (rejected: fragile).
   - RESOLVED: duplicate exact pins; parity enforced by verify-deps.mjs --parity (plan 10-01).
2. **Test account for E2E login against production**: need throwaway account creation (signup) done by the script, and deletion at the end via the existing delete-account endpoint; confirm rate limits.
   - RESOLVED: script creates and deletes the account (plan 10-10).
3. **Does the real device need extra CORS?** `capacitor://localhost` already allowed (Phase 7); verify with a device login.
   - RESOLVED: human_needed device login check (plan 10-10, README).
4. **Maestro spike outcome** unknown until installed; decide at execution (see Validation).
   - RESOLVED: Maestro not installed; simctl + in-app self-check used, spike skipped (plan 10-10).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Xcode | build | yes | 26.6 (17F113) | — |
| iOS Simulator runtime | E2E | yes | iOS 26.5 only (18.1 and 26.2 listed unavailable) | — |
| Simulator devices | E2E | yes | iPhone 17 `6CD8E561-7D3D-4FCC-9C2F-45A386608013`, 17 Pro `1E08FC1F-BFF6-40C2-960B-BEBC8674ABAA`, 17e, Air, 17 Pro Max, iPads | Select by name, fall back to first available iPhone via `simctl list -j` |
| Real iPhone | human_needed | yes | "iPhone (26.6)" `00008110-001914C02146401E` connected; "ervenderr" device also listed; "tls123" offline | — |
| Node / npm | build | yes | 24.9.0 (Capacitor 8 needs 22+) | — |
| Java | Maestro | yes | OpenJDK 17.0.18 | — |
| Maestro (mobile.dev) | optional E2E | NO | — | simctl script + in-app self-check |
| XcodeBuildMCP / MobileBuildMCP | optional | NO | — | plain xcodebuild/simctl (verified working) |
| idb, xcbeautify | optional | NO | — | not needed |
| CocoaPods | — | not needed (SPM) | — | — |
| Network (GitHub for SPM, Railway API) | first build, login E2E | yes during research | — | Offline builds need warmed SPM cache |
| slopcheck | legitimacy | NO | — | human-verify checkpoint |

**Missing with no fallback:** none. **Missing with fallback:** Maestro, MCP builders.

Note: dev Mac has only an iOS 26.5 runtime; scripts must not hard-code another version. The spike booted/shut down iPhone 17; it is currently Shutdown.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.3 (frontend; `environment: 'node'`, include `lib/**/*.test.ts`) |
| Config file | `frontend/vitest.config.ts` (alias `@` -> frontend root) |
| Quick run command | `cd frontend && npx vitest run lib/<area>` |
| Full suite command | `cd frontend && npm test` (plus `npm run type-check`, `npm run lint`) |
| Native smoke | `mobile/scripts/e2e-smoke.sh` (bash + simctl), optional Maestro flows |

Node-environment vitest means all native-facing code must be written as pure modules with injected plugin objects (dependency injection) so they run without a DOM. No jsdom/React testing library installed; do not add one: keep logic in `lib/**` pure functions and hooks thin.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | `next build` with `BUILD_TARGET=native` exports `out/index.html` + all routes; web build unchanged | build smoke | `cd frontend && BUILD_TARGET=native NEXT_PUBLIC_API_URL=https://x.example next build && test -f out/login/index.html` and `npm run build` still passes without the var | Wave 0 (script) |
| SHELL-01 | next.config returns `{}` unless native | unit | `npx vitest run lib/platform/next-config.test.ts` (extract config builder to `lib/build/native-config.ts`) | Wave 0 |
| SHELL-01 | Bundle size under budget, no `server.url` in capacitor config | script assert | `du`/grep in `mobile/scripts/verify-bundle.sh` | Wave 0 |
| SHELL-01 | App launches offline to real UI in Simulator | simctl smoke | `mobile/scripts/e2e-smoke.sh` (launch, screenshot, assert non-blank via file size/hash or in-app marker) | Wave 0 |
| SHELL-02 | tokenStore: init hydrates, set/clear write-through, sync reads, no localStorage writes on native | unit | `npx vitest run lib/auth/token-store.test.ts` | Wave 0 |
| SHELL-02 | zustand native partialize excludes token | unit | `npx vitest run lib/stores/auth-store-native.test.ts` | Wave 0 |
| SHELL-02 | Keychain value survives app relaunch | simctl smoke | e2e script: login, `terminate`, `launch`, assert authenticated marker | Wave 0 |
| SHELL-03 | scan adapter picks native on device, manual on virtual/denied/error, normalizes cancel | unit | `npx vitest run lib/scan/scan-adapter.test.ts` | Wave 0 |
| SHELL-03 | existing resolve flow untouched | unit | existing `lib/scan/*.test.ts` | exists |
| SHELL-03 | real scan | manual | human_needed on iPhone | n/a |
| SHELL-04 | `buildReminderPlan` grouping, truncation to 3 names + "and N more", 60 cap, past-time skip, timezone | unit | `npx vitest run lib/reminders/plan.test.ts` | Wave 0 |
| SHELL-04 | scheduler never calls schedule when permission not granted; cancel-before-schedule; id range | unit (mock plugin) | `npx vitest run lib/reminders/scheduler.test.ts` | Wave 0 |
| SHELL-04 | scheduling works offline in Simulator | simctl smoke | e2e: enable via test hook, `LocalNotifications.getPending` count reported to in-app marker or via `simctl` log; grant with `xcrun simctl privacy <udid> grant notifications app.kitcha.mobile` if supported on 26.5 (verify) | Wave 0 |
| SHELL-04 | delivery on device | manual | human_needed | n/a |
| SHELL-05 | haptic wrapper: no-op on web, throttle 80 ms, settings off, kind mapping | unit | `npx vitest run lib/native/haptics.test.ts` | Wave 0 |
| SHELL-05 | share text builder (grouped, unchecked only) and cancel handling | unit | `npx vitest run lib/native/share.test.ts` | Wave 0 |
| SHELL-05 | safe-area/keyboard visual | simctl screenshot + human_needed (Dynamic Island, keyboard) | e2e screenshot compare by eye | Wave 0 |
| SHELL-06 | scripted build/install/launch exits 0 and prints bundle id/pid | script | `cd mobile && npm run build:ios && npm run sim:run` | Wave 0 |
| SHELL-06 | smoke E2E passes | script | `cd mobile && npm run e2e:ios` | Wave 0 |

### E2E tool decision (SHELL-06)
1. **Primary (guaranteed):** bash + `simctl`: build, boot, install, launch, screenshot, terminate/relaunch, plus an in-app **E2E self-check surface** compiled only when `NEXT_PUBLIC_E2E=1` (UI-SPEC allows it): a hidden route `/e2e/` (or launch-arg-triggered) that runs: isNative, tokenStore round trip via Keychain, notification permission+schedule+getPending count, and writes results to `document.title`/visible text AND `console.log` lines. Read results by `xcrun simctl spawn <udid> log stream --predicate 'process == "App"'` or by screenshot OCR-free marker (large text plus pixel check). This avoids any WKWebView tap problem.
2. **Optional spike:** Maestro (mobile.dev) for login-form taps; plan a time-boxed task: install via official script (human-verify), run one flow tapping `login` input by text. If taps fail, drop it and keep (1).
3. **Rejected for this phase:** XCUITest (generated project is replaced by `cap add`/`sync`; practitioner reports of taps not firing React handlers) and Appium (heavy).
The login-against-production step needs input into WKWebView text fields: either Maestro, or a launch-arg/E2E-route programmatic login that calls the same login API with a throwaway account's credentials from env (never committed), then verifies Keychain via relaunch. Recommend the programmatic route as the guaranteed path.

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run <touched area>` and `npm run type-check`
- **Per wave merge:** `cd frontend && npm test && npm run lint && npm run type-check`; web build `npm run build` (confirms Vercel path unchanged)
- **Phase gate:** full vitest, native export build, `npm run build:ios`, `npm run e2e:ios` green; human_needed list recorded (scanner, haptics feel, notification delivery, Dynamic Island, keyboard on the connected iPhone)

### Wave 0 Gaps
- [ ] `frontend/lib/auth/token-store.ts` + test (pure, injected storage)
- [ ] `frontend/lib/platform/*` (`isNative`, injected plugin loader) + tests
- [ ] `frontend/lib/scan/scan-adapter.ts` + test
- [ ] `frontend/lib/reminders/{plan,scheduler}.ts` + tests
- [ ] `frontend/lib/native/{haptics,share}.ts` + tests
- [ ] `mobile/` package, scripts and README; `.gitignore` entries
- [ ] No new test framework needed (vitest exists). Coverage tool (`@vitest/coverage-v8`) is not installed; add only if the 80% rule is to be measured (planner decision; flagged).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (token handling) | Existing Phase 8 access+refresh; Keychain storage |
| V3 Session Management | yes | Tokens in Keychain, cleared on logout/definitive refresh failure, stale-keychain-on-reinstall guard |
| V4 Access Control | no change | Backend |
| V5 Input Validation | yes | zod at boundaries: notification payload `extra.route` allowlist (only `/pantry/?filter=expiring` style routes), scanned barcode normalization via existing `lib/scan/barcode.ts` |
| V6 Cryptography | yes | Never hand-roll; Keychain via plugin; no secrets in bundle |
| V9 Communications | yes | HTTPS only; no ATS exceptions; do not enable `CapacitorHttp` |
| V14 Config | yes | No `server.url`, no cleartext, `NEXT_PUBLIC_API_URL` HTTPS asserted at build |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token in WebView localStorage (XSS/forensics) | Information Disclosure | Keychain; omit token from zustand persist; scrub legacy keys |
| Stale Keychain token after reinstall | Spoofing/Info disclosure | First-launch marker clears Keychain |
| Deep link / notification `extra.route` open redirect | Tampering | Validate route against allowlist before navigating |
| Overly broad CORS | Tampering | Already exact-match `NATIVE_APP_ORIGINS` |
| E2E hooks shipped to production | Elevation | `NEXT_PUBLIC_E2E` must be unset in release builds; script asserts absence of e2e route in `out/` for release |
| Camera permission string missing | Compliance | `NSCameraUsageDescription` in Info.plist, exact copy from UI-SPEC |
| Notification content contains PII | Info disclosure | Item names only (lock screen visible); consider documenting |

## Sources

### Primary (HIGH confidence)
- Local spike (2026-10-11): `npm view`/`npm pack` for every plugin (versions, peer deps, `Package.swift`); `cap add ios` output; `CapApp-SPM/Package.swift`; `xcodebuild` BUILD SUCCEEDED; simctl install/launch/screenshot; `next build` with export (22 pages, manifest failure message).
- `@capacitor/ios@8.5.3` source: `Router.swift`, `WebViewAssetHandler.swift`.
- `@capacitor/barcode-scanner@3.1.3`, `@capacitor/local-notifications@8.3.1`, `@aparajita/capacitor-secure-storage@8.0.1` READMEs and type definitions (from tarballs).
- Repo files: `frontend/next.config.ts`, `app/manifest.ts`, `app/layout.tsx`, `lib/api/{token-storage,client,session-refresh}.ts`, `lib/stores/auth-store.ts`, `components/auth/protected-route.tsx`, `components/pantry/scan/scan-sheet.tsx`, `lib/scan/use-barcode-scanner.ts`, `backend/src/config/cors.config.ts`, `frontend/vitest.config.ts`.

### Secondary (MEDIUM confidence)
- `.planning/research-v2/01-native-path.md` and `05-tooling-testing.md` (prior research; Maestro/WKWebView claims there are unverified).
- Capacitor config docs key names (not re-fetched this session).

### Tertiary (LOW)
- Practitioner reports that XCUITest taps may not fire React handlers (from 05, single source).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all versions verified and compiled together in the spike.
- Architecture: HIGH for export/SPM/build; MEDIUM for deep-reload behavior and config key names.
- Pitfalls: HIGH for P1 (source), P2 (code read), P3 (README), P4 (README); MEDIUM for P7.
- Validation: MEDIUM; Maestro unproven, simctl path proven for build/launch/screenshot only (not yet for log-based assertions or notification privacy grant).

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (Capacitor plugins release often; re-run `npm view` before pinning)
