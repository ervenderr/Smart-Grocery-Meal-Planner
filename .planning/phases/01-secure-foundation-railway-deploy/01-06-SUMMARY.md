---
phase: 01-secure-foundation-railway-deploy
plan: 06
subsystem: frontend-deploy
tags: [nextjs, vercel, build-guard, smoke-test]
requires: ["01-02", "01-04", "01-05"]
provides:
  - "Production build guard for NEXT_PUBLIC_API_URL"
  - "Vercel frontend built against the Railway API"
key-files:
  modified:
    - frontend/next.config.ts
    - frontend/lib/constants/api-routes.ts
    - scripts/smoke-prod.sh
requirements-completed: [DEP-07]
status: partial - Task 3 (browser pass) pending the user
completed: 2026-10-08
---

# Phase 1 Plan 06: Frontend build guard and production verification Summary

`next build` now fails in the production phase without NEXT_PUBLIC_API_URL, and the live Vercel bundle points at the Railway API; the human browser pass (Task 3) is still pending.

## Tasks

| Task | Status | Commit |
| --- | --- | --- |
| 1. Vercel env var (human) | Done by user (Production + Preview, https://kitcha-api-production.up.railway.app) | n/a |
| 2. Guard, push, smoke test | Done | cd89ec9, 38d839d |
| 3. Browser pass | PENDING the user | n/a |

## Verification

- `env -u NEXT_PUBLIC_API_URL next build` exits 1 with "NEXT_PUBLIC_API_URL must be set"; with the var set the build exits 0. Lint (0 errors) and type-check pass.
- Vercel deployment for cd89ec9: state success (https://kitcha-9t8uazsk8-ervenderrs-projects.vercel.app). Build working implies Root Directory is correct.
- CI run 37709302007 for cd89ec9: success.
- Full `scripts/smoke-prod.sh`: checks 1-7 passed. Check 8 initially failed (see deviation); after the fix it passes: the bundle contains the Railway host and no `localhost:3001`.

## Deviations from Plan

**1. [Rule 1 - Bug] Smoke check 8 only inspected the landing page**
- **Issue:** The landing page HTML does not load the chunk containing API_BASE_URL, so check 8 reported a false failure. The Railway host is in the chunk shared by /login and /signup (verified manually; no bundle contains localhost:3001).
- **Fix:** scripts/smoke-prod.sh now scans /, /login and /signup chunks.
- **Verification:** check 8 re-run on its own (extracted block) to avoid registering another user against the auth rate limit. The full script was not re-run end to end after the fix; checks 1-7 passed in the earlier full run.
- **Commit:** 38d839d

The api-routes.ts edit was also reformatted by a hook on one unrelated line (ITEM route wrapping); harmless.

## Ready for Task 3

Open https://kitcha-ai.vercel.app in a private window: register, log out, log in, add/edit/delete a pantry item, reload to confirm persistence. In DevTools Network expect requests to kitcha-api-production.up.railway.app with 2xx and no CORS errors.

## Self-Check: PASSED
