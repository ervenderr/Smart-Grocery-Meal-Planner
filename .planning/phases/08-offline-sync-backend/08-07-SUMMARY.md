---
phase: 08-offline-sync-backend
plan: 07
subsystem: shopping
tags: [offline, idempotency, client-ids]
requires: [08-03]
provides:
  - POST /shopping/items accepts optional client UUID id (201 create, 200 replay, 409 CLIENT_ID_CONFLICT)
key-files:
  modified:
    - backend/src/modules/shopping/shopping.service.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.constants.ts
    - backend/src/types/shopping.types.ts
    - backend/tests/shopping-items.test.ts
  created:
    - backend/tests/shopping-client-ids.test.ts
requirements-completed: [SYNC-03]
completed: 2026-10-10
---

# Phase 8 Plan 07: Shopping Client IDs Summary

Shopping item creates accept an optional client UUID `id`; a pre-check under the list row lock makes retries idempotent without catching P2002 (which aborts a Postgres transaction).

## Client-id contract

- `POST /shopping/items` with `id` (UUID): new row -> 201; existing row owned by caller -> 200 with the existing row unchanged (new field values ignored; works even when the list is full); id owned by another user -> 409 `CLIENT_ID_CONFLICT` (no row data); non-UUID -> 400 VALIDATION_ERROR; no id -> unchanged (201, server id).
- PATCH does not accept `id` (create-only).
- Caveat: a replay whose original row was carried to a new list after finish returns the old row (Phase 11 outbox concern).

## Commits

- feat(08-07): idempotent shopping item create with client UUID ids

## Verification

jest (shopping-client-ids, shopping-items, shopping, shopping-validation): 76 passed. `tsc --noEmit`: exit 0.

## Deviations from Plan

**[Rule 1] Updated existing test** `shopping-items.test.ts` "ignores unknown body fields": it posted a literal `id` as an ignored field; `id` is now honored by design, so the `id` was removed from that payload.

## Self-Check: PASSED
