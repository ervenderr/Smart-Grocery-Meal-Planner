---
phase: 11
slug: offline-core
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-11
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.3 (node environment); backend Jest for the cook endpoints |
| **Config file** | `frontend/vitest.config.ts`, `backend/jest.config.js` |
| **Quick run command** | `cd frontend && npx vitest run lib/offline` |
| **Full suite command** | `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~11 seconds quick; full suite ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run lib/offline`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 11 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | OFF-09, OFF-01 | per plan threat model | SqlDb contract, node:sqlite adapter and ids (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | OFF-09, OFF-01 | per plan threat model | Schema and forward-only migrations (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-02-01 | 02 | 1 | OFF-06, OFF-07 | per plan threat model | Failing Jest tests for optional occurredAt on cook apply | unit/integration | `cd backend && npx jest tests/cook-occurred-at.test.ts tests/cook-endpoints.test.ts` | ✅ | ✅ green |
| 11-02-02 | 02 | 1 | OFF-06, OFF-07 | per plan threat model | Accept and apply clamped occurredAt (GREEN) | unit/integration | `cd backend && npx jest tests/cook-occurred-at.test.ts tests/cook-endpoints.test.ts` | ✅ | ✅ green |
| 11-03-01 | 03 | 2 | OFF-09, OFF-01 | per plan threat model | Automated legitimacy gate for the two plugins (before install) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-03-02 | 03 | 2 | OFF-09, OFF-01 | per plan threat model | Install, configure CapacitorSQLite, cap sync, web build unchanged | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-03-03 | 03 | 2 | OFF-09, OFF-01 | per plan threat model | Native SqlDb adapter, memoized getDb, Simulator persistence spike | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-04-01 | 04 | 2 | OFF-01, OFF-07 | per plan threat model | Cache keys, cache meta, sync API, pantry normalize (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-04-02 | 04 | 2 | OFF-01, OFF-07 | per plan threat model | Per-key query persister (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-04-03 | 04 | 2 | OFF-01, OFF-07 | per plan threat model | Bootstrap pager and snapshot seeder (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-05-01 | 05 | 2 | OFF-02, OFF-03, OFF-09 | per plan threat model | Op types, classification, backoff (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-05-02 | 05 | 2 | OFF-02, OFF-03, OFF-09 | per plan threat model | Coalescing and folding (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-05-03 | 05 | 2 | OFF-02, OFF-03, OFF-09 | per plan threat model | SQLite outbox store (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-06-01 | 06 | 3 | OFF-05, OFF-09, OFF-02, OFF-03 | per plan threat model | Forced-offline flag, health probe, connectivity state machine, native  | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-06-02 | 06 | 3 | OFF-05, OFF-09, OFF-02, OFF-03 | per plan threat model | Outbox transport and apiClient offline gate (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-07-01 | 07 | 3 | OFF-01, OFF-07 | per plan threat model | Generic page fetcher, pure filters, recipe and meal plan hooks | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-07-02 | 07 | 3 | OFF-01, OFF-07 | per plan threat model | Switch pantry hook and recipes, meal plans, dashboard pages to canonic | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-08-01 | 08 | 4 | OFF-09, OFF-02, OFF-03 | per plan threat model | Executors and flaky fake server (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-08-02 | 08 | 4 | OFF-09, OFF-02, OFF-03 | per plan threat model | Drain worker with unit and flaky-server integration tests (RED then GR | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-09-01 | 09 | 3 | OFF-02, OFF-03, OFF-05, OFF-09 | per plan threat model | Inverse schemas and reapply (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-09-02 | 09 | 3 | OFF-02, OFF-03, OFF-05, OFF-09 | per plan threat model | Server result patching and rollback (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-10-01 | 10 | 5 | OFF-01, OFF-07, OFF-09 | per plan threat model | Runtime singleton with reconcile wiring and bootstrap refresh | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-10-02 | 10 | 5 | OFF-01, OFF-07, OFF-09 | per plan threat model | Boot sequence with fail-open timeout and drain triggers | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-10-03 | 10 | 5 | OFF-01, OFF-07, OFF-09 | per plan threat model | Boot gate, first-launch offline screen, Providers wiring, native and w | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-11-01 | 11 | 6 | OFF-02, OFF-03 | per plan threat model | Facade and pure op builders (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-11-02 | 11 | 6 | OFF-02, OFF-03 | per plan threat model | Switch shopping and pantry hooks to the facade | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-11-03 | 11 | 6 | OFF-02, OFF-03 | per plan threat model | Pantry add and edit modals through the facade | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-12-01 | 12 | 6 | OFF-05 | per plan threat model | Indicator, descriptions and sheet model (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-12-02 | 12 | 6 | OFF-05 | per plan threat model | Status source, actions, React hooks (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-13-01 | 13 | 7 | OFF-05 | per plan threat model | Toast planner and sheet store (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-13-02 | 13 | 7 | OFF-05 | per plan threat model | Indicator, banner, feedback host; header and layout wiring | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-13-03 | 13 | 7 | OFF-05 | per plan threat model | Pending changes sheet and rows; builds | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-14-01 | 14 | 5 | OFF-06, OFF-07 | per plan threat model | Op builders, lock predicate, fold extensions (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-14-02 | 14 | 5 | OFF-06, OFF-07 | per plan threat model | Two-phase cook executor and finish executor (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-15-01 | 15 | 7 | OFF-06, OFF-07 | per plan threat model | directThenQueue helper and idempotent API wrappers | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-15-02 | 15 | 7 | OFF-06, OFF-07 | per plan threat model | Queued finish trip and shopping list lock | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-15-03 | 15 | 7 | OFF-06, OFF-07 | per plan threat model | Offline Cooked it sheet (recipes and meal plan items) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-16-01 | 16 | 7 | OFF-04 | per plan threat model | Barcode cache and pending-scan stores (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-16-02 | 16 | 7 | OFF-04 | per plan threat model | Offline-aware scan deps, resolveBarcode outcome, pending resolver (RED | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-16-03 | 16 | 7 | OFF-04 | per plan threat model | Wire scan sheet, add modal and runtime resolver | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-17-01 | 17 | 8 | OFF-06, OFF-05, OFF-07 | per plan threat model | Servings scaling (RED then GREEN) and recipe detail offline view | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-17-02 | 17 | 8 | OFF-06, OFF-05, OFF-07 | per plan threat model | Pending markers in shopping, pantry and meal plan lists | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-18-01 | 18 | 7 | OFF-05, OFF-01 | per plan threat model | NeedsConnection component and recipes page gating | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-18-02 | 18 | 7 | OFF-05, OFF-01 | per plan threat model | Meal plans page and generate-from-plan gating; builds | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-19-01 | 19 | 8 | OFF-09 | per plan threat model | Session hooks and transition planner (RED then GREEN) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-19-02 | 19 | 8 | OFF-09 | per plan threat model | Transition executor, auth store hooks, runtime and boot wiring (RED th | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-20-01 | 20 | 9 | OFF-09, OFF-05 | per plan threat model | Logout guard (RED then GREEN) and confirm host | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-20-02 | 20 | 9 | OFF-09, OFF-05 | per plan threat model | useLogout and account deletion intents; builds | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-21-01 | 21 | 10 | OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09 | per plan threat model | Offline phase machine (TDD) and in-app offline runner | unit/integration | `cd frontend && npx vitest run lib/e2e` | ✅ | ✅ green |
| 11-21-02 | 21 | 10 | OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09 | per plan threat model | e2e-offline.sh, npm script, run on the Simulator | unit/integration | `cd mobile && npm run e2e:offline` | ✅ | ✅ green |
| 11-21-03 | 21 | 10 | OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09 | per plan threat model | Phase gate and validation record | unit/integration | `cd frontend && npx vitest run --coverage --coverage.include='lib/offline/**'` plus tsc, lint, web and release builds | ✅ | ✅ green |
| 11-22-01 | 22 | 11 | OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09 | per plan threat model | Write the real-device checklist | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |
| 11-22-02 | 22 | 11 | OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-09 | per plan threat model | Real-iPhone airplane mode, force-quit and reboot check (non-blocking) | unit/integration | `cd frontend && npx vitest run lib/offline components/offline` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 items outstanding.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real airplane mode on a physical iPhone, then kill and relaunch | OFF-01, OFF-02, OFF-03 | simctl has no airplane-mode switch; the Simulator E2E uses the E2E-only forced-offline flag | 11-22 real-iPhone checklist step 1 to 3 |
| Reboot the device while the outbox has queued ops, then reconnect | OFF-06, OFF-09 | A device reboot cannot be automated | 11-22 checklist reboot step |
| Offline banner, queued-change indicator and failed-change UI on device | OFF-04, OFF-05 | Visual and haptic judgement on real hardware | 11-22 checklist UI steps |
| Offline barcode scan (cached and unknown) on device camera | OFF-07 | Camera is unavailable on the Simulator | 11-22 checklist scan step |


---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 11s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-11 (automated gates; real-device checks tracked in 11-22)
