---
phase: 12-one-time-unlock
verified: 2026-10-11T20:30:00Z
status: human_needed
score: 3/3 roadmap truths verified in code (device and sandbox confirmation pending)
overrides_applied: 0
gaps: []
warnings:
  - "backend tests/account-deletion.test.ts 'returns 403 INVALID_PASSWORD...' fails intermittently in the full parallel run (failed in 2 of 2 full runs here; passes alone). Cause: tests/ai-quota.test.ts line 72 deletes ALL ai_usage rows for today's day, including the shared 'global' row that account-deletion counts. Test isolation defect, not a product defect."
  - "frontend lib/rules/rank.bench.test.ts perf gate fails intermittently (2 of 3 runs). Timing flake outside phase 12."
human_verification:
  - test: "Simulator purchase against Kumaun.storekit"
    expected: "Buy shows the StoreKit localizedPrice, unlocks once, Restore works on a fresh install, no recurring charge"
    why_human: "Needs Xcode/Simulator StoreKit session"
  - test: "TestFlight sandbox purchase and restore on a real device"
    expected: "Sandbox JWS verified by backend (environment Sandbox), entitlement active, pantry limit lifts"
    why_human: "Needs Apple sandbox tester and a signed build"
  - test: "App Store Server Notifications V2 delivery after backend deploy"
    expected: "Sandbox refund/revoke POST to /api/v1/webhooks/app-store flips entitlement to revoked; Apple receives 200"
    why_human: "Needs deployed public URL and App Store Connect webhook config"
  - test: "Capture the paywall review screenshot and attach to the IAP in App Store Connect"
    expected: "Product leaves MISSING_METADATA"
    why_human: "Manual capture and upload"
  - test: "Xcode: Edit Scheme > Run > Options shows Kumaun.storekit; confirm In-App Purchase capability in Signing & Capabilities"
    expected: "Config path resolves (../../storekit/Kumaun.storekit relative to mobile/ios/App); capability present"
    why_human: "pbxproj intentionally not edited; Xcode UI check (assumption A3)"
---

# Phase 12: One-Time Unlock Verification Report

**Phase Goal:** Users can buy Kitcha Full once for $9.99 and paid features are enforced on the server while a useful free tier stays free
**Verified:** 2026-10-11
**Status:** human_needed
**Re-verification:** No, initial verification

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Buy $9.99 once in sandbox, restore on fresh install, no recurring charge | VERIFIED in code; sandbox run human_needed | `KumaunStorePlugin.swift` returns only `.verified` transactions' `jwsRepresentation`, no auto-finish (finish after server 2xx, `store-service.ts` `verifyAndFinish`); `restorePurchases` reads `currentEntitlements`, falls back to `AppStore.sync`; `Kumaun.storekit` has one NonConsumable `app.kitcha.mobile.full` 9.99; no subscription code. Server `verifyJws` requires productId match and `Non-Consumable` type. |
| 2 | After purchase/refund the backend entitlement updates; paid-only actions succeed/refuse server-side | VERIFIED | `entitlements.service.ts` `verifyAndClaim` (Apple chain verify via `@apple/app-store-server-library`, pinned Root CA G3, global unique (environment, originalTransactionId), stale and different-purchase guards); `notifications.service.ts` handles REFUND/REVOKE/REFUND_REVERSED with dedupe + ordering in one transaction; routes mounted in `app.ts` (`/entitlements`, `/webhooks/app-store`). Pantry: `pantry.limit.ts` advisory lock + 403 `UPGRADE_REQUIRED`, called from `pantry.service.ts` and `shopping-pantry.service.ts`. AI: `ai-limits.ts` `resolveUserLimits` free (20/day default) vs paid (40/day, 600/month), monthly counter in atomic quota path. Tier read from DB only. |
| 3 | Free user keeps scanning, expiry alerts, 25 items; upgrade prompt only at limit, dismissible | VERIFIED (UI feel human_needed) | No gate added to scan/alert paths (limit only in pantry create and trip finish). `FREE_PANTRY_LIMIT` default 25. `use-pantry-add-gate.ts` used by `add-pantry-item-modal.tsx`; `upgrade-sheet-host.tsx` mounted in `app/(app)/layout.tsx`, native-only, has `onClose`; E2E route excluded from release (12-11 check). |

**Score:** 3/3

## Artifacts and Wiring

| Artifact | Status |
|----------|--------|
| `backend/src/modules/entitlements/*` (service, verifier, deps, routes, webhook) | VERIFIED, wired in `app.ts`, 779 lines total, substantive |
| `backend/prisma/migrations/20261017000000_entitlements` (additive) | EXISTS |
| `backend/src/modules/pantry/pantry.limit.ts` | VERIFIED, wired in 2 create paths |
| `mobile/plugins/kumaun-store` (Swift) | VERIFIED, registered in `CapApp-SPM/Package.swift` |
| `mobile/storekit/Kumaun.storekit` | VERIFIED, scheme reference resolves to `mobile/storekit` |
| `App.xcscheme` shared scheme with StoreKit config | EXISTS |
| `PrivacyInfo.xcprivacy` Purchase History | VERIFIED (linked, not tracking, App Functionality) |
| Frontend store facade/service, hook, Settings card (Buy, Restore), upgrade sheet, Pending changes Unlock | VERIFIED, wired |
| `docs/store/IAP.md` | EXISTS |

Level 4 data flow: Settings card and sheet read status from `GET /entitlements/me` (DB-derived via `getEntitlementSummary`) and price from the StoreKit plugin product, not hardcoded.

## Behavioral Spot-Checks

| Check | Result |
|-------|--------|
| `cd backend && npm test` | 1575 pass, 1 fail (account-deletion flake, see warnings); passes alone (2 of 2 isolated runs) |
| `cd backend && tsc --noEmit`, lint | 0 errors |
| `cd frontend && npx vitest run` | 1688 to 1689 pass; only failure is `rank.bench` timing gate (unrelated); `tsc --noEmit` clean; eslint 0 errors |
| Debt markers (TBD/FIXME/XXX) in phase files | none |

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| SUB-01 (buy once, restore) | SATISFIED in code; sandbox human_needed | plugin, store-service, verify route |
| SUB-02 (server-side entitlement, refund, gating) | SATISFIED | service, webhook, pantry/AI gates |
| SUB-03 (useful free tier, prompt at limit only) | SATISFIED | limit only on create paths, dismissible sheet |

No orphaned requirements.

## Anti-Patterns

None blocking. Warnings: the two flaky tests above. Note the 12-14 SUMMARY claims a green backend gate; the account-deletion flake contradicts a clean full run here.

## Human Verification Required

See frontmatter list: Simulator .storekit purchase, TestFlight sandbox purchase/restore, ASSN V2 delivery after deploy, review screenshot, Xcode scheme path and In-App Purchase capability. Also outstanding owner config: `APPLE_APP_APPLE_ID` must be set for Production verification (unset returns 503 not-configured, documented).

## Gaps Summary

No code gaps against the roadmap criteria. Recommend fixing the `ai-quota.test.ts` shared-day delete (scope it to its own scopes) so the full backend gate is deterministic.

---

_Verified: 2026-10-11_
_Verifier: Claude (gsd-verifier)_
