---
phase: 10-capacitor-ios-shell
plan: 10
subsystem: mobile-shell
tags: [e2e, simulator, keychain, verification]
requires: ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07", "10-08", "10-09"]
provides:
  - "frontend/lib/e2e/self-check.ts (formatE2eLine, findTokenLeaks, nextPhase) with 13 tests"
  - "E2E-only route app/e2e/page.e2e.tsx + components/e2e/e2e-runner.tsx"
  - "mobile/scripts/e2e-smoke.sh, lib/e2e-account.sh, npm run e2e:ios"
  - "Phase gate results and screenshots"
key-files:
  created:
    - frontend/lib/e2e/self-check.ts
    - frontend/lib/e2e/self-check.test.ts
    - frontend/app/e2e/page.e2e.tsx
    - frontend/components/e2e/e2e-runner.tsx
    - mobile/scripts/e2e-smoke.sh
    - mobile/scripts/lib/e2e-account.sh
  modified:
    - mobile/package.json
    - mobile/README.md
    - mobile/scripts/build-ios.sh
    - frontend/lib/auth/keychain-backend.ts
requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06]
completed: 2026-10-11
---

# Phase 10 Plan 10: E2E smoke and phase gate Summary

`npm run e2e:ios` builds an E2E variant, installs fresh on the iPhone 17 Simulator, logs in to production with a throwaway account across a real terminate/relaunch (Keychain persistence proven), checks scan routing, haptics and permission-gated reminders, then deletes the account and wipes E2E build output. The E2E run caught two real defects in earlier plans, both fixed.

## Commits
- test: failing self-check tests
- 1fa096c feat: self-check helpers, E2E route and runner
- fix: box Capacitor SecureStorage proxy (keychain-backend), plus e2e-smoke.sh, e2e-account.sh, npm script
- 4234537 fix: ad-hoc sign Simulator build, bounded notification opt-in wait
- db00089 docs: README verification results and screenshots

## Gate results
| Check | Result |
|-------|--------|
| vitest full | 83 files, 1083 tests pass (on a quiet machine, rank.bench passed) |
| coverage (listed new modules, v8) | pass, threshold 80% lines: overall 97.5% lines, 96.2% stmts, 86.3% branch; lowest file navigation.ts 85.7% lines |
| lint | 0 errors (124 pre-existing warnings) |
| type-check | clean |
| web build | pass, no `.next/server/app/e2e` |
| native export (release) | pass, no `out/e2e`, no KITCHA_E2E |
| build:ios (release) | pass |
| verify:bundle | OK, 4740 KB of 10240 KB |
| e2e:ios | pass twice (about 40 s): render, login, relaunch, scan, haptics, notifications, done all ok |

rank.bench flake: it fails when run under `--coverage` (v8 instrumentation slows it, 35.8 ms vs 28.6 ms budget) and passes in the plain full run. The coverage run therefore excluded `lib/rules/rank.bench.test.ts` (1081 tests); coverage targets do not include rules code. Some 100%-covered files are hidden by the reporter table (skipFull) but threshold passed.

Capture source: the primary and reliable source is `simctl launch --console-pty` output (Capacitor forwards `console.log` as `[log] - KITCHA_E2E {...}`). `log stream` received nothing and is only a fallback.

## Deviations from Plan
**1. [Rule 1 - Bug] SecureStorage proxy resolved from an async function (plan 06 file keychain-backend.ts)**
- Found during: first e2e run (app stuck on the spinner at `/`; JS showed `"SecureStorage.then()" is not implemented on ios`).
- Cause: returning the Capacitor plugin Proxy from an async function makes the promise machinery call `.then`, which rejects natively, so Keychain hydration never completed on a real native runtime (unit tests could not see this).
- Fix: box the plugin in a plain object. 22 auth tests still pass. Commit: fix(10-10) keychain-backend.

**2. [Rule 1 - Bug] Unsigned Simulator build cannot use the Keychain (plan 05 file build-ios.sh)**
- Found during: e2e run 3 (OSStatus -34018 on Keychain set/remove; the login step was a false pass from the in-memory snapshot, but relaunch correctly failed).
- Fix: build with `CODE_SIGN_IDENTITY="-" CODE_SIGNING_ALLOWED=YES` (ad-hoc). Relaunch then passed with the Keychain token. Commit: 4234537.

**3. [Rule 3 - Blocker] Notification permission cannot be granted on a headless Simulator**
- `simctl privacy` has no notifications service and Simulator.app GUI scripting is unavailable. The runner now bounds `requestOptIn` to 10 s (E2E-only code); result is `permission: prompt, status: not-granted, pending: 0`, which the plan accepts, and the pending-count check is recorded as human_needed.

## Auth gates
None. The production API was used only with a throwaway `kitcha-e2e+...@example.com` account created and deleted by the script (signup HTTP 201, "account deleted" logged each run, three runs). Credentials were never printed, written to committed files or logged; `frontend/out` and `ios/App/App/public` are wiped by the EXIT trap and verified absent. The release bundle contains no KITCHA_E2E or E2E route.

## Observations
- Relaunch always starts at `/` (NativeEntry then routes by auth state): no deep-reload dependency.
- Remaining `window.location` uses are web-only or fallback: error-boundary reload and home (native branch uses `navigate`), api/client.ts 401 redirect (line 49, plan 06 added soft navigation for native), navigation.ts web fallback, scan-sheet.tsx `app-settings:` fallback when `@capacitor/app` lacks openUrl, use-reminders.ts `APP_SETTINGS_URL` assign (settings deep link, not an app navigation).
- Screenshots 02-e2e-pantry.png and 00 (first attempt) showed a lingering system notification alert; the committed 00-release-login.png was retaken on a fresh Simulator boot and shows the login screen with the status bar not overlapping the header. 02-e2e-pantry.png shows the new account's onboarding with the system alert (expected given item 3).

## Screenshots (absolute paths)
- /Users/ervenderr/Projects/Smart-Grocery-Meal-Planner/.planning/phases/10-capacitor-ios-shell/screenshots/00-release-login.png
- /Users/ervenderr/Projects/Smart-Grocery-Meal-Planner/.planning/phases/10-capacitor-ios-shell/screenshots/01-e2e-dashboard.png
- /Users/ervenderr/Projects/Smart-Grocery-Meal-Planner/.planning/phases/10-capacitor-ios-shell/screenshots/02-e2e-pantry.png
- /Users/ervenderr/Projects/Smart-Grocery-Meal-Planner/.planning/phases/10-capacitor-ios-shell/screenshots/report.json

## human_needed (pending (user))
- Real barcode scan of a product on the iPhone
- Haptic feel (check shopping item, quantity step, cooked it, scan success)
- Notification delivery at the scheduled time, including airplane mode, and tap deep link to Pantry expiring filter
- Dynamic Island and keyboard clearance in bottom sheets
- Status bar legibility on device
- Signing team setup and run on the connected iPhone (00008110-001914C02146401E)
- Login from the device (CORS `capacitor://localhost`)
- Notification pending-count check after granting permission (Simulator could not grant it)

## Known Stubs
None.

## Threat Flags
None. T-10-44..46 mitigations verified (credentials per run, wiped output, release export free of E2E markers).

## Self-Check: PASSED
Created files present; commits exist in git log; frontend/out and App/public absent after the final e2e run (release rebuild then recreated them as gitignored build output, not tracked).
