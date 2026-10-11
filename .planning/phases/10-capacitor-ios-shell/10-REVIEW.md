---
phase: 10-capacitor-ios-shell
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 104
files_reviewed_list:
  - frontend/lib/api/client.ts
  - frontend/lib/api/token-storage.ts
  - frontend/lib/auth/keychain-backend.ts
  - frontend/lib/auth/native-boot.ts
  - frontend/lib/auth/token-store.ts
  - frontend/lib/stores/auth-store.ts
  - frontend/lib/stores/auth-persist.ts
  - frontend/lib/build/native-config.ts
  - frontend/lib/platform/navigation.ts
  - frontend/lib/reminders/route.ts
  - frontend/lib/reminders/native-scheduler.ts
  - frontend/lib/reminders/scheduler.ts
  - frontend/lib/reminders/use-reminders.ts
  - frontend/components/auth/protected-route.tsx
  - frontend/components/platform/native-entry.tsx
  - frontend/components/platform/navigation-registrar.tsx
  - frontend/components/reminders/reminder-runtime.tsx
  - frontend/components/e2e/e2e-runner.tsx
  - frontend/next.config.ts
  - mobile/scripts/build-ios.sh
  - mobile/scripts/e2e-smoke.sh
  - mobile/scripts/frontend-build.sh
  - mobile/scripts/verify-bundle.sh
  - mobile/scripts/with-build-lock.sh
  - mobile/scripts/lib/e2e-account.sh
  - "(remaining files in p10files.txt skimmed; no findings; iOS generated project files skipped)"
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-11
**Depth:** standard (cross-file focus on auth/token and navigation)
**Files Reviewed:** 104 in scope (about 45 read in full; the rest skimmed or skipped as generated)
**Status:** issues_found

## Summary

The areas you flagged mostly hold up.

- **Token leakage:** access and refresh tokens never reach localStorage on native. `selectPersisted` drops them, boot scrubs legacy copies, and no log line prints a token value.
- **E2E in release builds:** the flag is gated by `assertNativeEnv`, the `pageExtensions` trick, and `verify-bundle.sh`.
- **Notification deep links:** `ALLOWED_NOTIFICATION_ROUTES` is a strict `z.enum` and it is the only path into `router.push`.
- **Permission prompt:** reachable only through `enable()`, and `schedule()` is guarded by `checkPermissions()`.
- **Shell scripts:** credentials travel through `env.*` in jq and stdin to curl, never argv.

There is one real defect: the session-expiry path leaves the native auth store "authenticated". It causes a redirect loop and leaves reminders scheduled. There are also several robustness and build-hygiene warnings.

## Critical Issues

### CR-01: Session expiry leaves auth store authenticated; native login/dashboard redirect loop and reminders not cancelled

**File:** `frontend/lib/api/client.ts:46-53` (cross-file: `frontend/app/(auth)/login/page.tsx:16-20`, `frontend/components/reminders/reminder-runtime.tsx:84-89`)

**Issue:** `onSessionExpired` calls `clearTokens()` and `clearUserSessionState(...)`, then navigates to `/login/`. It never calls `useAuthStore.getState().clearAuth()`, so the zustand store keeps `isAuthenticated: true` and `token`.

On native this is a client-side navigation with no reload. I traced the consequences:

1. `LoginPage` sees `isAuthenticated === true`, renders `null`, and runs `router.push('/dashboard')`.
2. `ProtectedRoute` also sees `isAuthenticated` and `token` set, so it lets the dashboard render.
3. The dashboard's queries fire with no token and get 401.
4. The refresh token is gone, so the outcome is "definitive" and `onSessionExpired` runs again. The user bounces between login and dashboard and can never sign in.

The `ReminderRuntime` logout-cancel effect keys off `isAuthenticated` flipping to false, so on expiry the OS-scheduled reminders (pantry item names) stay on the lock screen for a signed-out user.

On web the hard reload re-hydrates the persisted `isAuthenticated: true` and `token`, so the same loop exists there. This behavior came from 08-10, but the new native navigation and reminder work make it user-visible.

**Fix:**
```ts
// client.ts
import { useAuthStore } from '@/lib/stores/auth-store';
...
onSessionExpired: () => {
  useAuthStore.getState().clearAuth(); // clears tokens, query cache, persisted state, flips isAuthenticated
  if (typeof window !== 'undefined') {
    if (isNative()) navigate('/login/', { replace: true });
    else window.location.href = '/login';
  }
},
```
Check for an import cycle (auth-store imports token-storage and react-query, not client, so this is fine). Add a regression test that asserts `isAuthenticated` is false after a definitive refresh failure.

## Warnings

### WR-01: Keychain plugin configuration failure is cached forever

**File:** `frontend/lib/auth/keychain-backend.ts:24-32`

**Issue:** `ready ??= configure()` is only reset when `configure()` resolves to `null`. If `setKeyPrefix` or `setDefaultKeychainAccess` rejects, `ready` stays a rejected promise. Every later `get`, `set`, and `remove` rethrows the same error without retrying, so the session can never be persisted until the app restarts.

**Fix:**
```ts
const boxedPlugin = async () => {
  try {
    const boxed = await (ready ??= configure());
    if (boxed) return boxed;
  } catch (e) {
    ready = null;
    throw e;
  }
  ready = null;
  throw new Error('Secure storage unavailable');
};
```

### WR-02: Transient Keychain read failure is memoized and shown as "signed out"

**File:** `frontend/lib/api/token-storage.ts:96-104`, `frontend/lib/auth/token-store.ts:63-76`, `frontend/components/auth/protected-route.tsx:34-38`

**Issue:** The accessibility class is `whenUnlockedThisDeviceOnly`. If the app launches or prewarms while the device is locked, the Keychain read fails. Both `initPromise` and `readyPromise` cache `{ readFailed: true }` for the process lifetime. `ProtectedRoute` then toasts "You've been signed out" and redirects to login, although the tokens are intact. There is no retry on `resume`.

**Fix:** Don't memoize a failed init. Reset `initPromise` and `readyPromise` on failure, and re-run hydration on the Capacitor `resume` event. Alternatively, use `afterFirstUnlockThisDeviceOnly` for the refresh token.

### WR-03: First-launch heuristic can log users out whenever WebView localStorage is purged

**File:** `frontend/lib/auth/native-boot.ts:54-66`

**Issue:** "No install marker in localStorage" is treated as a fresh install, and Keychain tokens are deleted. WKWebView localStorage can be evicted (storage pressure, Safari/WebKit data clearing) while the app stays installed. The result is a silent logout. Separately, if `setItem(INSTALL_MARKER_KEY)` fails, every launch wipes the Keychain.

**Fix:** Keep the install marker somewhere that survives localStorage eviction, for example `@capacitor/preferences` (UserDefaults, which is removed on uninstall like the sandbox) or a Keychain key written with a sandbox-side companion. At minimum, don't clear the Keychain when the marker write failed. Document the eviction trade-off.

### WR-04: E2E build output containing credentials is not cleaned up

**File:** `mobile/scripts/e2e-smoke.sh:47-62`, `mobile/scripts/frontend-build.sh:46-52`

**Issue:** The cleanup trap wipes only `frontend/out` and `ios/App/App/public`. The E2E credentials are inlined as `NEXT_PUBLIC_E2E_EMAIL` and `NEXT_PUBLIC_E2E_PASSWORD` into these locations, and none of them are wiped:
- `frontend/.next/` (chunks and cache)
- `mobile/build/.../App.app/public/` (the built Simulator app)
- the app installed in the Simulator after the uninstall, if uninstall fails

When the caller supplies `E2E_EMAIL` and `E2E_PASSWORD` (`E2E_CREATED=0`), those are a real account's password. The password stays on disk in plaintext JS. `mobile/build/` is gitignored, but `frontend/.next` is not wiped either.

**Fix:** In `cleanup`, also run `rm -rf "$frontend_dir/.next" "$mobile_dir/build"` under the lock. Better, discourage supplying real credentials: refuse a supplied account unless `--allow-supplied-account` is passed.

### WR-05: Stale-lock removal in with-build-lock.sh is racy and can break mutual exclusion

**File:** `mobile/scripts/with-build-lock.sh:28-40`

**Issue:** The lock has two problems.
- **TOCTOU race:** Two waiters can both see the lock as older than `STALE_SEC`. Waiter A runs `rmdir` and then `mkdir` successfully. Waiter B then runs `rmdir` and removes A's fresh lock. B's `mkdir` succeeds and both builds run concurrently, which is exactly the `.next` and `out` collision this lock exists to prevent.
- **Stale threshold vs. build length:** `STALE_SEC=900` is based on directory mtime, which is never refreshed. A legitimate native build plus `npm ci` plus xcodebuild longer than 15 minutes has its lock stolen.

**Fix:** Write the holder PID into `$LOCK_DIR/pid`. Treat the lock as stale only if the PID is dead (`kill -0`). Alternatively use `flock` or `shlock`, or atomically `mv` the stale directory to a unique name instead of `rmdir`.

### WR-06: Reminder prefs and snooze are not cleared on logout or account delete

**File:** `frontend/lib/auth/session-cleanup.ts:5` (`USER_SCOPED_STORAGE_KEYS`), `frontend/lib/reminders/prefs.ts:5-6`

**Issue:** `kitcha:reminder-prefs` (`enabled: true`) and the snooze key persist across users on the same device. User B logging in inherits "reminders enabled", and `ReminderRuntime` schedules notifications from B's pantry as soon as B authenticates. The OS permission is already granted, and B never saw the opt-in explainer. This weakens the "explicit opt-in" gating the phase aims for.

**Fix:** Add `REMINDER_PREFS_KEY` and `REMINDER_SNOOZE_KEY` to `USER_SCOPED_STORAGE_KEYS`. Alternatively, namespace them by user id.

## Info

### IN-01: Zustand `token` goes stale after a silent refresh
**File:** `frontend/lib/api/client.ts:30-38`, `frontend/lib/stores/auth-store.ts`
**Issue:** `writeTokens: setTokens` updates the token store but not `useAuthStore.token`. State and the Keychain-backed token diverge until the next hydrate. Only truthiness is checked today, so this is latent.
**Fix:** After a refresh, call `useAuthStore.setState({ token })` (or `syncFromTokenStore`).

### IN-02: Inconsistent login paths (`/login` vs `/login/`) and a magic 100 ms hydration timer
**File:** `frontend/components/auth/protected-route.tsx:30-31,40-49`, `frontend/lib/api/client.ts:50`
**Issue:** `ProtectedRoute`, `use-logout.ts`, and the login page use `/login`. The client uses `/login/` (the export has `trailingSlash: true`). `ProtectedRoute` also waits `setTimeout(..., 100)` to "wait for hydration" even though `whenTokenStorageReady` has already resolved. The delay is redundant on native.
**Fix:** Use a single `LOGIN_PATH` constant. Drop the timer for native (it is only needed for the persist rehydrate on web).

### IN-03: `e2e_delete_account` is unguarded when called directly
**File:** `mobile/scripts/lib/e2e-account.sh:51-54`
**Issue:** The function deletes whatever `E2E_EMAIL`/`E2E_PASSWORD` are set. Safety depends entirely on the caller checking `E2E_CREATED=1`. A future caller that omits the check would delete a user-supplied real account.
**Fix:** Return early inside the function when `E2E_CREATED != 1`.

### IN-04: Release verification of E2E credential leakage is opt-in
**File:** `mobile/scripts/verify-bundle.sh:79-83`
**Issue:** The password-leak scan runs only when `E2E_PASSWORD` is in the environment. `NEXT_PUBLIC_E2E_EMAIL` is never checked. `build-ios.sh` (non-E2E) does not call `verify-bundle.sh`, so a release export can be produced without the gate. A stray exported `NEXT_PUBLIC_E2E=1` in the shell would also yield an E2E build outside `--e2e`. `assertNativeEnv` allows it, since it only requires `BUILD_TARGET=native`.
**Fix:** In the non-E2E build path of `frontend-build.sh`, `unset NEXT_PUBLIC_E2E NEXT_PUBLIC_E2E_EMAIL NEXT_PUBLIC_E2E_PASSWORD`. Chain `verify-bundle.sh` into the release flow.

### IN-05: Notification tap while signed out drops the target route
**File:** `frontend/components/reminders/reminder-runtime.tsx:92-103`
**Issue:** The tap listener lives in `ReminderRuntime`, which is mounted inside `ProtectedRoute`. A tap that arrives before auth hydrates (cold start) either relies on Capacitor retaining the event or is lost. When the user is signed out, `router.push('/pantry/?...')` is replaced by the login redirect, and the intent is not restored after login. The allowlist itself is sound.
**Fix:** Register the listener at app root, store the pending route, and consume it after authentication.

### IN-06: Type-safety and quality nits
**File:** `frontend/lib/api/client.ts:112-150`, `frontend/components/e2e/e2e-runner.tsx:78,95`
**Issue:** `get/post/put/patch/delete` accept `any` for config and data. `e2e-runner` logs via `console.log` (intentional for the log scraper, but guarded only by build-time file inclusion) and uses `as unknown as` casts for the plugin types.
**Fix:** Type the config as `AxiosRequestConfig`. Leave the E2E logging as is, but note that it relies on `page.e2e.tsx` being excluded from releases (verified by `verify-bundle.sh`).

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
