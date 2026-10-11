---
phase: 11-offline-core
plan: 10
subsystem: offline-runtime
tags: [boot, runtime, hydrate, triggers, gate, tdd]
requires: [11-03, 11-04, 11-05, 11-06, 11-07, 11-08, 11-09]
provides: [isOfflineEnabled, createOfflineRuntime, getOfflineRuntime, setOfflineRuntime, bootOffline, BOOT_TIMEOUT_MS, attachTriggers, OfflineBootGate, FirstLaunchOffline]
affects: [11-11, 11-13, 11-14, 11-19]
key-files:
  created:
    - frontend/lib/offline/enabled.ts
    - frontend/lib/offline/runtime.ts
    - frontend/lib/offline/runtime.test.ts
    - frontend/lib/offline/boot.ts
    - frontend/lib/offline/boot.test.ts
    - frontend/lib/offline/triggers.ts
    - frontend/lib/offline/triggers.test.ts
    - frontend/lib/offline/sql/native-sqlite-loader.ts
    - frontend/components/offline/offline-boot-gate.tsx
    - frontend/components/offline/first-launch-offline.tsx
  modified:
    - frontend/components/providers.tsx
    - frontend/lib/offline/sql/get-db.ts
    - frontend/lib/offline/connectivity/native-network.ts
    - frontend/lib/build/native-config.ts
    - frontend/lib/build/native-config.test.ts
decisions:
  - "Gate decides pass-through with isNativeBuild() (build constant), not isNative(), so server and client renders agree (no hydration mismatch); bootOffline itself returns 'disabled' when not actually native."
  - "Web builds now pin NEXT_PUBLIC_NATIVE_BUILD=0 in next config. Without it Turbopack does not inline the unset var and the sqlite plugin chunk shipped in the web bundle."
  - "Native plugin loaders (sqlite, network, app) sit behind an inline process.env.NEXT_PUBLIC_NATIVE_BUILD === '1' check; the sqlite connection code moved to native-sqlite-loader.ts so the string CapacitorSQLite is absent from web output."
  - "createOfflineRuntime takes an optional fetchPage (default syncApi.bootstrap) for testability."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 10: Offline runtime, boot and gate Summary

Native cold start now opens SQLite, migrates, resets in_flight ops, hydrates React Query and folds pending ops before first render (1.5 s fail-open), with a runtime singleton wiring store, persister, connectivity, drain, reconcile and bootstrap refresh; web is an untouched pass-through.

## Commits
- 6161332 feat: offline runtime singleton (enabled.ts, runtime.ts)
- ddc2d39 (see git log, "boot sequence") feat: boot sequence and drain triggers
- 3e35f60 feat: boot gate, first-launch screen, Providers wiring, web plugin-chunk elimination

## Verification
- `vitest run lib/offline`: 32 files, 270 tests passing; runtime 12, boot 11, triggers 5 cases
- Coverage (lines): boot.ts 97.2%, runtime.ts 98.5%, triggers.ts 96%
- Full suite: 120 files, 1374 tests passing (rank.bench perf gate failed once under concurrent load, passes alone and in the final full run)
- `tsc --noEmit` clean; lint 0 errors (126 pre-existing warnings)
- Web `next build` OK; `grep -rlE "jeep-sqlite|CapacitorSQLite" .next/static` = 0 files
- `mobile npm run build:ios` OK (App.app built); `verify:bundle` OK, 4632 KB of 10240 KB budget; native export contains the plugin (2 chunks)
- iOS e2e not required by this plan and not run

## Deviations from Plan
**1. [Rule 1 - Bug] Web bundle shipped native plugin chunks.** The plan's acceptance grep failed on the first web build (3 chunks). Cause: web config left NEXT_PUBLIC_NATIVE_BUILD unset so it was not inlined. Fix: web config pins `'0'`, plugin imports gated inline, sqlite loader split into its own module. Updated native-config.test.ts accordingly.
**2.** RED and GREEN committed together per task (tests written first), as in prior plans.

## Known Risks / Notes
- Boot folds pending ops over hydrated data per the plan. If a later UI plan (11-11) persists optimistic cache state, a non-idempotent op (pantry.adjust) could be folded twice on restart; the persister should store base data or 11-11 should confirm.
- If boot hits the 1.5 s timeout, the gate opens before the runtime exists; triggers then attach only if the runtime is already set at that moment (background boot still completes and sets the runtime, but triggers and the initial refresh are skipped until next launch). Worth a follow-up in 11-13/11-19.

## Known Stubs
None.

## Threat Flags
None. T-11-29 (fail-open, fake-timer test), T-11-30 (user from auth store, none -> nothing hydrated), T-11-31 (reapplyForKey in the same batch, tested) mitigated.

## Self-Check: PASSED
