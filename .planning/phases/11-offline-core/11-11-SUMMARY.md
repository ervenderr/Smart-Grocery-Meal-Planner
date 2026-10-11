---
phase: 11-offline-core
plan: 11
subsystem: offline-writes
tags: [facade, outbox, shopping, pantry, optimistic, tdd]
requires: [11-07, 11-09, 11-10]
provides: [offlineWrite, offlineWriteMany, WriteOutcome, buildShoppingCreate, buildShoppingUpdate, buildShoppingDelete, buildPantryCreate, buildPantryUpdate, buildPantryQuickPatchOps, buildPantryDelete, changedFields, whenOfflineRuntime]
affects: [11-12, 11-13]
key-files:
  created:
    - frontend/lib/offline/facade.ts
    - frontend/lib/offline/facade.test.ts
    - frontend/lib/offline/ops/shopping-ops.ts
    - frontend/lib/offline/ops/pantry-ops.ts
    - frontend/lib/offline/ops/ops.test.ts
  modified:
    - frontend/lib/hooks/use-shopping-list.ts
    - frontend/lib/hooks/use-pantry.ts
    - frontend/components/pantry/add-pantry-item-modal.tsx
    - frontend/components/pantry/edit-pantry-item-modal.tsx
    - frontend/app/(app)/shopping/page.tsx
    - frontend/lib/offline/cache/query-persister.ts
    - frontend/lib/offline/runtime.ts
    - frontend/components/offline/offline-boot-gate.tsx
decisions:
  - "Persister skips writes while any outbox op is pending (or an enqueue is in flight), so SQLite only ever holds server-confirmed data and the boot fold cannot apply pantry.adjust twice. A later bootstrap refresh after the drain persists fresh data."
  - "Inverses follow 11-09: {} for create/adjust, { previous } for updates (patched keys only; missing values recorded as null), { item } for deletes."
  - "Quantity edits are always adjust deltas against the displayed quantity (round2); edit modal sends only changed fields (changedFields)."
  - "Queued writes never invalidate or call the modal onSuccess refetch; the drain reconciles and refreshes. Direct (web) behaviour is unchanged."
  - "Hook result types widened to T | null (null = queued); shopping page delete-undo falls back to the displayed item."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 11: Shopping and pantry writes through the facade Summary

Shopping add/edit/delete/check and pantry add/edit/quantity/expiry/delete now go through the outbox on native (with inverses, optimistic UI) and keep the exact legacy API calls on web.

## Commits
- 04aa394 fix: persist only server-confirmed cache; attach triggers after a late boot (11-10 risks)
- 1613caf feat: facade and pure op builders
- f8c165c feat: shopping and pantry hooks through the facade
- 05d6dcc feat: pantry add/edit modals through the facade, changedFields

## Verification
- `vitest run`: 127 files, 1437 passed; rank.bench perf gate failed once under load, passes alone (2/2), same as 11-10
- facade 6 tests, ops 14 tests; coverage facade.ts 100% lines, pantry-ops/shopping-ops 100% lines
- `tsc --noEmit` clean (final run); lint 0 errors (126 pre-existing warnings)
- Web `next build` OK; `mobile npm run build:ios` OK
- grep offlineWrite: use-shopping-list 4, use-pantry 3

## 11-10 risks handled
1. Double fold: persister `canPersist` guard (tested: no write containing optimistic state while an op is pending).
2. Boot timeout: gate now uses `whenOfflineRuntime`, attaching triggers and the initial refresh whenever the runtime appears, including after the 1.5 s fail-open. Window remains where writes made before the runtime exists take the direct path and fail offline; narrow, noted for 11-13/11-19.
3. 11-09 `{}` inverses written for pantry.create, pantry.adjust, shopping.item.create.

## Deviations from Plan
- [Rule 2] Added persister guard, runtime listener and gate change (above) per orchestrator instruction.
- [Rule 3] Edited `app/(app)/shopping/page.tsx` (delete-undo handles null result) because hook result type widened.
- Added `offlineWriteMany` (ordered multi-op edits) and `changedFields`.
- RED/GREEN committed together per task, as in prior plans.

## Known Stubs / Notes
- `app/(app)/pantry/page.tsx` still has a direct `pantryApi.delete` in the inline delete-confirm path (not in plan scope); not queued offline.
- COOK_PANTRY_KEY is not optimistically patched by modals; it is reconciled on drain.
- Pre-existing `lib/offline/status/actions.test.ts` tsc error from concurrent 11-12 was gone at final run.

## Threat Flags
None. T-11-32 (form validation + NewOpSchema), T-11-33 (adjust deltas), T-11-34 (web direct path, build verified) mitigated.

## Self-Check: PASSED
