---
phase: 12-one-time-unlock
plan: 09
subsystem: backend
tags: [iap, app-store-server-notifications, webhook, refund, tdd]
requires: [12-01, 12-02, 12-06]
provides:
  - handleAppStoreNotification / NotificationOutcome
  - POST /api/v1/webhooks/app-store (public, JWS-verified)
affects: [12-13]
tech-stack:
  added: []
  patterns: [dedupe insert and entitlement update in one transaction, createMany skipDuplicates for race-safe dedupe]
key-files:
  created:
    - backend/src/modules/entitlements/notifications.service.ts
    - backend/src/modules/entitlements/notifications.routes.ts
    - backend/src/modules/entitlements/notifications.validation.ts
    - backend/tests/app-store-webhook.test.ts
  modified:
    - backend/src/app.ts
key-decisions:
  - "Dedupe uses appStoreNotification.createMany({skipDuplicates}) (ON CONFLICT DO NOTHING) so a duplicate does not abort the Postgres transaction; count 0 means 'duplicate'"
  - "Revocation state follows notification type (REFUND/REVOKE force revoked, REFUND_REVERSED forces active) and ordering uses the notification signedDate"
requirements-completed: [SUB-02]
completed: 2026-10-11
---

# Phase 12 Plan 09: App Store Server Notifications V2 Summary

Refunds, revocations and reversals now update entitlements server-to-server through a public webhook authenticated only by Apple's JWS chain.

## Commits
- 2c44a81: notifications service and service-level tests
- 530a471: validation, route, app.ts mount, HTTP tests

## Tests
- app-store-webhook: 17 passed (11 service, 6 HTTP)
- Plan verify command (app-store-webhook + https-redirect + cors): 3 suites, 45 passed
- Regression with entitlements-claim and entitlements-verify: 3 suites, 41 passed
- `tsc --noEmit` clean; `npm run lint`: 0 errors (172 pre-existing warnings)

## Deviations from Plan
- [Rule 1 - Bug, test only] A test literal (12345678901234567890) tripped `no-loss-of-precision`; replaced with a smaller non-string number.
- Dedupe uses `createMany` with `skipDuplicates` rather than `create` + P2002 catch. The plan acceptance grep `appStoreNotification.create` still matches inside `$transaction`. Reason: a P2002 inside an interactive Postgres transaction aborts it.
- not_configured verification maps to 400 (as the plan says) rather than the 503 used by the verify route.
- Tests were written together with the service in one pass per task (no separate RED commits).

## Notes
- `apiLimiter` (100/15 min per IP) still applies to `/api/` before this route, as for all API routes; Apple traffic is sparse and a 429 is retried by Apple. If it ever matters, mount the webhook before `apiLimiter`.
- The 120/min webhook limiter is the shared user-scoped limiter, which falls back to the client IP since no user is attached.
- Owner step (for 12-13): register `https://<api-host>/api/v1/webhooks/app-store` for Production and Sandbox in App Store Connect. Not deployed.
- errorHandler.ts:66 lint error: NOT present at HEAD. `git blame` for that line shows an old (2025-11-13) comment line, `eslint` reports 0 errors repo-wide, and `git diff HEAD` on the file is empty. The only `no-loss-of-precision` error seen during this plan was in this plan's own test file (fixed above); the earlier report in 12-06 was likely from a transient state.

## Known Stubs
None.

## Threat Flags
None. T-12-36..T-12-40 mitigated as planned (JWS verification, UUID dedupe + signedDate ordering, limiter + size caps, shared transaction with 500 on DB error, identifier-only logs).

## Self-Check: PASSED
