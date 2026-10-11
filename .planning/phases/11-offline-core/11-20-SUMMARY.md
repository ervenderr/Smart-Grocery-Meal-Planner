---
phase: 11-offline-core
plan: 20
subsystem: offline-session
tags: [logout, session, outbox, facade]
requires: ["11-13", "11-19"]
provides: [logout-guard, logout-confirm-host, markAccountDeleted, facade-runtime-wait]
affects: [use-logout, delete-account, offline facade]
key-files:
  created:
    - frontend/lib/offline/session/logout-guard.ts
    - frontend/lib/offline/session/logout-guard.test.ts
    - frontend/lib/offline/session/logout-confirm-store.ts
    - frontend/components/offline/logout-confirm-host.tsx
  modified:
    - frontend/lib/auth/use-logout.ts
    - frontend/lib/account/delete-account.ts
    - frontend/lib/account/delete-account.test.ts
    - frontend/components/settings/delete-account-sheet.tsx
    - frontend/app/(app)/layout.tsx
    - frontend/lib/offline/facade.ts
    - frontend/lib/offline/facade.test.ts
decisions:
  - Pending count for the logout warning = queued + inFlight + blocked + pausedAuth + failed.
  - Explicit null runtime passed to offlineWrite still means "no runtime" (tests/web); only an omitted argument triggers the native wait.
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 20: Logout guard and deletion intent Summary

Logout with unsynced changes now shows a "Log out?" confirm with the count (stay signed in or log out); deletion marks the 'deleted' session intent via `markAccountDeleted()`; the offline write facade waits for runtime readiness on native.

## Tasks
1. Logout guard (RED test commit, then GREEN) plus zustand-backed `LogoutConfirmHost` mounted in the (app) layout.
2. `useLogout` consults `logoutDecision` before `authApi.logout`; `delete-account.ts` exposes `markAccountDeleted()` (calls `setSessionEndIntent('deleted')`), used by the delete sheet, with a test.
3. Extra: `offlineWrite`/`offlineWriteMany` on native (offline enabled) await `whenOfflineRuntime` bounded by `BOOT_TIMEOUT_MS` (1500 ms), then fall back to direct. Web is unchanged (immediate null). 4 new tests.

## Deviations from Plan
- [Rule 3] `useLogout` already called `setSessionEndIntent('logout')` and the delete sheet already called `setSessionEndIntent('deleted')`; the deleted call was moved into `markAccountDeleted()` in delete-account.ts to match the plan's artifact location.
- On native with no signed-in user the runtime never boots, so a direct write waits up to 1.5 s before falling back (writes need auth anyway).

## Verification
- Full vitest: 140 files, 1526 tests passing (one run hit a flaky perf bench `rank.bench.test.ts`, passed on rerun; unrelated).
- tsc clean; lint 0 errors; web `next build` OK; mobile `build:ios` OK.

## Known Stubs
None.

## Self-Check: PASSED
