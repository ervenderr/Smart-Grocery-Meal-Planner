---
phase: 07-store-readiness
plan: 06
subsystem: backend/users
tags: [account-deletion, store-readiness, prisma, rate-limit, tdd]
requires: [07-01]
provides: ["DELETE /api/v1/users/me hard delete with password re-auth"]
affects: [frontend delete-account UI (07-05 contract)]
key-files:
  created:
    - backend/src/modules/users/account-deletion.service.ts
    - backend/src/modules/users/account-deletion.limiter.ts
    - backend/tests/account-deletion.test.ts
    - backend/tests/helpers/user-owned-fixtures.ts
  modified:
    - backend/src/modules/users/users.routes.ts
    - backend/src/modules/users/users.controller.ts
    - backend/src/modules/users/users.validation.ts
    - backend/src/modules/users/users.service.ts
decisions:
  - "Wrong password returns 403 INVALID_PASSWORD (not 401) so the client does not log out"
  - "Existing soft-deactivate DELETE /account kept unchanged"
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 07 Plan 06: Hard account deletion Summary

`DELETE /api/v1/users/me` permanently deletes a user and everything they own in one transaction (plan items, then ai_usage, then user with cascade), with bcrypt re-auth, a 403 wrong-password response and a 5-failures/15-min per-user limiter.

## Commits
- c51c61c test(07-06): add failing account deletion tests (RED; failed to compile, limiter module missing)
- cf3ab35 feat(07-06): hard account deletion endpoint (GREEN)

## Results
- `tests/account-deletion.test.ts` (7) and `tests/users.test.ts` pass (49 total); tsc clean; eslint 0 errors (pre-existing `any` warnings in the controller).
- Coverage: account-deletion.service.ts 94%, account-deletion.limiter.ts 100% lines.
- Covers: RESTRICT regression (plan item referencing the user's own recipe), ai_usage `user:<id>` removed while B's rows and the `global` row survive, 403 INVALID_PASSWORD with nothing deleted, 400 on missing/empty password, 401 unauthenticated, old JWT and login fail after deletion, 429 ACCOUNT_DELETE_RATE_LIMITED, and a DMMF-driven completeness test ("No deletion fixture for model X").
- Removed the unrouted unsafe `usersService.deleteAccount` (no other callers).

## Deviations from Plan
None. RED was a compile failure (missing limiter import) rather than assertion failures.

## Known Stubs
None.

## Self-Check: PASSED
