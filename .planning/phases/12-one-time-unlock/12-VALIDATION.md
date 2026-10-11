---
phase: 12
slug: one-time-unlock
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-11
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Pre-filled from the plans; finalized (statuses, nyquist_compliant true) by plan 12-14.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: Jest 29 + ts-jest + supertest (real local Postgres). Frontend: Vitest 5 (node env, `lib/**/*.test.ts` only) |
| **Config file** | `backend/jest.config.js`, `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && npx jest tests/<file>.test.ts --coverage=false` / `cd frontend && npx vitest run <path>` |
| **Full suite command** | `cd backend && npm test` ; `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint` ; `cd mobile && bash scripts/frontend-build.sh web && bash scripts/frontend-build.sh native && bash scripts/verify-bundle.sh` |
| **Estimated runtime** | quick < 15 s per file; full backend several minutes (measured in 12-14: backend `npm test` with coverage about 28 s for 98 suites; frontend `vitest run` about 4 s for 171 files; web and native builds about 1 minute each) |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (quick run for the touched area)
- **After every plan wave:** full backend + frontend suites, `tsc --noEmit` and lint in both
- **Before `/gsd:verify-work`:** plan 12-14 gate fully green
- **Max feedback latency:** ~15 s for quick runs

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SUB-02 | T-12-01 | Xcode-env flag rejected in production | unit | `cd backend && npx jest tests/env.schema.test.ts --coverage=false` | exists (extend) | green |
| 12-01-02 | 01 | 1 | SUB-02 | T-12-02, T-12-04 | Global unique (environment, originalTransactionId); additive SQL | integration | `cd backend && npx prisma validate && npx jest tests/entitlement-status.test.ts --coverage=false` | W0 | green |
| 12-01-03 | 01 | 1 | SUB-02 | T-12-03 | Deletion removes entitlements + usermonth rows | integration | `cd backend && npx jest tests/account-deletion.test.ts --coverage=false` | exists (extend) | green |
| 12-02-01 | 02 | 2 | SUB-02 | T-12-SC, T-12-05 | Apple root pinned; package verified via npm view | unit | `cd backend && npx jest tests/apple-root-cert.test.ts --coverage=false` | W0 | green |
| 12-02-02 | 02 | 2 | SUB-02 | T-12-05..08 | Tampered/wrong-bundle/untrusted/Xcode JWS rejected | unit | `cd backend && npx jest tests/apple-verifier.test.ts --coverage=false` | W0 | green |
| 12-03-01 | 03 | 1 | SUB-01 | T-12-09..12 | Only verified tx returned; no auto finish/sync | build | `cd mobile/plugins/kumaun-store && xcodebuild -scheme KumaunStore -destination generic/platform=iOS build -quiet CODE_SIGNING_ALLOWED=NO` | W0 | green |
| 12-03-02 | 03 | 1 | SUB-01 | — | StoreKit config valid; CLI probe recorded | config + probe | `node -e` JSON check of `mobile/storekit/Kumaun.storekit` | W0 | green (probe SKIPPED, informational) |
| 12-04-01 | 04 | 1 | SUB-01 | T-12-14 | Mock store only via E2E flag | unit | `cd frontend && npx vitest run lib/native/store/store-deps.test.ts lib/native/store/mock-store.test.ts` | W0 | green |
| 12-04-02 | 04 | 1 | SUB-01, SUB-03 | T-12-13, T-12-15, T-12-16 | Finish only after server 2xx; sync only on restore | unit | `cd frontend && npx vitest run lib/native/store` | W0 | green |
| 12-05-01 | 05 | 1 | SUB-03 | T-12-17, T-12-18 | UPGRADE_REQUIRED parks as retryable conflict | unit | `cd frontend && npx vitest run lib/offline/outbox/classify-error.test.ts lib/offline/status` | exists (extend) | green |
| 12-05-02 | 05 | 1 | SUB-03 | T-12-19 | Online error detection | unit | `cd frontend && npx vitest run lib/entitlements/upgrade-error.test.ts` | W0 | green |
| 12-06-01 | 06 | 3 | SUB-02 | T-12-21, T-12-22, T-12-24 | Claim once; revoked/stale handling; no JWS in logs | integration | `cd backend && npx jest tests/entitlements-claim.test.ts --coverage=false` | W0 | green |
| 12-06-02 | 06 | 3 | SUB-01, SUB-02 | T-12-20, T-12-23, T-12-26 | Auth, zod strict, limiter, idempotent verify | integration | `cd backend && npx jest tests/entitlements-verify.test.ts tests/entitlements-claim.test.ts --coverage=false` | W0 | green |
| 12-07-01 | 07 | 2 | SUB-02, SUB-03 | T-12-27..29 | RED tests for both create paths | integration | `cd backend && npx jest tests/pantry-limit.test.ts tests/shopping-finish-limit.test.ts --coverage=false` (expected fail) | W0 | green (RED tests committed; now passing after 12-07-02/03) |
| 12-07-02 | 07 | 2 | SUB-02, SUB-03 | T-12-27, T-12-31 | Atomic POST /pantry gate, replay-safe | integration | `cd backend && npx jest tests/pantry-limit.test.ts tests/pantry.test.ts tests/pantry-client-ids.test.ts --coverage=false` | W0 | green |
| 12-07-03 | 07 | 2 | SUB-02, SUB-03 | T-12-29, T-12-30 | Trip finish gated + rolled back | integration | `cd backend && npx jest tests/shopping-finish-limit.test.ts tests/shopping-finish-pantry.test.ts tests/shopping-finish.test.ts --coverage=false && npm test -- --silent` | W0 | green |
| 12-08-01 | 08 | 2 | SUB-02 | T-12-33, T-12-34 | Monthly scope atomic; survives prune | unit + integration | `cd backend && npx jest tests/ai-limits.test.ts tests/ai-quota.test.ts --coverage=false` | exists (extend) + W0 | green |
| 12-08-02 | 08 | 2 | SUB-02 | T-12-32, T-12-35 | Tier from server only; fallback to free | integration | `cd backend && npx jest tests/ai-quota.test.ts tests/ai-limits.test.ts tests/ai-recipes.test.ts tests/ai-meal-plan.test.ts tests/ai-substitutions.test.ts --coverage=false` | exists | green |
| 12-09-01 | 09 | 4 | SUB-02 | T-12-36, T-12-37, T-12-39 | Dedupe, ordering, rollback | integration | `cd backend && npx jest tests/app-store-webhook.test.ts --coverage=false` | W0 | green |
| 12-09-02 | 09 | 4 | SUB-02 | T-12-36, T-12-38, T-12-40 | Public route JWS-auth only; no-Origin OK | integration | `cd backend && npx jest tests/app-store-webhook.test.ts tests/https-redirect.test.ts tests/cors.test.ts --coverage=false` | W0 | green |
| 12-10-01 | 10 | 2 | SUB-01, SUB-03 | T-12-41 | No hardcoded price / forbidden copy | unit | `cd frontend && npx vitest run lib/entitlements` | W0 | green |
| 12-10-02 | 10 | 2 | SUB-01 | T-12-43, T-12-44 | No auto sync; server-derived status | typecheck/lint | `cd frontend && npx tsc --noEmit && npx eslint lib/hooks/use-entitlement.ts` | W0 | green |
| 12-10-03 | 10 | 2 | SUB-01, SUB-03 | T-12-42 | Web shows note only, no links | typecheck/lint + unit | `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run lib/entitlements` | W0 | green |
| 12-11-01 | 11 | 3 | SUB-01, SUB-03 | T-12-46, T-12-47 | Dismissible, native-only sheet | typecheck/lint + unit | `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run lib/entitlements` | W0 | green |
| 12-11-02 | 11 | 3 | SUB-03 | T-12-45 | E2E route absent from release | build + bundle check | `cd mobile && bash scripts/frontend-build.sh native && bash scripts/verify-bundle.sh && test ! -e ../frontend/out/e2e/upgrade` | W0 | green |
| 12-12-01 | 12 | 3 | SUB-03 | T-12-48 | Gate decision pure | unit | `cd frontend && npx vitest run lib/entitlements/pantry-gate.test.ts` | W0 | green |
| 12-12-02 | 12 | 3 | SUB-03 | T-12-49, T-12-50 | Draft kept; web inline only | typecheck/lint | `cd frontend && npx tsc --noEmit && npx eslint components/pantry/add-pantry-item-modal.tsx && npx vitest run lib/entitlements` | n/a | green |
| 12-12-03 | 12 | 3 | SUB-03 | T-12-49, T-12-50 | Unlock action native only; finish limit handled | typecheck/lint + unit | `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run lib/offline/status lib/entitlements` | n/a | green |
| 12-13-01 | 13 | 5 | SUB-01..03 | T-12-51 | Docs say Xcode env never in production | doc grep | grep checks in plan 12-13 task 1 | n/a | green |
| 12-13-02 | 13 | 5 | SUB-01..03 | T-12-52 | No secrets in env template | doc grep | grep checks in plan 12-13 task 2 | n/a | green |
| 12-14-01 | 14 | 6 | SUB-01..03 | T-12-54 | Full suites + 80% coverage | full suite | `cd backend && npm test` ; `cd frontend && npx vitest run --coverage` ; `cd mobile && bash scripts/frontend-build.sh web` | n/a | green |
| 12-14-02 | 14 | 6 | SUB-01..03 | T-12-53 | Release export clean; plugin builds | build + bundle check | `cd mobile && bash scripts/frontend-build.sh native && bash scripts/verify-bundle.sh` + plugin xcodebuild | n/a | green |
| 12-15-01 | 15 | 7 | SUB-01 | T-12-55, T-12-56 | Gate on TestFlight commit; no pbxproj/Info.plist edits | build/git check | verify command in plan 12-15 task 1 | n/a | pending (plan 12-15) |
| 12-15-02 | 15 | 7 | SUB-01 | T-12-57, T-12-58 | Purchase History declared (parsed) | plist check | verify command in plan 12-15 task 2 | n/a | pending (plan 12-15) |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Test files created by the plans (W0 rows above; all exist and pass). 12-14 added `backend/tests/entitlements-deps.test.ts`:
- [x] `backend/tests/entitlement-status.test.ts`, `backend/tests/helpers/entitlement-fixtures.ts` (12-01)
- [x] `backend/tests/fixtures/apple-test-pki/*`, `backend/tests/helpers/apple-test-signer.ts`, `backend/tests/apple-root-cert.test.ts`, `backend/tests/apple-verifier.test.ts` (12-02)
- [x] `backend/tests/entitlements-claim.test.ts`, `backend/tests/entitlements-verify.test.ts` (12-06)
- [x] `backend/tests/pantry-limit.test.ts`, `backend/tests/shopping-finish-limit.test.ts` (12-07)
- [x] `backend/tests/ai-limits.test.ts` (12-08), `backend/tests/app-store-webhook.test.ts` (12-09)
- [x] `frontend/lib/native/store/*.test.ts` (12-04), `frontend/lib/entitlements/*.test.ts` (12-05, 12-10, 12-12)
- [x] StoreKit CLI probe `mobile/plugins/kumaun-store/ios/Tests/KumaunStorePluginTests/StoreKitProbeTests.swift` (12-03, informational)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-----------------|
| Simulator purchase/restore with `Kumaun.storekit` | SUB-01 | Always human_needed: `xcodebuild`/`simctl` do not sync `.storekit` on the iOS 26.5 runtime (forum thread 826971). The 12-03 probe result is informational only | Xcode > scheme App with Kumaun.storekit > Cmd+R; buy, restore, refund via Debug > StoreKit > Manage Transactions (local backend with IAP_ALLOW_XCODE_ENV=true) |
| Real-device sandbox purchase, restore on reinstall and on a second device | SUB-01 | Needs a sandbox Apple account + TestFlight build | docs/store/IAP.md "Testing guide" (3) |
| ASSN V2 refund delivery revokes entitlement | SUB-02 | Backend not deployed in this phase; URL registration is an owner step | IAP.md "Owner steps" 2, then a sandbox refund |
| Review screenshot of the upgrade sheet | SUB-03 | Requires a real StoreKit price in Simulator + upload to App Store Connect | IAP.md "Review screenshot" |
| Xcode wiring (only if 12-15 records PENDING) | SUB-01 | Concurrent TestFlight agent owns the project | Commands listed in 12-15-SUMMARY.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s for quick runs
- [x] `nyquist_compliant: true` set in frontmatter (by 12-14)

**Approval:** approved 2026-10-11 by plan 12-14 (rows 12-15-* stay pending until plan 12-15 runs; they are covered by its own verify commands)
