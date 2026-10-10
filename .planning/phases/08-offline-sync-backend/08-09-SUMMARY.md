---
phase: 08-offline-sync-backend
plan: 09
subsystem: pantry
tags: [offline, delta, client-ids, idempotency]
requires: [08-02, 08-05, 08-08]
provides:
  - POST /pantry/:id/adjust (delta, clamped [0, 99999], Decimal math under lockUserPantry)
  - POST /pantry client UUID ids (201 / 200 replay / 409 / 410)
  - notifyLowStock shared notifier
key-files:
  created:
    - backend/src/modules/pantry/pantry.adjust.ts
    - backend/src/modules/pantry/pantry.low-stock.ts
    - backend/tests/pantry-adjust.test.ts
    - backend/tests/pantry-client-ids.test.ts
  modified:
    - backend/src/modules/pantry/pantry.service.ts
    - backend/src/modules/pantry/pantry.validation.ts
    - backend/src/modules/pantry/pantry.controller.ts
    - backend/src/modules/pantry/pantry.routes.ts
    - backend/src/types/pantry.types.ts
requirements-completed: [SYNC-01, SYNC-02, SYNC-03]
completed: 2026-10-10
---

# Phase 8 Plan 09: Pantry adjust and client ids Summary

Queued offline quantity taps now apply as summed deltas under the per-user pantry lock, and pantry creates are retry-safe via client UUIDs.

## Commits

- 73aef2b feat(08-09): add POST /pantry/:id/adjust with locked Decimal delta math
- feat(08-09): idempotent pantry create with client UUID ids

## Contract

`POST /api/v1/pantry/:id/adjust` body `{ delta: number|string, unit?: string }`. delta: non-zero, max 2 decimals, |delta| <= 99999; unit optional (converted within the same family, e.g. 500 g on a kg item = +0.5).
200: full PantryItemResponse (quantity as decimal string) plus `clamped: boolean` (true when result was clamped to 0 or 99999).
Errors: 400 validation (bad delta/id/unit), 400 `UNIT_MISMATCH` (different unit family), 404 (unknown, foreign or soft-deleted item), 429 limiter. Idempotency-Key supported: replay returns the same response with `Idempotency-Replayed: true`, applied once.

`POST /api/v1/pantry` optional `id` (UUID): new -> 201; existing own live row -> 200 original row unchanged (new values ignored); another user's id -> 409 `CLIENT_ID_CONFLICT` (generic, no data); own soft-deleted id -> 410 `CLIENT_ID_DELETED` (not resurrected); non-UUID -> 400; no id -> 201 server id.

## Verification

jest pantry-adjust (14), pantry-client-ids (6), pantry, pantry-barcode, pantry-quick-edit, idempotency: all pass; `tsc --noEmit` clean. pantry.service.ts 413 lines.

## Deviations from Plan

None.

## Self-Check: PASSED
