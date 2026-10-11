---
phase: 10-capacitor-ios-shell
fixed_at: 2026-10-11T00:00:00Z
review_path: .planning/phases/10-capacitor-ios-shell/10-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Source review:** .planning/phases/10-capacitor-ios-shell/10-REVIEW.md
**Scope:** Critical and Warning (Info findings IN-01..IN-06 not attempted)

**Summary:** 7 in scope, 7 fixed, 0 skipped. Fixes were committed directly on `main` (no separate worktree) at the orchestrator's instruction, because the frontend needs `node_modules` for tests.

## Fixed Issues

### CR-01: Session expiry leaves auth store authenticated
**Files:** `frontend/lib/api/client.ts`, `frontend/lib/api/session-expiry.ts` (new), `frontend/lib/api/session-expiry.test.ts` (new)
**Commit:** 0ba9d37
**Fix:** `onSessionExpired` now calls `useAuthStore.getState().clearAuth()` (new `expireSession`), then navigates as before (native: client navigate to `/login/`; web: `window.location.href`). The only web change is that the store is cleared on expiry. Tests assert `isAuthenticated`, `token` and `user` are cleared and native navigation happens.

### WR-01: Keychain plugin configuration failure cached forever
**Files:** `frontend/lib/auth/keychain-backend.ts`, `frontend/lib/auth/keychain-backend.test.ts` (new)
**Commit:** 27b1ef6
**Fix:** A rejected `configure()` resets `ready` so the next call retries. Regression test added.

### WR-02: Transient Keychain read failure memoized
**Files:** `frontend/lib/auth/token-store.ts`, `frontend/lib/api/token-storage.ts`, `frontend/lib/auth/token-store.test.ts`
**Commit:** 5e808ff
**Fix:** `init()` no longer memoizes a failed read; `whenTokenStorageReady` resets its promise on `readFailed` and re-runs hydration on the Capacitor `resume` event (one-shot listener). The snapshot-apply guard no longer depends on `ready`, so a retry still loads tokens. Test added. Status: fixed, requires human verification on a device (lock/resume behavior is not unit-testable).

### WR-03: First-launch heuristic logs users out when localStorage is purged
**Files:** `frontend/lib/auth/native-boot.ts`, `frontend/lib/auth/native-boot.test.ts`
**Commit:** 3481044
**Fix:** The install marker is written first and read back; the Keychain is wiped only if the marker was persisted (a failing marker write no longer wipes on every launch). The eviction trade-off is documented in the function comment. An uninstall-surviving marker (`@capacitor/preferences`) was not added because it needs a new native dependency and pod sync; the eviction case remains a safe failure (re-login). Status: fixed (partial mitigation, requires human verification).

### WR-04: E2E build output containing credentials not cleaned
**Files:** `mobile/scripts/e2e-smoke.sh`
**Commit:** 23e6533
**Fix:** Cleanup now also removes `frontend/.next` and `mobile/build` under the build lock (in addition to `out` and `ios/App/App/public`). The optional refuse-supplied-account flag was not added.

### WR-05: Stale-lock removal racy
**Files:** `mobile/scripts/with-build-lock.sh`
**Commit:** 8c81148
**Fix:** The holder PID is written to `$LOCK_DIR/pid`. A lock is stale only if that PID is dead (or has no pid file past a 30 s grace), so long builds keep their lock. Stale locks are broken by an atomic `mv` to a unique name instead of `rmdir`. Verified manually: normal run, dead-PID takeover, and mutual exclusion (second waiter blocked until first finished).

### WR-06: Reminder prefs and snooze not cleared on logout
**Files:** `frontend/lib/auth/session-cleanup.ts`, `frontend/lib/auth/session-cleanup.test.ts`
**Commit:** e8bbdb4
**Fix:** `kitcha:reminder-prefs` and `kitcha:reminder-snooze-until` added to `USER_SCOPED_STORAGE_KEYS`; a test asserts they equal the constants exported from `reminders/prefs`.

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint lib/api lib/auth`: 0 errors (warnings only, including one expected `no-location-assign-relative-destination` warning for the moved web redirect, which is unchanged behavior).
- `npx vitest run`: 1088 passed, 1 failed (`lib/rules/rank.bench.test.ts`, a timing performance gate unrelated to these changes).
- `mobile/scripts/frontend-build.sh web`: passes.

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
