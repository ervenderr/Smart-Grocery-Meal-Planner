# Kitcha to App Store: native path research (2026-10-10)

Research only; repo untouched. Confidence tags: HIGH = first-party doc or direct inspection, MED = multiple secondary sources, LOW = vendor blog or single source.

## 1. Recommendation (one line)

**Capacitor 8 wrapping a Next.js static export (`output: 'export'`, bundled into the binary), with a custom native-feeling shell (native barcode scanner, push, haptics, native offline cache, IAP via RevenueCat), shipped through TestFlight first.** Keep the PWA on Vercel as the web product. Do not rewrite. Revisit SwiftUI only for a v2 if 4.2 rejection repeats or if the app proves revenue.

## 2. Facts about the existing repo (inspected directly, HIGH)

- Frontend lives in `frontend/app` (no `src/`). Routes: `/`, `(auth)/login`, `(auth)/signup`, `(app)/{dashboard,pantry,recipes,mealplans,shopping,budget,analytics,alerts,settings,profile,help}`.
- **No dynamic route segments** (`find app -name '[*'` returns nothing). **No `middleware.ts` / `proxy.ts`.** No route handlers besides `app/manifest.ts`. This makes static export almost free.
- Auth is **Bearer token in `localStorage`** (`lib/api/client.ts`: `config.headers.Authorization = Bearer ...`, key `auth-token`). No cookies on the frontend. So no WebView cookie/ITP/SameSite problem.
- Backend CORS (`backend/src/config/cors.config.ts`): allowlist predicate, `credentials: true`, requests with no Origin header pass. A Capacitor iOS WebView sends `Origin: capacitor://localhost` (default `iosScheme: capacitor`), which must be added to `CORS_ORIGIN`. (MED: scheme default from Capacitor config docs; I could not fetch a page stating the iOS origin string verbatim, verify on first device run.)
- `next/image` is used in `app/page.tsx`, login, signup, sidebar, header, onboarding. Default loader is unsupported in export, so set `images: { unoptimized: true }` (or custom loader).
- `package.json`: next 16.4.0, react 19.3.0, tailwind 4, react-query 5, zustand, framer-motion, `barcode-detector` 3.2.2. **No `serwist` dependency and no `sw.ts` in the tree** despite CLAUDE.md. Either it is not merged or lives elsewhere; verify before planning offline work. Inside a Capacitor bundle a service worker is not needed anyway (assets are local).
- Account deletion exists (`DELETE /api/v1/users/account`, UI in `components/settings/data-settings.tsx`). Good for Guideline 5.1.1(v). Note it is a **soft delete (deactivate)**; confirm that satisfies "account deletion" (see gotchas).
- No push infrastructure in the backend (grep hits for "push" are unrelated words). Server-side APNs sender is new work.
- Xcode: only Command Line Tools installed (`xcode-select -p` = `/Library/Developer/CommandLineTools`). Node v24.9.0 (Capacitor 8 needs Node 22+, fine).

## 3. Platform facts verified today

| Fact | Detail | Source | Conf |
|---|---|---|---|
| Upload SDK floor | Since 2026-04-28 uploads need Xcode 26+ / iOS 26 SDK | https://www.developer.apple.com/news/upcoming-requirements/ | HIGH |
| Xcode 26.5 needs macOS 26.2+ | Dev machine (macOS 26.5) qualifies. One developer reported a Swift 6.3.2 MainActor compiler bug, irrelevant for Capacitor/Swift-light work | https://developer.apple.com/documentation/xcode-release-notes/xcode-26_5-release-notes.md ; https://mjtsai.com/blog/2026/05/12/xcode-26-5/ | MED |
| Capacitor 8 | Released 2025-12-08. SPM is default for new iOS projects, min Xcode 26, iOS deployment target 15, Node 22+ | https://ionic.io/blog/announcing-capacitor-8 ; https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8 | MED-HIGH |
| npm latest (checked via `npm view` today) | @capacitor/core/cli/ios 8.5.3; push-notifications 8.1.3; local-notifications 8.3.1; preferences 8.0.1; haptics 8.0.2; share 8.0.3; status-bar 8.0.4; splash-screen 8.0.2; keyboard 8.0.6; network 8.0.1; app 8.1.2; browser 8.0.5; camera 8.2.5; filesystem 8.1.4; device 8.0.3 | npm registry | HIGH |
| Barcode plugins | `@capacitor-mlkit/barcode-scanning` 8.2.1 (CocoaPods only, `GoogleMLKit/BarcodeScanning ~> 8.0.0`, iOS 15.0 in podspec, no Package.swift in tarball); `@capacitor/barcode-scanner` 3.1.3 (official, OutSystems libs, **ships Package.swift + podspec**) | npm tarballs inspected; https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning | HIGH |
| SQLite | `@capacitor-community/sqlite` 8.1.1 | npm | HIGH |
| IAP | `@revenuecat/purchases-capacitor` 13.7.3; alt `@capgo/native-purchases` 8.9.2 | npm | HIGH |
| Sign in with Apple | `@capacitor-community/apple-sign-in` 7.1.0 (peer `>=7`), `@capgo/capacitor-social-login` 8.5.15 | npm | MED (not needed unless adding social login) |
| Expo | expo 57.0.27, react-native 0.87.1 (SDK 56 = RN 0.85, released 2026-05-21; SDK 57 current) | npm; https://expo.dev/changelog/sdk-56 | HIGH/MED |
| CocoaPods trunk | Read-only around Dec 2026 (sources disagree on exact date). Existing builds keep resolving, new pod versions stop | https://capgo.app/zh/blog/ios-spm-vs-cocoapods-capacitor-migration-guide/ | LOW-MED |
| Fees | Developer Program $99/yr; Small Business Program 15% commission under $1M proceeds (must enroll) | https://developer.apple.com/app-store/small-business-program/ | HIGH (fee: MED) |
| RevenueCat | Free until ~$2,500/mo tracked revenue, then ~1% | multiple 2026 blogs, e.g. https://costbench.com/software/subscription-billing/revenuecat/free-plan/ | LOW-MED (check revenuecat.com/pricing) |

## 4. Next.js 16 static export limits (official, v16.4.0, lastUpdated 2026-08-09)

Source: https://nextjs.org/docs/app/guides/static-exports (HIGH)

Unsupported: dynamic routes with `dynamicParams: true` or without `generateStaticParams()`; Route Handlers that read the Request; **Cookies**; **Rewrites; Redirects; Headers (next.config)**; **Proxy (the middleware successor)**; ISR; default Image loader; Draft Mode; **Server Actions**; Intercepting Routes. Route Handlers need `export const dynamic = 'force-static'`, GET only.

Kitcha impact:
- No dynamic routes, proxy, cookies, server actions: **nothing to remove**.
- `images.unoptimized: true` required.
- `next.config.ts` currently throws on production build if `NEXT_PUBLIC_API_URL` is unset. Keep; point the Capacitor build at the Railway API URL.
- `manifest.ts` is a metadata route and exports fine (add `export const dynamic = 'force-static'` if the build complains). Not used by the native app.
- Redirects/headers in config: none currently. Auth redirect must be client side (check `(app)/layout.tsx` already does this; it is a client guard if tokens are in localStorage).
- Add `trailingSlash: true` so WebView deep reload resolves `/pantry/index.html` (third-party tutorials recommend it, https://capgo.app/blog/how-to-use-capacitor-with-nextjs, LOW-MED).
- Future dynamic routes (`/recipes/[id]`) cannot be added in export mode without `generateStaticParams`; use query params (`/recipes/view?id=`) or a client router. Establish this as a rule now.
- One codebase, two builds: `BUILD_TARGET=native` toggles `output: 'export'` and `unoptimized` images; Vercel build stays SSR-capable. Keep the Serwist/PWA code out of the native build.

## 5. Capacitor: bundled vs remote URL vs static export

| Mode | What it is | Verdict |
|---|---|---|
| **Bundled static export** (`webDir: 'out'`) | HTML/JS/CSS shipped in the IPA, served from `capacitor://localhost`. API calls go to Railway | **Recommended.** Works offline at launch, instant first paint, strongest 4.2 position, no need for Vercel at runtime |
| Remote URL (`server.url` pointing at Vercel) | WebView loads the live site | **Do not.** Capacitor docs: `server.url` "is not intended for use in production" (https://capacitorjs.com/docs/config). Blank screen in airplane mode, the exact thing 4.2 reviewers test, and the most "repackaged website" shape |
| Hybrid (bundled shell + live-update, e.g. `@capgo/capacitor-updater` 8.52.1) | Ship JS updates without review | Optional later. Guideline 2.5.2/3.3.2 limits: no changing the app's primary purpose; keep native binary the baseline. Not needed for v1 |

Real constraint of the bundled approach: any web change needs an App Store release (or a live-update service). With a solo dev and low traffic this is fine; React Query cache plus a versioned API keeps old binaries working. Add a minimum-version check endpoint plus `@capawesome/capacitor-app-update` 8.1.0 (opens App Store update page) for forced upgrades.

## 6. Comparison of the four paths

Effort assumes a solo dev who knows TS/React and Express, no Swift or RN experience.

| Criterion | (a) Capacitor + static export | (b) Expo / React Native | (c) SwiftUI native | (d) PWA only |
|---|---|---|---|---|
| Calendar effort to first TestFlight | 1-2 weeks | 2-3 months (13 screens, forms, charts, toasts, dialogs all rewritten) | 3-5 months plus learning Swift 6 concurrency, SwiftData, etc. | 0 |
| Existing code reused | ~90-95% (UI, hooks, React Query, zod, API client, tests) | ~25-35%: API client, zod schemas, types, pure logic and tests (`lib/scan/*`, merge, prefill); all UI rewritten (no Radix, Tailwind via NativeWind, recharts replaced) | ~5%: API contract and business rules only | 100% |
| Barcode | MLKit plugin or official `@capacitor/barcode-scanner`; or tiny custom Swift AVFoundation/VisionKit plugin | `expo-camera` barcode (AVFoundation; ZXing fallback pod in 57.x) | VisionKit `DataScannerViewController` (iOS 16+, A12+, can restrict to `.ean13`) | WASM `barcode-detector` (current; iOS Safari lacks native API; slower, camera permission re-prompts) |
| Push | `@capacitor/push-notifications` 8.1.3 (APNs); needs APNs key and backend sender | `expo-notifications` | UNUserNotificationCenter + APNs | Web Push on iOS only for Home Screen PWAs (iOS 16.4+), flaky, no App Store presence |
| Offline storage | WebView IndexedDB/localStorage (can be evicted under storage pressure) plus `@capacitor/preferences` and `@capacitor-community/sqlite` 8.1.1 for durable data | AsyncStorage / `expo-sqlite` / MMKV | SwiftData / Core Data / GRDB | Service worker + IndexedDB, eviction risk |
| Performance feel | Good for list/form app; WKWebView scroll and rubber-banding OK; needs care for tap delay, safe areas, keyboard. Not fully native feel | Near-native, native gestures | Best, Liquid Glass and system components for free | Worst on iOS (no install prompt, 7-day script storage cap in Safari tabs) |
| Solo maintainability | Highest: one codebase, web and iOS share everything, Xcode touched rarely | Medium: second UI codebase to keep in parity, RN/Expo major upgrade every ~4 months | Lowest: second codebase in a second language, iOS only; Android would be a third | Highest |
| 4.2 risk | Medium (mitigated, see 7) | Low | Lowest | N/A (no store) |
| Monetization | StoreKit via RevenueCat | RevenueCat | StoreKit 2 | Stripe on web only (no store discovery) |
| Cost | $99/yr, Xcode free | $99/yr (+ EAS builds optional, local builds free) | $99/yr | $0 |

Conclusion: (b) and (c) buy native feel at 10-20x the effort and double the maintenance for a side project with little traffic and an unproven revenue model. (d) cannot give an App Store listing, which is the owner's explicit goal. (a) is the only path where a solo dev reaches the store this month and keeps one codebase.

## 7. Guideline 4.2 and how a Capacitor app passes

Official text (HIGH, https://developer.apple.com/app-store/review/guidelines/): 4.2 "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." 4.2.2: apps shouldn't primarily be "web clippings ... or a collection of links." 4.2.3(i) must work on its own. 4.2.6 rejects template/app-generator apps (not applicable: you are the content provider).

Evidence from the field (LOW-MED, vendor blogs and an Apple forum thread; no Apple statement about Capacitor specifically):
- Reviewers compare the app to the website in Safari; offline behavior is tested (airplane mode blank screen = instant flag). https://developer.apple.com/forums/thread/812889, https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Push, location, and sharing "alone" were not enough for at least one rejected Capacitor app. Native plugins are necessary, not sufficient. The pass pattern is native capabilities woven into the core loop plus a clear reviewer note.
- Hosted-site-in-WebView is the highest-risk shape (the `server.url` mode).

Kitcha's natural advantages (a pantry/expiry/meal-plan tool has genuine device utility):
1. **Native barcode scanning** as the primary add-to-pantry path (camera behind the WebView, instant, works offline for lookup of already cached products).
2. **Local notifications for expiry** ("Milk expires tomorrow", scheduled on device with `@capacitor/local-notifications`, works with no server and no APNs). This is the single strongest feature for 4.2: it is useful, offline, and impossible in a web page on iOS Safari without install. Add remote push later for shopping-list sharing/AI results.
3. **Offline-capable core**: pantry, shopping list, this week's meal plan readable and the shopping list editable offline, synced on reconnect. Show a native-styled offline state, never a browser error page.
4. Haptics on check-off/scan success; native share sheet for shopping list (`@capacitor/share`); status bar/splash; safe-area aware layout; bottom tab bar that does not look like a website nav.
5. Optional but cheap wins: Home Screen widget or Live Activity (needs Swift, WidgetKit; defer), Siri/Shortcuts (defer), Face ID app lock (`@capgo/capacitor-native-biometric` 8.8.1).
6. Review notes: demo account, 3 bullet points of native features, steps to reach each (scan, expiry notification, offline), and say there is no login wall without a demo account.

Honest risk: I put 4.2 rejection probability at roughly 15-30% on first submission if items 1-3 ship and the UI is truly mobile-first; one resubmission with notes usually resolves (MED-LOW, based on anecdotes). A rejection costs days, not the project.

Other review guidelines that will bite (HIGH, from the guideline text):
- **3.1.1**: any paid digital unlock must use In-App Purchase. Do not link to Stripe in the iOS build. Hide web checkout when `Capacitor.isNativePlatform()`.
- **5.1.1(v)**: account creation requires in-app account deletion (exists; verify it is real deletion or documented as deactivation plus data-erasure on request, ideally hard-delete job).
- **4.8**: only needed if you add Google/Facebook login. Email+password only needs nothing. Skip social login v1.
- **5.1.2(i)**: AI features send pantry data to Gemini/Groq. Disclose third-party AI and get explicit permission before sending (new consent screen). This is new in the current guidelines and applies directly to Kitcha. Update privacy policy and App Privacy labels.
- Privacy policy URL and support URL required; App Privacy nutrition labels; camera usage string `NSCameraUsageDescription`; notification permission must not be required to use the app (5.1.2(i) text).
- **3.1.2** subscriptions: describe price/benefit before the paywall; subscription must work across user devices (your account is server-side, so yes).

## 8. Auth, CORS, ATS, WebView storage gotchas

- **Token auth is already correct** for a WebView. Do not move to cookies. Move the token from `localStorage` to `@capacitor/preferences` (UserDefaults-backed) or a Keychain plugin so it survives WebView storage eviction; `localStorage` in WKWebView can be cleared under storage pressure (MED). Wrap in an abstraction (`tokenStore.get/set`) with web fallback.
- **CORS**: add `capacitor://localhost` to `CORS_ORIGIN` on Railway. Since all calls are cross-origin from the WebView, preflights hit Railway on every non-simple request; make sure `Authorization` is in allowed headers and `OPTIONS` is fast. Optionally enable `CapacitorHttp` (patches fetch/XHR to native, bypasses CORS) but then CORS no longer protects you and axios interplay needs testing; prefer plain CORS.
- **ATS**: Railway domains are HTTPS, so no ATS exceptions needed. Do not allow arbitrary loads. Open Food Facts is HTTPS. External images (OFF product photos) over https are fine.
- **Env**: native build needs `NEXT_PUBLIC_API_URL=https://<railway-domain>` baked in at build time. Consider a custom domain on Railway so the baked URL survives service rebuilds.
- Rate limiting by IP behind many users on cellular carrier NAT is a non-issue at this scale.
- Camera in WKWebView: `getUserMedia` works on `capacitor://localhost` (docs recommend keeping hostname `localhost` for secure-context APIs, https://capacitorjs.com/docs/config), but the native scanner avoids permission re-prompt and WASM cost anyway.
- Safe areas: `viewport-fit=cover`, `env(safe-area-inset-*)`, and `@capacitor/keyboard` resize mode so inputs are not hidden. `min-h-dvh` is already used. Test notch/Dynamic Island.
- Remove the iOS "install this PWA" hint (`lib/pwa/detect-ios.ts`) from the native build (`Capacitor.isNativePlatform()`).
- Pull-to-refresh and overscroll bounce: disable body bounce, keep scroll inside containers.
- Toasts/dialogs from Radix portal fine; 300ms tap delay is not an issue in WKWebView with `touch-action: manipulation`.
- **MLKit plugin is CocoaPods-only** (podspec dependency on GoogleMLKit, no Package.swift) while Capacitor 8 defaults to SPM. Either create the iOS project with `npx cap add ios --packagemanager CocoaPods`, or use the official `@capacitor/barcode-scanner` 3.1.3 (has Package.swift) and stay on SPM. CocoaPods trunk turns read-only around Dec 2026, so SPM is the safer long-term bet. MLKit also adds binary size. **Plan: try `@capacitor/barcode-scanner` first; fall back to MLKit with CocoaPods; third option is a ~150-line custom Swift plugin on VisionKit `DataScannerViewController` (iOS 16+, `.barcode(symbologies: [.ean13,.ean8,.upce,.code128])`, `isSupported`/`isAvailable` check) which has no third-party dependency.** Keep the existing WASM `barcode-detector` path as web fallback behind the same `use-barcode-scanner.ts` interface; the `lib/scan/*` pure functions and their tests carry over untouched (validity/normalization).
- `startScan()` (MLKit) puts the camera behind the WebView, so all DOM must be transparent: a design constraint for the scan screen.
- Open Food Facts requires a custom User-Agent and 15 req/min per IP. Today calls presumably go through your backend; keep it that way (one IP, cached), not directly from devices.
- Capacitor `@capacitor/app` listener for `backButton`/deep links not needed on iOS; add Universal Links later for password reset.
- iOS min deployment target: Capacitor 8 sets 15.0; consider 16.0 to match DataScanner and keep the support matrix small.
- Apple requires Xcode 26 SDK (above). Do not pin old Xcode.

## 9. Offline design for the Capacitor build

Layers (do the cheap one first):
1. App shell offline: free, assets are bundled.
2. **React Query persistence**: `@tanstack/react-query-persist-client` with a persister backed by `@capacitor/preferences` or IndexedDB (idb-keyval) for pantry, shopping, meal plan, recipes queries; `networkMode: 'offlineFirst'`; `gcTime` 7 days. Mutations queue via `useMutation` with `scope` and `resumePausedMutations`. This delivers 80% of "offline" with perhaps 3-5 days of work and stays web-compatible.
3. Only if conflicts become real: SQLite (`@capacitor-community/sqlite` 8.1.1) with a sync table. Needs backend change feed and conflict policy (last-write-wins by `updatedAt`). Avoid in v1.
4. Network state: `@capacitor/network` 8.0.1 to show "Offline - changes will sync" banner.
5. Local expiry notifications are scheduled from cached pantry data, independent of network (reschedule on every pantry change and on app foreground).

## 10. Phased plan (solo, part-time)

**Phase 0: Accounts and machine (1-2 days, mostly waiting)**
- Enroll in Apple Developer Program ($99/yr; individual enrollment can take 1-3 days, org needs a D-U-N-S number: use individual).
- Install Xcode 26.5 from the Mac App Store or developers.apple.com (large download, tens of GB installed), run `sudo xcodebuild -license accept`, `xcodebuild -runFirstLaunch`, install the iOS 26 simulator runtime. (No download size confirmed; plan for 15-40 GB free space.)
- Pick bundle ID (e.g. `app.kitcha.ios`), reserve app name in App Store Connect.

**Phase 1: Static export proof (2-3 days)**
- Branch. Add `BUILD_TARGET=native` handling in `next.config.ts`: `output: 'export'`, `images.unoptimized`, `trailingSlash: true`.
- Fix whatever `next build` flags (expect: images, maybe metadata routes).
- Abstract token storage; add `isNative()` util; strip PWA-only UI under native.
- Add `capacitor://localhost` to Railway `CORS_ORIGIN`.

**Phase 2: Shell on device (3-4 days)**
- In `frontend/`: `npm i @capacitor/core@8.5.3 @capacitor/ios@8.5.3 && npm i -D @capacitor/cli@8.5.3`; `npx cap init Kitcha app.kitcha.ios --web-dir out`; `npx cap add ios` (SPM default).
- Plugins: `@capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard @capacitor/haptics @capacitor/share @capacitor/preferences @capacitor/network @capacitor/app` (all 8.x).
- Icons/splash (1024 icon, no alpha), `Info.plist` strings, safe-area and keyboard pass, bottom tab navigation. Run in simulator, then your iPhone via free provisioning.
- Scripts: `build:native` = `BUILD_TARGET=native next build && cap sync ios`.

**Phase 3: Native features that justify the app (1-2 weeks)**
- Barcode: `@capacitor/barcode-scanner` 3.1.3 (or MLKit 8.2.1/custom VisionKit), wired into `use-barcode-scanner.ts`; keep OFF lookup via backend.
- Local expiry notifications (`@capacitor/local-notifications` 8.3.1) with settings UI (days before, time of day).
- Offline: React Query persistence + banner + offline shopping edits.
- Haptics, share shopping list, Face ID lock optional.
- AI consent screen (5.1.2(i)); account deletion check; privacy policy page.

**Phase 4: TestFlight (3-5 days)**
- Archive in Xcode, upload, internal testing on your own phone, then external TestFlight (needs a short beta review). Dogfood for 1-2 weeks. Fix WebView jank.
- Prepare screenshots (6.9" iPhone size; Apple currently needs only the largest iPhone size set, verify in App Store Connect), description, keywords (see App Store Optimizer), age rating, App Privacy labels, review notes with demo account.

**Phase 5: Submit v1.0 free (1-7 days review)**
- Free app first reduces review surface (no IAP). Respond to any 4.2 with a specific Resolution Center message listing native features; appeal if needed.

**Phase 6: Monetize (2-3 weeks, after v1.0 approval)**
- Model options: free + Kitcha Plus subscription (AI suggestions beyond N/day, unlimited scans/recipes, multi-device sync is already free), because AI has real cost. Keep core pantry free so reviewers and users get value.
- RevenueCat `@revenuecat/purchases-capacitor` 13.7.3 + App Store Connect products + server webhook to set `plan` on `User`; enforce on AI routes (you already have quota guards). Enroll in Small Business Program for 15%.
- Add remote push via APNs only if there is a feature that needs it (household sharing, AI job done).

**Phase 7 (optional, later):** Android via `@capacitor/android` (same code, Google Play $25 once), live updates, widgets in Swift, or a SwiftUI rewrite only if iOS revenue justifies.

## 11. Top gotchas (checklist)

1. Do not use `server.url` in production (docs + 4.2 + offline).
2. MLKit plugin is CocoaPods-only vs Capacitor 8 SPM default; pick the plugin before `cap add ios`.
3. Add `capacitor://localhost` to CORS allowlist; verify the actual Origin on device.
4. Move token off raw `localStorage`.
5. Static export forbids dynamic routes without `generateStaticParams`, server actions, cookies, redirects/headers/proxy: encode as team rule.
6. `NEXT_PUBLIC_*` is baked at build; production API URL must be stable.
7. Hide Stripe/web-payment UI on iOS; IAP only (3.1.1).
8. AI data-sharing consent (5.1.2(i)) and privacy policy; Gemini free tier may use content for training, so the disclosure matters even more (see CLAUDE.md note).
9. Soft-delete vs real account deletion for 5.1.1(v).
10. Review notes, demo account, test in airplane mode before every submission.
11. 1024x1024 icon without alpha, no placeholder text, no "beta" language, no links to Android/competitors.
12. Xcode 26 SDK mandatory since 2026-04-28; keep Capacitor on 8.x.
13. Camera behind WebView needs transparent DOM during `startScan`.
14. iOS 26 Liquid Glass: tab bar/status styling of a WebView will look flat next to system UI; accept or add a native tab bar plugin later. LOW priority.
15. Each web release now needs a binary release (or live-update); version-check endpoint for forced upgrade.
16. Capacitor and Expo/Next version churn: pin exact versions, use `npm ci`.
17. Per user rule, build order should start with tests: the new `tokenStore`, `isNative`, scanner-adapter, and notification scheduler are pure-ish modules that suit TDD at 80%+ coverage.

## 12. What would change my recommendation

- If first submission is rejected twice under 4.2 despite the native features: add a thin native SwiftUI layer (native tab bar, native scan screen, widgets) around the same WebView, or move to Expo for the highest-traffic screens. Do not jump to a full rewrite.
- If revenue exceeds a few hundred dollars per month and the UI feels laggy: re-evaluate SwiftUI for iOS-only.
- If you need Android soon: Capacitor already covers it; Expo becomes a stronger candidate only if rewriting anyway.

## 13. Sources

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple minimum SDK requirement: https://www.developer.apple.com/news/upcoming-requirements/
- Xcode 26.5 release notes: https://developer.apple.com/documentation/xcode-release-notes/xcode-26_5-release-notes.md
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Next.js static exports (16.4.0): https://nextjs.org/docs/app/guides/static-exports
- Capacitor config: https://capacitorjs.com/docs/config ; iOS config: https://capacitorjs.com/docs/ios/configuration
- Capacitor 8 announcement: https://ionic.io/blog/announcing-capacitor-8 ; upgrade guide https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8
- MLKit barcode plugin: https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning
- Capacitor + Next.js tutorials (LOW-MED): https://capgo.app/blog/how-to-use-capacitor-with-nextjs , https://capgo.app/blog/nextjs-mobile-app-capacitor-from-scratch
- 4.2 field reports (LOW): https://developer.apple.com/forums/thread/812889 , https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper , https://develak.com/blog/app-store-guideline-4-2-4-3-rejection/
- Expo SDK 56: https://expo.dev/changelog/sdk-56
- VisionKit scanning: https://developer.apple.com/documentation/visionkit/scanning-data-with-the-camera.md
- RevenueCat pricing (LOW-MED): https://costbench.com/software/subscription-billing/revenuecat/free-plan/
