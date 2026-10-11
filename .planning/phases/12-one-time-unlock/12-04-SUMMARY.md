---
phase: 12-one-time-unlock
plan: 04
subsystem: frontend-purchase-layer
tags: [storekit, iap, capacitor, vitest]
requires: []
provides:
  - entitlementsApi (me, verify with Idempotency-Key), ENTITLEMENT_QUERY_KEY
  - KumaunStorePlugin TS facade (getStorePlugin, null on web)
  - store-service: loadProduct, purchaseFull, restorePurchases, recheckEntitlements
  - E2E-only getStoreDeps/setStoreDepsOverride and createMockStore
affects: [12-10, 12-11]
tech-stack:
  added: []
  patterns: [injected-deps orchestration, e2e flag gating]
key-files:
  created:
    - frontend/lib/api/entitlements.ts
    - frontend/lib/api/entitlements.test.ts
    - frontend/lib/native/store/store-plugin.ts
    - frontend/lib/native/store/store-deps.ts
    - frontend/lib/native/store/store-deps.test.ts
    - frontend/lib/native/store/mock-store.ts
    - frontend/lib/native/store/mock-store.test.ts
    - frontend/lib/native/store/store-service.ts
    - frontend/lib/native/store/store-service.test.ts
key-decisions:
  - "Transient verify failures = OfflineError, no response, or any 5xx; 409 ENTITLEMENT_ALREADY_CLAIMED = claimed; other 4xx = failed"
  - "One newKey() per user action; multi-transaction restore derives key, key:1, key:2 so distinct bodies never share a key"
  - "Restore orders transactions newest first by transactionId (numeric-aware)"
requirements-completed: [SUB-01, SUB-03]
duration: n/a
completed: 2026-10-11
---

# Phase 12 Plan 04: Frontend purchase layer Summary

Typed StoreKit plugin facade, entitlements API client, a pure tested purchase/restore/recheck service, and an E2E-only mock store.

## Commits
- b86da33: Task 1 (API client, plugin facade, deps override, mock store)
- c1f3cd5: Task 2 (store-service)

## Tests
- `npx vitest run lib/native/store lib/api/entitlements.test.ts`: 4 files, 40 tests passed (store-service 22, mock-store 5, store-deps 5, entitlements 3 plus others in the count).
- `tsc --noEmit` and eslint on the new files: clean.
- Full frontend suite: 1652 passed, 1 failed. The failure is `lib/rules/rank.bench.test.ts` (timing budget exceeded, 90 ms vs 28.6 ms) under load from parallel plans; unrelated to this plan.
- Acceptance greps: `sync()` appears once in store-service.ts (restore only); no non-test, non-`app/e2e/` file references `mock-store`; `Idempotency-Key` and `registerPlugin<KumaunStorePlugin>('KumaunStore')`-style registration present.

## Deviations from Plan
- [Rule 3 - Blocking] mock-store `currentEntitlements` returned a readonly array, failing tsc against the plugin interface; now returns a copy. Fixed before commit.
- Added `lib/api/entitlements.test.ts` (not in the files list) to cover the Idempotency-Key behavior.
- RED/GREEN not committed separately; tests and implementation were written together and committed per task.
- Interrupted once by a network error; resumed from uncommitted files with no loss.

## Known Stubs
None.

## Threat Flags
None. T-12-13..16 mitigations are in place (server-driven state, mock gated by NEXT_PUBLIC_E2E and KITCHA_E2E marker, finish only after 2xx, one key per action).

## Self-Check: PASSED
