---
phase: 11-offline-core
plan: 09
subsystem: offline-reconcile
tags: [reconcile, outbox, rollback, zod, tdd]
requires: [11-04, 11-05]
provides: [InverseSchemas, parseInverse, reapplyForKey, applyResult, rollbackOp, CacheWrites]
affects: [11-10, 11-11]
key-files:
  created:
    - frontend/lib/offline/reconcile/inverse.ts
    - frontend/lib/offline/reconcile/reapply.ts
    - frontend/lib/offline/reconcile/apply-result.ts
    - frontend/lib/offline/reconcile/rollback.ts
    - frontend/lib/offline/reconcile/cache-writes.ts
    - frontend/lib/offline/reconcile/fixtures.test-helper.ts
decisions:
  - "Invalid or missing inverse (including null for kinds whose contract is {}) yields needsRefetch true and no writes."
  - "applyResult accepts the item directly or wrapped as {item}/{data}; it must carry the op's entity id, otherwise no writes (replace by id only)."
  - "Pantry writes always target both PANTRY_ALL_KEY and COOK_PANTRY_KEY; every update tolerates undefined or mismatched old data by returning it unchanged."
  - "shopping.item.delete rollback re-appends the item at list end (original index is not part of the inverse contract)."
  - "cook.apply by recipeId has no meal-plan write on rollback (fold only marks mealPlanItemId targets)."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 09: Outbox/cache reconciliation Summary

Pure reconciliation layer: re-apply pending ops over fresh snapshots by canonical key, patch the cache with authoritative server rows, and roll back from persisted inverses.

## Commits
- fe6dce0 feat(11-09): inverse schemas and reapplyForKey
- ae2fa6c feat(11-09): applyResult and rollbackOp reconciliation

## Verification
- `vitest run lib/offline/reconcile`: 21 tests passing (reapply 6, inverse 2, apply-result 5, rollback 8)
- Coverage lib/offline/reconcile/**: 100% lines, 99.07% statements, 90% branches
- `tsc --noEmit`: zero errors in reconcile files (3 pre-existing errors in `lib/offline/transport.test.ts` from another concurrent plan)
- lint: 0 errors
- Inputs deep-frozen in tests; no mutation

## Deviations from Plan
- Added `cache-writes.ts` (shared CacheWrites helpers) and `fixtures.test-helper.ts`; `inverse.test.ts` added for parseInverse. RED and GREEN were committed together per task (RED run confirmed by missing-module failures).

## Known Stubs
None.

## Threat Flags
None. T-11-27 (zod parseInverse, invalid -> refetch) and T-11-28 (replace by id only, unknown shapes -> no writes) mitigated.

## Self-Check: PASSED
