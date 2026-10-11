---
phase: 12-one-time-unlock
plan: 15
subsystem: ios-wiring
tags: [capacitor, spm, storekit, privacy-manifest]
requires: [12-03, 12-14]
provides:
  - "KumaunStore registered in CapApp-SPM via cap sync"
  - "Shared App scheme with Kumaun.storekit for Run"
  - "Purchase History live in privacy manifest"
affects: []
key-files:
  modified:
    - mobile/package.json
    - mobile/package-lock.json
    - mobile/ios/App/CapApp-SPM/Package.swift
    - mobile/ios/App/App/PrivacyInfo.xcprivacy
    - docs/store/IAP.md
    - docs/store/PRIVACY-LABELS.md
  created:
    - mobile/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme
completed: 2026-10-11
---

# Phase 12 Plan 15: Xcode wiring Summary

Xcode wiring: PASS

## Gate

`git log --oneline -i --grep=testflight` and the script-path log both print `6966789 feat: TestFlight build pipeline, app icon, privacy manifest, signing team`. `git status --porcelain --untracked-files=no mobile/ios mobile` was empty. Coordinator confirmed the TestFlight agent is finished.

## Results

- `npm install ./plugins/kumaun-store` wrote `"kumaun-store": "file:plugins/kumaun-store"`; `npm run verify:deps` OK (parity, kumaun-store@0.1.0 listed).
- `npx cap sync ios` generated the KumaunStore package and product in `CapApp-SPM/Package.swift`.
- Shared scheme `App.xcscheme` created: Run=Debug with StoreKitConfigurationFileReference, Profile/Archive=Release. `xcodebuild -list` shows App; Release `-showBuildSettings` resolves.
- Purchase History dict un-commented in `PrivacyInfo.xcprivacy` (linked, not tracking, App Functionality); `plutil -lint` OK and extract finds it.
- `xcodebuild -scheme App -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`: BUILD SUCCEEDED with KumaunStore linked.
- project.pbxproj and Info.plist untouched. No build numbers changed, nothing archived or uploaded.
- Docs: IAP.md and PRIVACY-LABELS.md no longer describe wiring as pending.

## Deviations

- The StoreKit identifier is `../../storekit/Kumaun.storekit` (relative to the directory containing App.xcodeproj, `mobile/ios/App`) instead of the plan's `../../../../storekit/...`, which would resolve outside the intended location. Assumption A3 stands: confirm in Xcode.
- The privacy manifest also had a stray closing `-->` that was removed together with the opening comment line.

## human_needed

1. Open `mobile/ios/App` in Xcode; Edit Scheme > Run > Options must show Kumaun.storekit (fix the path if blank).
2. Cmd+R on a simulator: purchase and restore against the StoreKit config.
3. Confirm the In-App Purchase capability in Signing & Capabilities (pbxproj deliberately not edited).
4. Real StoreKit purchase checks via TestFlight sandbox (CLI probe was skipped in 12-03).

## Known Stubs

None.

## Self-Check: PASSED
