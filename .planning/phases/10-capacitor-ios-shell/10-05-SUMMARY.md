---
phase: 10-capacitor-ios-shell
plan: 05
subsystem: mobile-shell
tags: [ios, simulator, build-scripts, bundle-gate]
requires: ["10-01"]
provides:
  - "mobile/scripts/build-ios.sh, sim-run.sh, verify-bundle.sh and lib/common.sh, lib/sim-device.sh"
  - "npm scripts build:ios, sim:run, verify:bundle"
  - "Committed SPM Package.resolved"
  - "mobile/README.md with Personal Team signing steps and human_needed checklist"
affects: [10-10]
key-files:
  created:
    - mobile/scripts/build-ios.sh
    - mobile/scripts/sim-run.sh
    - mobile/scripts/verify-bundle.sh
    - mobile/scripts/lib/common.sh
    - mobile/scripts/lib/sim-device.sh
    - mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
  modified:
    - mobile/package.json
    - mobile/README.md
requirements-completed: [SHELL-01, SHELL-06]
completed: 2026-10-11
---

# Phase 10 Plan 05: iOS build pipeline Summary

One-command scripted pipeline: `npm run build:ios` (static export with https API baked in, cap sync, unsigned Simulator xcodebuild), `npm run sim:run` (boot, install, launch, screenshot), `npm run verify:bundle` (security and size gate), plus a README with signing and real-iPhone steps.

## Commits
- ebf56ea: build-ios, sim-run, shared helpers, npm scripts, Package.resolved
- 2455ea6: verify-bundle and README

## Results
- `npm run build:ios` exits 0 and prints `.../mobile/build/Build/Products/Debug-iphonesimulator/App.app`.
- `npm run sim:run -- --screenshot e2e-artifacts/launch.png` printed `app.kitcha.mobile: 13853`; screenshot non-empty (gitignored).
- `npm run verify:bundle`: 4212 KB of 10240 KB budget, OK. Negative test with a temp config containing `server: { url }` (via CAP_CONFIG_PATH) fails with rc=1.
- `API_URL=http://x build-ios.sh --skip-xcode` exits 1; `--bogus` exits 2.
- Package.resolved exists and is not gitignored; committed.
- Export + sync run under the shared build lock (internal `--export-sync-locked` re-entry); xcodebuild runs after release.

## Deviations from Plan

**1. [Rule 1 - Bug] Server-key regex missed inline objects**
- Found during: Task 2 negative test (`export default { server: ... }` passed).
- Fix: regex now `(^|[{,[:space:]])"?server"?[[:space:]]*:`; retested fail/pass.
- Commit: 2455ea6

**2. Transient:** first build:ios attempts failed type-check on another plan's in-flight RED tests (`lib/auth/native-boot.test.ts`, `auth-store-native.test.ts`); waited and retried per plan note, no files outside this plan touched.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
All created files present; commits ebf56ea and 2455ea6 exist.
