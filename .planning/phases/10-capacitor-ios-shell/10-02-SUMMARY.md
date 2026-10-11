---
phase: 10-capacitor-ios-shell
plan: 02
subsystem: auth
tags: [keychain, token-store, zustand-persist, capacitor-secure-storage, tdd]
requires: ["10-01"]
provides:
  - "createTokenStore(backend): sync reads, async init, ordered write-through"
  - "createKeychainBackend(): Keychain SecureBackend (kitcha_ prefix, whenUnlockedThisDeviceOnly)"
  - "runNativeBoot: stale-Keychain guard and legacy localStorage scrub"
  - "selectPersisted(state, native): token-free persist payload on native"
affects: [10-06, 10-10]
key-files:
  created:
    - frontend/lib/auth/token-store.ts
    - frontend/lib/auth/token-store.test.ts
    - frontend/lib/auth/keychain-backend.ts
    - frontend/lib/auth/native-boot.ts
    - frontend/lib/auth/native-boot.test.ts
    - frontend/lib/stores/auth-persist.ts
    - frontend/lib/stores/auth-store-native.test.ts
  modified: []
requirements-completed: [SHELL-02]
completed: 2026-10-11
---

# Phase 10 Plan 02: Native secure token storage core Summary

Pure, unit-tested core for SHELL-02: an in-memory token store with synchronous reads and ordered Keychain write-through, a Keychain adapter, a first-launch boot scrub, and a native-safe zustand partialize. No existing file was modified; plan 06 wires these in.

## Commits
- RED: `test(10-02)` failing tests for all three test files
- GREEN task 1: `feat(10-02)` token store and Keychain backend
- GREEN task 2: `feat(10-02)` native boot and persist selector (also reworded a comment in token-store.ts so the "no window/localStorage" grep is clean)

## Results
- 26 tests pass in lib/auth + lib/stores (11 token-store, 8 native-boot, 4 auth-persist, plus the existing suite there). Type-check and eslint clean for all plan files.
- Plugin API confirmed from installed definitions: `setKeyPrefix`, `setDefaultKeychainAccess`, `get(key, convertDate)`, `set(key, data, convertDate)`, `remove`; `KeychainAccess.whenUnlockedThisDeviceOnly` exists (assumption A6 holds, no fallback needed). iCloud sync never enabled.
- Threats T-10-06..T-10-11 mitigated as specified (tests cover token absence in persisted payload and logs, first-launch Keychain clear, corrupt auth-storage removal; backend rejects on web).

## Deviations from Plan
- [Design detail] `init()` does not overwrite a snapshot already changed by `set()`/`clear()` before init finished, so an early login is never clobbered by the late Keychain read.
- native-boot also tolerates `remove` rejections on first launch (logs message only, still sets marker).

## Deferred / Out of scope
- Full `vitest run` and `tsc` currently report failures only in `lib/native/haptics.test.ts` and `lib/native/share.test.ts` (RED tests owned by parallel plans whose implementations are not yet written). Not touched.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
All 7 files exist; RED and both GREEN commits are in git log.
