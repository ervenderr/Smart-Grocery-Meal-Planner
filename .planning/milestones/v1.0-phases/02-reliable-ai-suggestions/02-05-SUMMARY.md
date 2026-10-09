---
phase: 02-reliable-ai-suggestions
plan: 05
subsystem: api
tags: [open-food-facts, usda, throttle, cache, express]
requires: [02-01, 02-04]
provides:
  - GET /api/v1/food/barcode/:code (Open Food Facts, ODbL attribution)
  - GET /api/v1/food/nutrition?query= (USDA FoodData Central, CC0 attribution)
  - createOutboundThrottle (pure sliding window, injectable clock)
affects: [02-06]
tech-stack:
  added: []
  patterns: [cache -> throttle -> upstream, Zod-validated untrusted upstream bodies, key only in header]
key-files:
  created:
    - backend/src/modules/food/outbound-throttle.ts
    - backend/src/modules/food/off.client.ts
    - backend/src/modules/food/usda.client.ts
    - backend/src/modules/food/food.attribution.ts
    - backend/src/modules/food/food.errors.ts
    - backend/src/modules/food/food.types.ts
    - backend/src/modules/food/food.service.ts
    - backend/src/modules/food/food.controller.ts
    - backend/src/modules/food/food.validation.ts
    - backend/src/modules/food/food.routes.ts
    - backend/tests/food-clients.test.ts
    - backend/tests/food-lookup.test.ts
  modified:
    - backend/src/app.ts
key-decisions:
  - "Cache TTL: found products and USDA results 30 days, not-found barcodes 24 hours; cached hits never use the outbound throttle"
  - "OFF throttle 12/min, USDA 600/hour, process-wide"
requirements-completed: [AI-07]
completed: 2026-10-09
---

# Phase 2 Plan 05: Open Food Facts and USDA lookups Summary

Authenticated server-side barcode and nutrition lookups with the required OFF User-Agent, process-wide outbound throttling, Postgres caching (including negative caching), graceful 503 without a USDA key, and an attribution object on every success and not-found response.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1 RED: failing tests | 5854054 | both suites failed on missing modules |
| 2 Throttle, clients, attribution | ee6e850 | food-clients 15/15, tsc clean |
| 3 Service, routes, app registration (GREEN) | b759cc8 | full suite 372/372, tsc clean, lint 0 errors |

## Deviations from Plan

**1. [Test adaptation] Error extras are top-level.** errorHandler spreads AppError `details` into the response body, so `retryAfterSeconds` and the not-found `attribution` appear at `body.retryAfterSeconds` / `body.attribution`, not under `body.details`. Tests were corrected in the GREEN commit; this matches the frontend contract fields (code, message, error, retryAfterSeconds).

**2. [Addition] Small extra files** `food.errors.ts` (FoodUpstreamError) and `food.types.ts` (shared types) were split out to keep files small.

Otherwise executed as written. No auth gates.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. Hosts are hard-coded, barcode is `^\d{8,14}$`, query is URL-encoded, the USDA key is only in the `X-Api-Key` header and a test asserts it is absent from URL, response and logger calls.

## Notes

- The nutrition query is passed through express-validator `.escape()` as the plan requested, so characters like `&` are HTML-escaped before the USDA search.
- Test Postgres 16 was a temporary local cluster on port 5605, stopped and removed.

## Self-Check: PASSED
