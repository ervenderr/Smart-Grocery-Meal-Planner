---
phase: 10-capacitor-ios-shell
plan: 01
subsystem: mobile-shell
tags: [capacitor, ios, spm, next-export, platform-detection]
requires: []
provides:
  - "mobile/ npm package with exact-pinned Capacitor 8.5.3 + plugins and generated SPM iOS project"
  - "frontend/lib/build/native-config.ts (buildNextOptions, assertNativeEnv)"
  - "frontend/lib/platform/native.ts (isNative, isNativeBuild, loadPlugin) and use-platform.ts (usePlatform)"
  - "mobile/scripts/verify-deps.mjs, with-build-lock.sh, frontend-build.sh"
affects: [10-02, 10-03, 10-04, 10-05]
tech-stack:
  added: ["@capacitor/* 8.x (exact pins)", "@aparajita/capacitor-secure-storage 8.0.1", "@vitest/coverage-v8 5.0.3"]
  patterns: ["env-switched Next static export", "mkdir-lock serialized frontend builds"]
key-files:
  created:
    - mobile/package.json
    - mobile/capacitor.config.ts
    - mobile/scripts/verify-deps.mjs
    - mobile/scripts/with-build-lock.sh
    - mobile/scripts/frontend-build.sh
    - mobile/ios/App/CapApp-SPM/Package.swift
    - frontend/lib/build/native-config.ts
    - frontend/lib/platform/native.ts
    - frontend/lib/platform/use-platform.ts
  modified:
    - frontend/next.config.ts
    - frontend/app/manifest.ts
    - frontend/package.json
    - frontend/package-lock.json
requirements-completed: [SHELL-01]
duration: ~25 min
completed: 2026-10-11
---

# Phase 10 Plan 01: Capacitor iOS shell foundation Summary

Capacitor 8.5.3 SPM iOS project in `mobile/` syncing a `BUILD_TARGET=native` static export of the frontend, with an unchanged web build, shared platform helpers, and a serialized build helper.

## Commits
- 6a81b84 chore: deps behind automated legitimacy gate
- (RED) test: failing tests for native config and platform helper
- bee9e25 feat: static export config, platform helper, build scripts
- 9e0fdf1 feat: Capacitor config and generated SPM iOS project

## Results
- Legitimacy gate: all 14 packages passed (exact version exists, name matches, repo host ionic-team / aparajita / vitest-dev). No preinstall/install/postinstall scripts reported. Negative test (nonexistent version 8.5.999) exits 1; reverted.
- Parity: mobile and frontend have identical exact pins; frontend has no @capacitor/ios or @capacitor/cli in package.json (npm auto-added them and @capacitor/android as peer entries in the lockfile only).
- npm audit --omit=dev: mobile 0 vulnerabilities; frontend 3 (2 high, 1 moderate), all from the pre-existing axios 1.13.2 dependency, not from this plan. Not auto-fixed.
- Tests: 17 assertions in lib/build + lib/platform pass; type-check clean; eslint clean on new files.
- Web build (`frontend-build.sh web`) passes and creates no `out/`. Native export produces out/index.html, login, dashboard, pantry, settings. No route needed fixing for export.
- iOS deployment target: 15.0 (Capacitor 8 default). No Podfile; Package.swift generated and untouched.
- Config keys confirmed against installed declarations/READMEs: ios.contentInset, ios.scrollEnabled, ios.backgroundColor, SplashScreen.launchAutoHide/backgroundColor/launchFadeOutDuration, Keyboard.resize/resizeOnFullScreen/style, StatusBar.style ('LIGHT' = dark text per 8.0.4 enum). Key name is `overlaysWebView` (README), not `overlaysWebContent` as the UI-SPEC says (kept the real key). Dropped `launchShowDuration` (meaningless with launchAutoHide false). No `server` key.
- Info.plist: CFBundleDisplayName Kitcha (already), NSCameraUsageDescription exact UI-SPEC copy, iPhone orientations portrait only.

## Deviations from Plan

**1. [Rule 3 - Blocking] npm dropped rolldown/lightningcss optional bindings from frontend lockfile**
- Found during: Task 2 (vitest could not start: "Cannot find native binding").
- Issue: `npm i` pruned `@rolldown/binding-*` and `vite/node_modules/lightningcss-*` entries (npm optional-dependency bug), breaking vitest.
- Fix: restored the original lockfile, re-ran the installs, merged the 26 dropped entries back from the original lock, verified `npm ci` and vitest work. Lockfile diff contains only additions plus npm key reordering.
- Commit: bee9e25

**2. [Rule 1 - Bug] Own scripts/types**
- `BuildEnv` gained an index signature so `process.env` type-checks (weak-type error TS2559).
- `usePlatform` uses `useSyncExternalStore` instead of setState-in-effect (lint rule react-hooks/set-state-in-effect). Same behavior contract.
- with-build-lock.sh initial TMPDIR slash handling hung; fixed, serialization verified (two 3 s commands took 7 s). frontend-build.sh re-executes itself under the lock.
- First mobile/ install was mangled by a shell word-splitting mistake; node_modules and lock were removed and redone correctly before any commit.

**Frontend baseline note:** full `vitest run` showed one failure in `lib/rules/rank.bench.test.ts` (median 29.35 ms vs 28.6 ms budget) while parallel builds ran on the machine. Unrelated timing flake; not touched.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
Files verified present (verify-deps.mjs, with-build-lock.sh, frontend-build.sh, native-config.ts, native.ts, use-platform.ts, capacitor.config.ts, Package.swift); commits 6a81b84, bee9e25, 9e0fdf1 exist.
