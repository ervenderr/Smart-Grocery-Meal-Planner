# 05 - iOS Tooling and Testing for an Agent-Built Kitcha App
Research date: 2026-10-10. Stars/dates from `gh api` and `npm view` run today unless marked "web" (WebSearch/WebFetch, less reliable). No repo changes made.

## 0. Key facts that shape everything
- Capacitor 8 requires **Xcode 26.0+** and Node 22+; **SPM is the default** on iOS (CocoaPods optional via `--packagemanager CocoaPods`). Source: https://capacitorjs.com/docs/getting-started/environment-setup (HIGH). CocoaPods already on the machine is therefore not needed for a fresh Capacitor 8 project.
- App Store Connect uploads since 2026-04-28 must be built with **Xcode 26+ / iOS 26 SDK**; from 2026-09-09 min deployment target must be iOS 13+. Source: https://developer.apple.com/news/upcoming-requirements/ (HIGH). Check that page again before submission (a newer-SDK requirement could be announced).
- **Nothing can be built, run, or tested for iOS without full Xcode** (Command Line Tools lack simulators, `simctl` runtimes, `xcodebuild` for iOS SDK, signing). Xcode install is the first blocking human step.
- Apple Developer Program: $99/yr (Apple enrollment page, web; individual approval often ~48h per third-party, MEDIUM-LOW). Required for TestFlight, App Store, push, and App Store Connect API keys. Simulator runs and free-account device installs (7-day profiles) do not need it.

## 1. Claude Code skills, plugins, subagents, MCP servers

### 1a. Build / simulator MCP servers (core)
| Tool | Stars / last push | Notes | Install | Verdict |
|---|---|---|---|---|
| **XcodeBuildMCP, now "MobileBuildMCP"** (github.com/cameroncooke/XcodeBuildMCP, repo moved under getsentry/MobileBuildMCP) | 6.5k / 2026-10-09; npm `mobilebuildmcp` 2.7.1 (2026-09-23), legacy npm `xcodebuildmcp` 2.7.0 (2026-07-23) | MCP server + CLI. Build/run on simulator (`build_run_sim`), `simulator test`, build-for-testing, log capture, device tools, debugging daemon. Needs macOS 14.5+, Xcode 16+, Node 18+. Ships 2 optional skills (MCP skill, CLI skill). Sentry telemetry for runtime errors (opt-out documented). Whether UI-tap/screenshot tools are still in the current tool list: not confirmed (README did not list tools; run `mobilebuildmcp tools` after install). | `npm i -g mobilebuildmcp@latest` or `brew tap getsentry/xcodebuildmcp && brew install mobilebuildmcp`; `claude mcp add xcodebuild -- npx -y mobilebuildmcp@latest mcp`; skills: `npx -y mobilebuildmcp@latest init` | **Adopt** (HIGH on maintenance, MEDIUM on rename details; verify the package name at install time) |
| **Apple Xcode MCP bridge** (`xcrun mcpbridge`, Xcode 26.3+) | n/a (ships with Xcode) | ~20 tools per third-party blogs: BuildProject, GetBuildLog, RunAllTests/RunSomeTests, RenderPreview (captures SwiftUI Preview image), ExecuteSnippet, doc search, file ops. Needs Xcode running with the project open. Useful for SwiftUI path; less for Capacitor. | `claude mcp add --transport stdio xcode -- xcrun mcpbridge` (web: InfoQ https://infoq.com/news/2026/02/xcode-26-3-agentic-coding ; swiftjectivec.com). Third-party mentions Xcode 27 adds an "allow external agents" gate (unverified). | Optional, SwiftUI-only (MEDIUM) |
| **ios-simulator-mcp** (joshuayoes) | 2.2k / 2026-08-13; npm 2.1.0 | Tap, swipe, type, screenshot, record video, describe UI (accessibility tree), install/launch/terminate app. Uses Facebook `idb` (needs `brew install facebook/fb/idb-companion` and idb). | `claude mcp add ios-simulator -- npx -y ios-simulator-mcp` | **Adopt** for ad-hoc agent driving of WKWebView content and screenshots (HIGH it works; idb is aging, MEDIUM on long-term) |
| **mobile-mcp** (mobile-next) | 8.9k / 2026-10-09; npm `@mobilenext/mobile-mcp` 1.0.9 | iOS sim + real device + Android, accessibility-tree and screenshot-based actions. Real-device iOS needs WebDriverAgent setup. | `claude mcp add mobile -- npx -y @mobilenext/mobile-mcp@latest` | Strong alternative/complement to ios-simulator-mcp; pick one to avoid duplicate tools |

### 1b. Skills / plugins
| Name | Stars / push | What | Install |
|---|---|---|---|
| **Cap-go/capgo-skills** (formerly capacitor-skills) | 72 / 2026-10-10 | 49 Capacitor skills (core, features, UI, quality/testing, plugin selection, native builds). Vendor (Capgo) marketing links inside. Targets Capacitor 8. | `claude plugin marketplace add Cap-go/capgo-skills` then install `capacitor-core`, `capacitor-quality` ; or `npx skills add Cap-go/capgo-skills` |
| **capawesome-team/skills** | 47 / 2026-10-05 | Capacitor + Ionic + Capawesome skills | see repo README |
| **expo/skills** (official) | 2.7k / 2026-10-07 | Expo + EAS skills; only if Expo path chosen | see repo README (`/plugin marketplace add expo/skills`) |
| **AvdLee/SwiftUI-Agent-Skill** | 3.7k / 2026-10-06 | High quality SwiftUI best practice (Antoine van der Lee) | `npx skills add AvdLee/SwiftUI-Agent-Skill` |
| **AvdLee/Swift-Concurrency-Agent-Skill** | 1.7k / 2026-09-14 | Swift 6 concurrency | `npx skills add AvdLee/Swift-Concurrency-Agent-Skill` |
| **dpearson2699/swift-ios-skills** | 1.2k / 2026-07-31 | 56-84 skills, iOS 26 / Swift 6.x, frameworks incl. StoreKit, Foundation Models. Tessl security scan advisory: read before installing. | `/plugin marketplace add dpearson2699/swift-ios-skills` |
| **rshankras/claude-code-apple-skills** | 787 / 2026-07-24 | HIG, accessibility, build+screenshot loop | marketplace add |
| **rusel95/ios-agent-skills** | 11 / 2026-09-19 | small, benchmarked; low adoption | skip unless needed |
| **rorkai/App-Store-Connect-CLI skills** (`rudrankriyam/app-store-connect-cli-skills`) | 1.1k / 2026-10-05 | 25 skills for `asc` CLI: builds, TestFlight, metadata, submission, signing | `asc install-skills` (installs pinned commit) |
| Already present locally | - | `everything-claude-code:` swiftui-patterns, swift-concurrency-6-2, foundation-models-on-device, liquid-glass-design, swift-protocol-di-testing, swift-actor-persistence; agent types "Mobile App Builder", "App Store Optimizer", "macOS Spatial/Metal Engineer" | already installed |

No official Anthropic iOS plugin found (web, MEDIUM). Apple docs MCP: not verified individually; Xcode's mcpbridge includes doc search, and Context7 (already connected) covers Capacitor/Expo/RevenueCat docs. Skip unverified Apple-docs MCPs.

### 1c. App Store Connect / fastlane automation
| Tool | Stars / push | Notes |
|---|---|---|
| **rorkai/App-Store-Connect-CLI (`asc`)** (github.com/rudrankriyam/App-Store-Connect-CLI) | 7.7k / 2026-10-10 | Go CLI over the ASC API (TestFlight, builds, metadata, screenshots, submission, signing). Homebrew. **Best agent-friendly option**: scriptable, JSON output, has pinned skills. Adopt. |
| **fastlane** | 42.2k / 2026-10-10 | Still maintained. `match` (certs), `gym` (build), `pilot` (TestFlight), `deliver` (metadata/screenshots), `snapshot` (screenshots, needs XCUITest UI tests). Ruby; install via `brew install fastlane`. Adopt for gym/match/pilot if wanted; `asc` can replace deliver/pilot. |
| **zelentsov-dev/asc-mcp** (Swift) | 76 / 2026-09-24 | 500+ tools MCP over ASC API; young, huge tool surface bloats context. Use `asc` CLI instead (MEDIUM). |
| yuraist/appstoreconnect-mcp | 1 / 2026-09-05 | too young |
| JoshuaRileyDev/app-store-connect-mcp-server | 331, **archived** | avoid |
| appstore-release-mcp (npm) | unknown | wraps fastlane; web only, unverified |
| tddworks/asc-cli | 377 / 2026-10-05 | another Swift ASC CLI; second choice |

### 1d. Capacitor plugins relevant to Kitcha (versions via npm 2026-10-10)
- `@capacitor/core` 8.5.3 (2026-10-09), `@capacitor/camera` 8.2.5.
- Barcode: `@capacitor-mlkit/barcode-scanning` 8.2.1 (capawesome, 216 stars; ML Kit on iOS, requires camera; recommended). `@capacitor-community/barcode-scanner` is **archived** (last push 2024-10). `ionic-team/capacitor-barcode-scanner` 65 stars (OutSystems-backed). Note: the PWA's `barcode-detector` polyfill is web-only; WKWebView camera getUserMedia works on iOS 14.3+ but native plugin gives better reliability (MEDIUM).
- Purchases: `@revenuecat/purchases-capacitor` 13.7.3 (repo revenuecat/purchases-capacitor, 232 stars, 2026-10-09, official).
- On-device LLM: `@capgo/capacitor-llm` 8.1.9 (Cap-go/capacitor-llm, 44 stars, 2026-10-09; "supports Apple Intelligence" per repo description; runs local models). `capacitor-foundation-models` (ludufre) 7.0.0, 3 stars, **stale since 2025-06** (Capacitor 7). For Foundation Models in a Capacitor app, expect either the capgo plugin or a small custom Swift plugin (agent can write; skill `foundation-models-on-device` helps).
- Biometric: `@capgo/capacitor-native-biometric` 8.8.1.

## 2. Simulator / E2E testing options an agent can drive
| Option | Works headless for agent? | WKWebView/Capacitor fit | Notes |
|---|---|---|---|
| **Playwright (WebKit, iPhone device emulation)** | Yes, no Xcode needed | Tests web layer only, not the real WKWebView or the Capacitor bridge | Keep for 80% of UI tests against the Next.js app; already likely used. Fast, runs in CI Linux. (web: skills.cat capacitor-testing) |
| **XCUITest** | Yes via `xcodebuild test` (MobileBuildMCP `simulator test`) | Native elements good; web content appears in accessibility tree but synthetic taps reportedly don't always fire React onClick in WKWebView (web, one practitioner write-up, MEDIUM). `cap sync` may wipe a hand-added UITests target and Info.plist edits, so keep them in project config/scripts | Required for fastlane `snapshot` screenshots. Handle permission alerts with `addUIInterruptionMonitor`. |
| **Maestro** (16.0k stars, push 2026-10-08) | Yes, YAML flows, CLI; iOS Simulator only (real iOS devices limited, web source thin) | Drives via accessibility tree; text/id taps usually work on web content in WKWebView (MEDIUM, not verified for Capacitor; run a spike) | Install: `curl -fsSL "https://get.maestro.mobile.dev" \| bash` (check docs.maestro.dev; needs Xcode + Java). Best agent ergonomics: readable flows, built-in `takeScreenshot`, `launchApp` with permissions. Recommended E2E layer. |
| **Appium + XCUITest driver** (appium 22.1k; xcuitest driver 900 stars, push 2026-10-10) | Yes but heavy (server, WebDriverAgent) | Can switch to WEBVIEW context via Safari remote debugging, giving DOM-level selectors (HIGH from general knowledge, MEDIUM re: current setup) | Use if Maestro fails on webview taps. |
| **Detox** (12.0k) | React Native only | Not applicable to Capacitor | Only for RN. |
| **Safari Web Inspector / remote WebKit debugging** | Via Appium or `ios-webkit-debug-proxy` | Real DOM access | fallback |
| **ios-simulator-mcp / mobile-mcp** | Yes | Screenshot + accessibility-tree + tap; good for exploratory agent QA | Great for agent "look at it" loops; not regression-grade. |
| **Xcode Previews (RenderPreview via mcpbridge)** | Needs Xcode GUI process | SwiftUI only | Only if SwiftUI native path. |
| **Screenshot diff** | `pointfreeco/swift-snapshot-testing` 4.4k (native); Playwright `toHaveScreenshot` (web); Maestro screenshots + `pixelmatch` | - | Run on a pinned simulator model/OS for determinism. |
| `simctl` | `xcrun simctl` (boot, install, launch, privacy grant, push payload, status_bar override, io screenshot/recordVideo, openurl) | Cheap deterministic setup; push *payload delivery* simulation via `simctl push` works with APNs-formatted JSON file | agent can script everything |

### What is NOT (fully) testable in the Simulator, and coverage
| Feature | Simulator status | How to cover |
|---|---|---|
| **Camera / barcode scan** | No real camera. Simulator camera input not available; AVCapture shows black/unavailable (HIGH). | (a) Make the scan layer an interface; feed fixed barcode strings in UI tests via launch arg / debug menu; (b) test decode logic with static barcode image files through ML Kit/Vision image path (photo-library import: `xcrun simctl addmedia`); (c) final manual check on real iPhone via TestFlight / USB. |
| **Apple Intelligence / Foundation Models** | Works in Simulator only if host Mac is macOS 26 with Apple Intelligence enabled and model downloaded; forum reports flakiness on iOS Simulator (web: https://developer.apple.com/forums/thread/815397). Apple suggests real device. Machine is Apple Silicon macOS 26.5, so eligible, but Apple Intelligence must be enabled in Settings (human step). | Code against `SystemLanguageModel.default.availability`; test unavailable/fallback states with Xcode scheme availability override (web, verify menu); always keep the Gemini/Groq backend fallback; verify on a real iPhone 15 Pro or newer. |
| **Push notifications (APNs)** | Real remote push needs real device (Simulator got `simctl push` local payload injection and, since Xcode 14 on Apple Silicon, token registration is limited). | Test handlers with `xcrun simctl push <udid> <bundle> payload.apns`; use local notifications (`@capacitor/local-notifications`) for expiry reminders to avoid APNs entirely (matches low-traffic project). Real APNs needs paid account + key + device. |
| **StoreKit / IAP / subscriptions** | StoreKit Testing in Xcode with a `.storekit` configuration file works in Simulator (iOS 14+), supports time-acceleration, failures, refunds via Transaction Manager. **Only when launched from Xcode scheme with config attached** (CLI `xcodebuild` doesn't pick it up per RevenueCat doc, web). Local receipts are signed differently; RevenueCat refund/cancel events do not reach dashboard from local config. | Layer: (1) `.storekit` file + XCTest `StoreKitTest` `SKTestSession` for unit-level purchase logic; (2) RevenueCat sandbox with sandbox Apple ID on real device; (3) TestFlight (purchases free, sandbox environment). Verify with RevenueCat docs https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store . |
| Face ID | Simulator supports enrolled/matching/non-matching (Features menu / `notifyutil`); fine. | - |
| Haptics, real performance, memory, background refresh | Not representative | real device |
| Sign in with Apple | Needs signed-in Apple ID in simulator, limited | real device |

## 3. Build / release automation
| Piece | Details | Cost / limits |
|---|---|---|
| **Local first** | `xcodebuild archive` + `xcodebuild -exportArchive` + `xcrun altool`/`asc builds upload` or fastlane `gym`/`pilot`. Runs on this Mac with agents. | free |
| **fastlane** | `match` stores certs/profiles in private git (needs a private repo and passphrase); `deliver` pushes metadata + screenshots from `fastlane/metadata`, `snapshot` produces localized screenshots through XCUITest. | free OSS |
| **App Store Connect API key (.p8)** | Created by Account Holder/Admin in ASC > Users and Access > Integrations. Gives Key ID + Issuer ID; .p8 downloadable once. Allows non-interactive upload, TestFlight, metadata, cert creation (`asc`, fastlane `app_store_connect_api_key`). Store in env / Keychain, never commit. | free |
| **Xcode Cloud** | 25 compute hrs/month included in the Developer Program; paid tiers $49.99/100h up (web, Apple pages). Configured through Xcode GUI/ASC, so less agent-controllable; workflows are not code files. Good for "build + TestFlight on push" with zero cert handling. | free tier likely enough |
| **GitHub Actions macOS** | Standard macOS runner reported at **$0.062/min** (web, cut Jan 2026 from $0.08; verify at docs.github.com billing page). Public repos free. Private free-tier minutes are consumed at a macOS multiplier (not verified; check docs). A 10-minute iOS build costs ~$0.62. Self-hosted runner on this Mac costs nothing. | low |
| **EAS Build** | Expo only. Expo tooling (`expo/eas-cli` 1.4k stars) has a free tier with limited iOS builds (check pricing page; not verified). Irrelevant for Capacitor. | n/a |
| **Capgo native build / live update** | Cap-go/capgo (210 stars) Capacitor cloud builds and OTA; optional, vendor lock-in; Apple guideline 3.3.2 limits OTA to interpreted code. | paid tiers |
| **Automated screenshots/metadata** | `snapshot` (XCUITest) or Maestro `takeScreenshot` + `asc` upload; sizes required: 6.9" iPhone set at minimum (verify current required sizes in ASC at the time). Metadata via `asc` or `deliver`. | free |

Recommendation: local `asc` + `xcodebuild` scripts first (agent can run without GUI); add Xcode Cloud (free 25h) or a self-hosted runner for CI later. Avoid paid GitHub macOS minutes until volume justifies.

## 4. Open-source reference material
(GitHub search for "capacitor next.js ios starter", "pantry recipe grocery swiftui", and "revenuecat capacitor example" returned **no results** with `gh search repos`, so no vetted examples found; list below is what was verified.)
- Capacitor + Next.js: official guidance is `output: 'export'` (static) then `npx cap sync`. Kitcha's Next 16 app with API routes/SSR must be statically exportable, or Capacitor loads a remote URL (`server.url`), which risks App Store guideline 4.2 (minimum functionality) rejection. This is the most important architecture decision; needs a decision before building. (HIGH, general Apple/Capacitor knowledge.)
- RevenueCat official Capacitor SDK repo (above) includes an example app in its repo (not separately verified).
- On-device LLM: Cap-go/capacitor-llm (above); `mlc-ai/mlc-llm` 23.2k stars is the general runtime if bundling own model, heavy for a free-tier side app.
- `StanfordBDHG/SpeziLLM` and similar native Swift LLM wrappers: repo lookup failed (404); not verified.
- Grocery/pantry iOS reference apps: none verified via search; do a manual GitHub topic search (`topic:pantry ios`, `topic:meal-planner swift`) in the next phase, and study Mealie / Tandoor (self-hosted recipe managers) for feature ideas rather than iOS code.

## 5. Ordered setup checklist

### Human-only (cannot be automated; do in this order)
1. **Install Xcode 26.x+ from the Mac App Store** (or xcodereleases.com / developer.apple.com/download .xip; ~3-5 GB download, ~15-35 GB installed, plus ~8 GB per iOS simulator runtime; sizes approximate, MEDIUM). Needs Apple ID sign-in to the App Store. Free disk check first.
2. Launch Xcode once; accept license (`sudo xcodebuild -license accept` needs the human's sudo password); `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`; `xcodebuild -runFirstLaunch`; download iOS platform runtime (`xcodebuild -downloadPlatform iOS`, agent-runnable once license accepted).
3. Sign in to Apple ID in Xcode (Settings > Accounts) for automatic signing.
4. **Enroll in Apple Developer Program ($99/yr)** at developer.apple.com/programs/enroll (2FA, identity verification, may take hours to days). Decide Individual vs Organization (affects seller name on App Store).
5. In App Store Connect (human): accept agreements, create the app record (bundle ID e.g. `com.<you>.kitcha`), set up Paid Apps agreement + banking/tax if monetizing, create an **App Store Connect API key** (Admin) and download the .p8 once; hand Key ID / Issuer ID / path to the environment (not into the repo).
6. Enable Apple Intelligence on the Mac (System Settings) if testing Foundation Models locally; wait for model download.
7. Real iPhone: enable Developer Mode, trust the Mac, install TestFlight; join as internal tester. Needed for camera, push, sandbox IAP, Foundation Models.
8. Create sandbox tester Apple ID (ASC > Users and Access > Sandbox) and RevenueCat project + public SDK key (human signs up).
9. Privacy: App Privacy "nutrition labels", age rating, export compliance, review notes with demo account; first App Review submission click is human-confirmed (agents can prepare everything).

### Agent-automatable (after the above)
1. `brew install fastlane` / `asc` (rorkai tap) / `facebook/fb/idb-companion` / Maestro; `npm i -g mobilebuildmcp`; register MCP servers (`claude mcp add ...`); install skills (capgo-skills, SwiftUI skill, asc skills).
2. Scaffold: `npm i @capacitor/core @capacitor/cli @capacitor/ios`; `npx cap init`; `npx cap add ios` (SPM); `next build` with static export; `npx cap sync ios`.
3. Add plugins (ML Kit barcode, RevenueCat, local notifications, optional capgo-llm), Info.plist usage strings (NSCameraUsageDescription), PrivacyInfo.xcprivacy manifest, icons/splash (`@capacitor/assets`), `.storekit` config.
4. Build and run on simulator via MobileBuildMCP `build_run_sim`; screenshot via ios-simulator-mcp; Maestro flows; XCUITest for permission flows; Playwright for web.
5. Seed deterministic app state (launch args, test backend or mocked API), `simctl status_bar` override for screenshots.
6. Generate screenshots/metadata; `asc`/fastlane upload to TestFlight; TestFlight external group requires Beta App Review (human-visible).
7. CI: self-hosted macOS runner or Xcode Cloud; write lanes.

## 6. Parallel-agent caveats
- One Xcode project and one DerivedData per worktree; parallel agents should each use `-derivedDataPath` and a **dedicated simulator clone** (`xcrun simctl clone`/create unique UDIDs) to avoid collisions. Never let two agents run `cap sync` in the same directory.
- `xcodebuild` on Apple Silicon is CPU/RAM heavy; cap concurrency at 2 builds.
- Keychain/signing prompts block headless runs; use ASC API key + manual signing or `match` with a keychain unlocked in CI.

## 7. Recommended minimal stack (Capacitor path)
MobileBuildMCP (build/test) + ios-simulator-mcp (look/tap) + Maestro (E2E flows) + Playwright (web) + `asc` CLI (release) + Cap-go/capgo-skills (Capacitor knowledge) + RevenueCat Capacitor SDK + ML Kit barcode plugin. Add fastlane only if `snapshot`/`match` needed.

## 8. Confidence flags
- HIGH: Xcode/SDK requirements, repo stars/dates, npm versions, Capacitor 8 SPM and Xcode 26 requirement.
- MEDIUM: MobileBuildMCP tool list (README did not list UI tools), Maestro on WKWebView, Foundation Models in Simulator reliability, GitHub macOS pricing (third-party), Xcode Cloud specifics.
- LOW/unverified: Apple-docs MCPs, Xcode 27 mcpbridge gate, EAS free tier, reference grocery apps (none found), simulator camera behavior in latest Xcode (assumed none).

## Sources
- https://github.com/cameroncooke/XcodeBuildMCP (now getsentry/MobileBuildMCP)
- https://github.com/joshuayoes/ios-simulator-mcp , https://github.com/mobile-next/mobile-mcp
- https://github.com/mobile-dev-inc/Maestro , https://github.com/appium/appium-xcuitest-driver
- https://github.com/rudrankriyam/App-Store-Connect-CLI , https://github.com/rudrankriyam/app-store-connect-cli-skills
- https://github.com/fastlane/fastlane , https://github.com/zelentsov-dev/asc-mcp
- https://github.com/Cap-go/capgo-skills (Cap-go/capacitor-skills) , https://github.com/capawesome-team/skills , https://github.com/expo/skills
- https://github.com/AvdLee/SwiftUI-Agent-Skill , https://github.com/AvdLee/Swift-Concurrency-Agent-Skill , https://github.com/dpearson2699/swift-ios-skills
- https://github.com/revenuecat/purchases-capacitor , https://github.com/capawesome-team/capacitor-mlkit , https://github.com/Cap-go/capacitor-llm
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://developer.apple.com/news/upcoming-requirements/
- https://infoq.com/news/2026/02/xcode-26-3-agentic-coding
- https://developer.apple.com/forums/thread/815397 (Foundation Models in Simulator)
- https://www.revenuecat.com/blog/engineering/storekit-testing-in-xcode/ , https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store
- https://developer.apple.com/xcode-cloud/get-started
- https://docs.github.com/en/billing (macOS runner rates; third-party cicdcost.com figures)
