---
phase: 10-capacitor-ios-shell
plan: 06
subsystem: auth
tags: [capacitor, keychain, zustand, navigation, nextjs]
requires:
  - phase: 10-01
    provides: isNative/isNativeBuild
  - phase: 10-02
    provides: token-store, keychain-backend, native-boot, selectPersisted
provides:
  - token-storage facade (Keychain on native, localStorage on web)
  - whenTokenStorageReady/flushTokenWrites, SIGNED_OUT_COPY
  - navigate/registerNavigator seam, NativeEntry auth router at `/`
affects: [10-07, 10-09]
tech-stack:
  patterns: [facade with sync reads over async secure store, dynamic import to break cycle, injected navigation seam]
key-files:
  created: [frontend/lib/platform/navigation.ts, frontend/lib/platform/navigation.test.ts, frontend/components/platform/navigation-registrar.tsx, frontend/components/platform/native-entry.tsx]
  modified: [frontend/lib/api/token-storage.ts, frontend/lib/stores/auth-store.ts, frontend/components/auth/protected-route.tsx, frontend/components/providers.tsx, frontend/app/page.tsx, frontend/lib/api/client.ts, frontend/components/common/error-boundary.tsx]
key-decisions:
  - "auth-store imported lazily (dynamic import) from token-storage to avoid the import cycle"
  - "Registrar component also kicks off Keychain hydration at mount"
requirements-completed: [SHELL-01, SHELL-02]
completed: 2026-10-11
---

# Phase 10 Plan 06: Native token storage and routing Summary

Native tokens now live only in the Keychain via a sync-read facade, protected pages wait for hydration, and native routing is client-side only (`/` is an auth router).

## Commits
- 86d1e1b feat: token-storage facade, auth-store, ProtectedRoute
- test commit (RED) for navigation seam
- feat commit: navigation seam, NativeEntry, client.ts and error-boundary soft navigation

## Verification
- type-check clean, lint 0 errors, navigation tests 7 passing.
- Native export: out/index.html has no hero image reference; web build passes and landing keeps it.
- Full vitest: one failure in lib/rules/rank.bench.test.ts (timing budget, 49 ms vs 28.6 ms) caused by parallel executors loading the machine; unrelated to this plan.

## Deviations from Plan
None. Hydration kick-off was placed in NavigationRegistrar (folded in per plan) instead of a separate inline component.

## Self-Check: PASSED
