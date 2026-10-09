---
phase: 04-persistent-shopping-list
plan: 04
subsystem: api
tags: [express, prisma, express-validator, rate-limit, shopping]
requires: ["04-01"]
provides:
  - "POST /api/v1/shopping/items, PATCH/DELETE /api/v1/shopping/items/:itemId"
  - "inferCategory, normalizeUnit, coerceUnit"
  - "shoppingLimiter (600/15min per user) and apiLimiter skip for /api/v1/shopping"
affects: [04-05, 04-06, 04-11]
key-files:
  created:
    - backend/src/modules/shopping/shopping.category.ts
    - backend/src/modules/shopping/shopping.units.ts
    - backend/src/modules/shopping/shopping.validation.ts
    - backend/tests/shopping-category.test.ts
    - backend/tests/shopping-units.test.ts
    - backend/tests/shopping-items.test.ts
  modified:
    - backend/src/modules/shopping/shopping.service.ts
    - backend/src/modules/shopping/shopping.controller.ts
    - backend/src/modules/shopping/shopping.routes.ts
    - backend/src/middleware/rateLimiter.ts
    - backend/tests/rate-limiter.test.ts
key-decisions:
  - "update/delete lock the user's active list first, then do the ownership-scoped lookup; a completed list yields null from the lock query so edits racing a finish return 404"
  - "Prisma P2025 mapped to 404 SHOPPING_ITEM_NOT_FOUND; all not-found cases share one message"
  - "Explicit null for notes/cents/category is carried through from req.body because express-validator drops optional nulls from matchedData"
requirements-completed: [SHOP-02, SHOP-04]
completed: 2026-10-09
---

# Phase 4 Plan 04: Shopping item endpoints Summary

Item create/edit/check/delete with strict bounds, ownership checks under the list row lock, a 300-item cap, server-side category inference and a dedicated per-user shopping limiter that the global limiter skips.

## Commits
- `test(04-04)` category/units tests, then `feat(04-04): add inferCategory and unit normalization`
- `test(04-04)` item endpoint tests, then `b144a92` feat item endpoints, `de0301a` fix (lint)
- `5e2cea0` test limiter, `9809120` feat limiter

## Verification
- Full backend suite: 34 suites, 518 tests pass. `tsc --noEmit` clean. Lint: 0 errors (143 pre-existing-style warnings).
- Tested: bounds, unit normalization (pcs -> pieces, Clove kept, `<script>` rejected), sanitization ("Mac & cheese"), mass-assignment ignored, 300 cap, cross-user/completed/unknown 404 with identical body, delete twice (sequential and concurrent), edit after finish, edit racing a finish (separate transaction holding FOR UPDATE), undo of a "clove" item, 105 sequential shopping requests not throttled, SHOPPING_RATE_LIMITED per user id.
- `shopping.service.ts` is 143 lines.

## Deviations from Plan
**1. [Rule 1 - Bug] Null clears dropped by matchedData.** `optional({ nullable: true })` fields sent as null were missing from `matchedData`, so PATCH could not clear notes/costs. Fixed in the controller by carrying explicit nulls from `req.body`; a test covers it.
**2. [Rule 1 - Lint] `no-control-regex`** on the control-char sanitizer; added an intentional eslint-disable (separate `fix` commit).

The objective's "shopping.units" is delivered (`shopping.units.ts`, which the plan lists in Task 1).

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model.

## Housekeeping
Temporary Postgres (port 5704) stopped and removed. Nothing pushed; STATE/ROADMAP/REQUIREMENTS untouched.

## Self-Check: PASSED
