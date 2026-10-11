---
phase: 11-offline-core
plan: 21
subsystem: testing
tags: [e2e, simulator, offline, sqlite, idempotency, phase-gate]
requires: [11-02, 11-15, 11-16, 11-17, 11-18, 11-20]
provides:
  - Scripted Simulator offline E2E (npm run e2e:offline)
  - Phase 11 gate results and filled 11-VALIDATION.md
affects: [11-22]
tech-stack:
  patterns: [KITCHA_E2E phase-machine runner, forced-offline flag injected by E2E build env]
key-files:
  created:
    - frontend/lib/e2e/offline-phases.ts
    - frontend/lib/e2e/offline-phases.test.ts
    - frontend/components/e2e/offline-runner.tsx
    - frontend/lib/offline/sql/native-sqldb.test.ts
    - mobile/scripts/e2e-offline.sh
  modified:
    - frontend/app/e2e/page.e2e.tsx
    - frontend/lib/offline/connectivity/probe.ts
    - frontend/lib/offline/connectivity/forced-offline.ts
    - frontend/lib/offline/sql/native-sqldb.ts
    - mobile/scripts/frontend-build.sh
    - mobile/package.json
    - mobile/README.md
    - .planning/phases/11-offline-core/11-VALIDATION.md
requirements-completed: [OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09]
duration: ~1h
completed: 2026-10-11
---

# Phase 11 Plan 21: Simulator offline E2E and phase gate Summary

Scripted Simulator E2E proves offline durability across a real app kill and exactly-once replay on the server, and it surfaced three real product bugs that are now fixed with tests. All automated gates are green.

## What was verified on the Simulator (iPhone 17, iOS 26.5, ~55 s, throwaway account)

Airplane mode is simulated with the E2E-only forced-offline flag (simctl has no airplane switch). Real airplane mode and reboot remain human_needed (11-22).

1. seed (online): login, create recipe, meal plan, pantry item, shopping item; bootstrap refresh ok; four canonical keys non-empty (1 each); persister flushed.
2. offline-write: flag on, connectivity reads offline; queued shopping check, pantry adjust +2 then +3 (coalesced to 1 adjust op), pantry create. 3 queued ops.
3. Kill: `simctl terminate` while offline with queue non-empty.
4. offline-cold-start (relaunch, still offline): pantry 2, recipes 1, meal plans 1, shopping 1 hydrated from SQLite; queue 3 intact; optimistic quantity 6 and created item visible; hydrateMs 0.
5. reconnect: flag off, drain; server pantry delta exactly +5, created item exactly once, shopping item checked, queue empty.
6. replay: same adjust resent with the same Idempotency-Key and body; server quantity unchanged (exactly-once).
7. Account deleted via DELETE /api/v1/users/me; frontend/out, .next, iOS public dir and build wiped by the EXIT trap (no E2E_PASSWORD found in output).

Limitation: screenshots show the E2E runner status text, not the app UI. Backend not deployed; production only touched with the throwaway account.

## Gate results

| Gate | Result |
|------|--------|
| Full vitest | 142 files, 1539 tests pass (rank.bench perf test is flaky under parallel load and under coverage instrumentation, passes alone; pre-existing, unrelated) |
| Coverage lib/offline/** | 95.36% lines, 88% branches (offline + components/offline tests, 420 tests) |
| tsc --noEmit | clean |
| lint | 0 errors, 128 warnings (pre-existing) |
| Web build (NEXT_PUBLIC_API_URL=https://example.invalid) | succeeds; .next/static has no jeep-sqlite or CapacitorSQLite |
| Backend jest cook-occurred-at + cook-endpoints | 2 suites, 30 tests pass |
| Release build:ios + verify:bundle | OK, 4664 KB of 10240 KB budget |
| Release bundle free of `kitcha:e2e-force-offline`, no out/e2e | yes |
| e2e:offline | 6 of 6 steps ok |
| e2e:ios smoke | 8 of 8 steps ok |

## Deviations from Plan (auto-fixed, Rules 1 and 2)

1. **[Rule 1] Probe fetch called as a method.** `probeHealth` ran `opts.fetchImpl(...)`, binding `window.fetch` to the options object; WebKit throws Illegal invocation, so every native probe failed and connectivity read offline forever. Fixed with a detached call plus a regression test (ac1ad6e).
2. **[Rule 1] Probe URL lacked CORS.** Production `/health` is registered before the CORS middleware, so a `capacitor://localhost` fetch is blocked. Probe now targets `/api/v1/` (CORS enabled, verified with curl); no backend change (c7e0b80).
3. **[Rule 1] Native SQLite transactions overlapped.** Smoke E2E hit "cannot start a transaction within a transaction". Top-level writes and transactions are now serialized on the single connection, with 4 new tests (747c5ba). Deadlock would only occur if a transaction callback used the outer db instead of `tx`; the full suite and both E2Es pass.
4. **[Rule 2/gate] Forced-offline key literal was in the release bundle** (Turbopack does not fold the undefined env check). The key is now injected only through `NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY` set by `frontend-build.sh --e2e` (c579cb9, 2d4c536).
5. Test-only: lint no-this-alias fix (950e089); runner flushes the persister after the seed refresh so server-confirmed data is on disk before going offline (the persister debounces 150 ms and skips writes while ops are queued; real users are not affected unless they go offline within 150 ms of a refresh).

## Flagged decisions (carried)

- OFF-07 mark = queued cook op.
- Backend additive `occurredAt` on cook/apply is NOT deployed (production ignores the extra field).
- Web IndexedDB fallback skipped.
- SQLite unencrypted in v1.
- Idempotency TTL residual risk (48 h): an op replayed after expiry could apply twice.

## Notes for the orchestrator

- Nothing pushed to origin. All gates are green, so pushing is the orchestrator's call; commits are b9ad10d through 073682f plus this summary.
- User's pre-existing `mobile/ios/App/App.xcodeproj/project.pbxproj` change is untouched (identical to the snapshot taken at start); Phase 10 screenshots overwritten by e2e:ios were restored with git checkout.
- Untracked `mobile/ios/App/.DS_Store`, `pg.log`, `pgdata/` left alone.

## Self-Check: PASSED
