---
phase: 11-offline-core
plan: 19
subsystem: offline-session
tags: [auth, session, outbox, cache, tdd]
requires: [11-10, 11-16]
provides: [planUserTransition, applyUserTransition, session-hooks, deleteForUser, foldPendingOps]
requirements: [OFF-09]
key-files:
  created:
    - frontend/lib/offline/session/session-hooks.ts
    - frontend/lib/offline/session/session-hooks.test.ts
    - frontend/lib/offline/session/user-scope.ts
    - frontend/lib/offline/session/user-scope.test.ts
    - frontend/lib/offline/session/apply-transition.ts
    - frontend/lib/offline/session/apply-transition.test.ts
    - frontend/lib/offline/session/runtime-session.test.ts
  modified:
    - frontend/lib/stores/auth-store.ts
    - frontend/lib/api/session-expiry.ts
    - frontend/lib/offline/runtime.ts
    - frontend/lib/offline/boot.ts
    - frontend/lib/offline/outbox/store.ts
    - frontend/lib/offline/outbox/store.test.ts
    - frontend/lib/auth/use-logout.ts
    - frontend/components/settings/delete-account-sheet.tsx
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 19: Session-safe offline state Summary

Auth events now follow a tested plan: expiry keeps cache and queued ops (paused), same-user re-login hydrates and resumes, a different user wipes the cache and parks the old user's ops untouched, logout wipes the cache but keeps ops, and account deletion wipes the cache and deletes that user's ops.

## Commits
- 04f6528 feat(11-19): session hooks and user transition planner
- 9065f49 feat(11-19): executor, auth store hooks, runtime and boot wiring, store.deleteForUser

## Verification
- Full `vitest run`: 139 files, 1516 passed, 0 failed (rank.bench passed this run)
- `lib/offline/session/**` coverage: 100% lines, 98.3% statements, 93.1% branches; 25 tests in session dir (planner 8, hooks 4, executor 9, runtime integration 4)
- `tsc --noEmit` clean; lint 0 errors (129 pre-existing warnings)
- Web `next build` OK (needs `NEXT_PUBLIC_API_URL` set, as before)

## Decisions
- Runtime subscribes to `useAuthStore` (static import works in node tests) and serializes transitions; persister is suspended in `beforeClear` and resumed once all transitions finish, or on a microtask if no user id change followed (same-user setAuth).
- cache_meta `user_id` was never written before this plan; `set-meta-user` now records it. At boot, `hydrateAll` (already user-filtered) runs even when meta is null, so existing installs keep their cache. Boot drops the `refresh` action (the boot gate already refreshes).
- `persister.start()` now runs at boot even with no signed-in user, so a later sign-in is persisted.
- `resume-user-ops` also kicks the drain.

## Deviations from Plan
- [Rule 2] Edited `lib/auth/use-logout.ts` and `components/settings/delete-account-sheet.tsx` (outside the plan file list) to set intents `logout` and `deleted`; without them the default `expired` intent would never wipe on explicit logout or deletion.
- [Rule 2] Added `store.deleteForUser(userId)` to the outbox store (was missing) with a test.
- Added `runtime-session.test.ts` (real runtime plus auth store end to end).
- RED/GREEN committed together per task, as in prior plans.

## Known gap (not resolved, reported)
Writes made before the offline runtime exists still take the direct path in `facade.ts` (`offlineWrite` with a null runtime) and fail offline. That is facade/boot-gate territory, outside this plan's files; a safe fix would be to have the facade wait for the boot (bounded) or queue to a pre-runtime buffer. Not changed here.

## Known Stubs
None.

## Threat Flags
None. T-11-55 to T-11-58 mitigated and tested.

## Self-Check: PASSED
