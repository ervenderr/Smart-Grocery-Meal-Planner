---
phase: 11-offline-core
plan: 03
subsystem: offline-storage
tags: [sqlite, capacitor, ios, spm, supply-chain]
requires: [11-01]
provides: [native SqlDb adapter, memoized getDb, pinned sqlite + network plugins, Simulator durability proof]
affects: [11-04+]
tech-stack:
  added: ["@capacitor-community/sqlite 8.1.1", "@capacitor/network 8.0.1"]
  patterns: [dynamic import via loadPlugin, narrow connection interface for fakes]
key-files:
  created:
    - frontend/lib/offline/sql/native-sqldb.ts
    - frontend/lib/offline/sql/get-db.ts
    - frontend/lib/offline/sql/get-db.test.ts
  modified:
    - mobile/scripts/verify-deps.mjs
    - mobile/capacitor.config.ts
    - mobile/ios/App/CapApp-SPM/Package.swift
    - mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
    - frontend/components/e2e/e2e-runner.tsx
    - mobile/scripts/e2e-smoke.sh
    - frontend/package.json, frontend/package-lock.json, mobile/package.json, mobile/package-lock.json
decisions:
  - On-device DB unencrypted in v1 (iosIsEncryption false); flagged choice (A8 / T-11-06 accepted)
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 03: Native SQLite plugin, adapter, durability spike Summary

Both plugins passed the registry gate, were exact-pinned, and a row written through the native SqlDb adapter was read back on the iOS Simulator after terminate + relaunch.

## Commits
- 6de1cff chore: add plugins to verify-deps gate
- e342902 feat: install pinned plugins, configure CapacitorSQLite, cap sync
- 78bb806 fix: restore frontend lockfile platform entries
- 2b3fb38 feat: native SqlDb adapter, getDb, e2e sqlite step

## Legitimacy evidence (T-11-SC)
- @capacitor-community/sqlite@8.1.1: repo github.com/capacitor-community/sqlite, created 2020-07-25, 50+ maintainers (includes Ionic/OutSystems accounts), no preinstall/install/postinstall script, only dependency jeep-sqlite ^2.7.2.
- @capacitor/network@8.0.1: repo github.com/ionic-team/capacitor-plugins, created 2020-10-12, 18 maintainers, no install scripts, no dependencies.
- `verify-deps.mjs --registry-only` exit 0; `--parity` OK.

## Verification
- vitest lib/offline/sql: 27 tests passing (get-db.test.ts 12 cases); coverage of the two new files above 80% lines (get-db 81.8%, native-sqldb fully covered; production loader only exercised on device)
- tsc: no errors in touched files; lint 0 errors
- `npm run e2e:ios`: steps render, login, relaunch, sqlite (`ok:true`, `tables:7`), scan, haptics, notifications, done all PASS (62s); throwaway account deleted
- `npm run build:ios` exit 0; SPM resolved SQLCipher.swift 4.19.0 and ZIPFoundation 0.9.20
- Only `import type` references to the plugin package outside the dynamic import

## Deviations from Plan

**1. [Rule 3 - Blocking] npm install pruned optional platform entries from frontend/package-lock.json**
- npm dropped 26 lock entries (rolldown darwin binding etc.), breaking vitest startup. Rebuilt the lockfile as the previous one plus only the 29 new packages from the plugin tree, then `npm ci`. Commit 78bb806.

**2. [Rule 2] Package.resolved committed**: the iOS build pinned two new SPM deps there; committing keeps builds reproducible. The user's own uncommitted `project.pbxproj` change was left untouched and unstaged.

**3. Transaction semantics**: statements inside a manual transaction pass `transaction=false` to the plugin (otherwise it opens a nested one); nested `transaction()` joins the outer one.

## Deferred / not verified
- Web `npm run build` currently fails type check in `lib/offline/outbox/fold.ts` (duplicate object key) and missing outbox modules from other in-flight plans, not from this plan. The "no jeep-sqlite in web chunks" check passed against `.next/static` but that dir may predate the failed build; the static-export build used by build:ios/e2e compiled fine. Re-run once the outbox work lands.
- E2E run rewrote phase-10 screenshots/report.json; restored via git checkout to avoid noise.

## Known Stubs
None.

## Self-Check: PASSED
