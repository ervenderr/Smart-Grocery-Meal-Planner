---
phase: 11-offline-core
plan: 15
subsystem: offline-ui-wiring
tags: [cook, finish-trip, idempotency, queue, lock]
requires: [11-11, 11-12, 11-14]
provides: [directThenQueue, isQueueableFailure, queueCook, OfflineCookBody, FinishOutcome]
key-files:
  created:
    - frontend/lib/offline/direct-or-queue.ts
    - frontend/lib/offline/direct-or-queue.test.ts
    - frontend/components/cook/queue-cook.ts
    - frontend/components/cook/offline-cook-body.tsx
    - frontend/lib/offline/queue-cook.test.ts
  modified:
    - frontend/lib/api/cook.ts
    - frontend/lib/api/shopping.ts
    - frontend/types/shopping.types.ts
    - frontend/lib/hooks/use-finish-shopping.ts
    - frontend/lib/hooks/use-shopping-list.ts
    - frontend/app/(app)/shopping/page.tsx
    - frontend/components/cook/cooked-it-sheet.tsx
decisions:
  - "Copy as specified in the plan (offline body, 'Mark as cooked', queued toasts, finish lock message)."
  - "Lock check runs in each item mutation's onMutate (before the optimistic change); a FinishLockedError suppresses the generic error toast so only the lock message shows."
  - "Optimistic effect of a queued op is folded from the OutboxOp returned by runtime.enqueue."
  - "Offline cook default servings: plannedServings, else cached recipe servings, else 1."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 15: Queued Cooked it and Finish trip UI Summary

Cooked it (recipes and meal plan items) and Finish trip now queue when offline, and online calls carry an Idempotency-Key and fall back to the queue with the same key on network failure or timeout. Web behavior is unchanged (all new paths gated on getOfflineRuntime()).

## Commits
- 6ce7829 directThenQueue helper, Idempotency-Key support in cookApi.apply / shoppingApi.finish, FinishShoppingInput.occurredAt
- 1cacdf2 queued finish trip (FinishOutcome) and shopping list lock
- 11773a7 offline Cooked it sheet and idempotent online cook

## Verification
- direct-or-queue tests: 7 passing; queue-cook tests: 2 passing
- Full `vitest run`: 1483 passed, 1 failed (rank.bench perf gate, load-flaky, pre-existing, passes alone per 11-10/11-11)
- `tsc --noEmit` clean; lint 0 errors (127 warnings, pre-existing)
- Web `NEXT_PUBLIC_API_URL=https://example.invalid npm run build` OK; `mobile npm run build:ios` OK
- cooked-it-sheet.tsx 340 lines (limit 400)

## Deviations from Plan
- Extracted OfflineCookBody (offline-cook-body.tsx) and queueCook (queue-cook.ts) into components/cook, as allowed.
- queue-cook test lives in lib/offline/ because vitest only includes lib/**.
- Lock helper lives in use-shopping-list.ts (not a separate module) to keep the isFinishPending wiring there.
- Plan listed shopping.finish `resolved: null`; omitted since only the idempotencyKey is needed.
- RED/GREEN committed together per task, as in prior plans.

## Known Stubs / Notes
- Conflict display (meal already cooked elsewhere) relies on the 11-12 Pending changes sheet and the 11-14 executor's ALREADY_COOKED 409; no new UI added here.
- The backend must honor `occurredAt` and the Idempotency-Key header on /cook/apply and /shopping/finish (executors from 11-14 already send them).

## Threat Flags
None. T-11-44 (same key for direct call and queued fallback, resolved body stored verbatim), T-11-45 (isFinishPending lock), T-11-46 (runtime-gated; web build verified) mitigated.

## Self-Check: PASSED
