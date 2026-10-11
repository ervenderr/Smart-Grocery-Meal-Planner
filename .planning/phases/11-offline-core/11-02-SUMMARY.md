---
phase: 11-offline-core
plan: 02
subsystem: backend/cook
tags: [offline, cook, occurredAt, idempotency]
requires: [Phase 8 clampOccurredAt, Idempotency-Key middleware]
provides: [optional occurredAt on POST /cook/apply]
affects: [frontend offline outbox cook op]
key-files:
  created: [backend/tests/cook-occurred-at.test.ts]
  modified:
    - backend/src/modules/cook/cook.validation.ts
    - backend/src/modules/cook/cook.service.ts
    - backend/src/types/cook.types.ts
requirements: [OFF-06, OFF-07]
completed: 2026-10-11
---

# Phase 11 Plan 02: Cook apply occurredAt Summary

Optional ISO-8601 `occurredAt` on `POST /cook/apply`, clamped to [now-14d, now] with the existing `clampOccurredAt`, so a queued offline "Cooked it" records the tap time as the meal plan item's `cookedAt`.

## Commits
- 945fdc4: test(11-02) failing tests (RED: 3 of 7 failed)
- b8cd1b9 feat(11-02): validation, service, type change (GREEN)

## Verification
- 4 Jest suites (cook-occurred-at, cook-endpoints, mealplan-cooked, cook-mealplan): 50/50 pass
- `tsc --noEmit` clean; lint 0 errors (172 pre-existing warnings)
- No prisma/migration files touched; nothing deployed

## Decisions (flag to user)
- Only backend change in Phase 11: optional `occurredAt` on cook/apply. OFF-07 "mark" is the queued cook op (no new endpoint). Web IndexedDB fallback skipped.
- Not deployed; older servers ignore the field.

## Deviations from Plan
- [Rule 3] Added `occurredAt?: string` to `backend/src/types/cook.types.ts` (CookApplyInput lives there, not in the listed files). Controller needed no change because `matchedData` already passes the validated field through.

## Self-Check: PASSED
