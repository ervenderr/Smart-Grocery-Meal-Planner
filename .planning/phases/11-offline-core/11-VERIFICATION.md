---
phase: 11-offline-core
verified: 2026-10-11T14:10:00Z
status: human_needed
score: 6/6 roadmap success criteria verified in code and automated tests; real-device confirmation pending
overrides_applied: 0
human_verification:
  - test: "Real iPhone: airplane mode, open app, force-quit, relaunch while offline"
    expected: "Pantry, shopping, recipes and meal plans render from the SQLite cache; queued edits remain"
    why_human: "simctl has no airplane switch; the Simulator E2E uses the E2E-only forced-offline flag (plan 11-22)"
  - test: "Real iPhone: reboot with queued ops, then reconnect"
    expected: "Ops replay exactly once; no duplicates; conflict messages are clear"
    why_human: "Device reboot cannot be automated"
  - test: "Real iPhone: offline barcode scan (cached and unknown product), offline Cooked it and Finish trip, pending/failed-changes sheet"
    expected: "Cached product fills in; unknown is saved with code and resolved online; cook and finish queue and apply; retry/discard works"
    why_human: "No camera on the Simulator; visual and haptic judgement. The Simulator E2E does not drive barcode, cook or finish end to end (unit tests cover them)"
---

# Phase 11: Offline Core Verification Report

**Goal:** The installed app is fully usable with no signal: everything is readable from a local cache and every edit is queued and synced exactly once.
**Status:** human_needed (no gaps found; plan 11-22 real-iPhone check intentionally not executed)

## Evidence run by the verifier

- `cd frontend && npx vitest run lib/offline`: 52 files, 420 tests pass.
- `cd backend && npx jest tests/cook-occurred-at.test.ts tests/cook-endpoints.test.ts`: 30 tests pass.
- Debt-marker scan (TBD/FIXME/XXX) over frontend/lib/offline, components/offline, mobile/scripts, backend/src: none.
- Code read: `lib/offline/{sql,outbox,reconcile,cache,connectivity,status,barcode,session,ops}` all substantive; executors for cook, pantry, shopping and shopping-finish exist; `occurredAt` flows from `outbox/executors/cook.ts` to backend `cook.validation.ts`/`cook.service.ts` and `shopping-finish.service.ts`; UI wired in `components/cook/{cooked-it-sheet,queue-cook,offline-cook-body}.tsx`, `components/pantry/scan/scan-sheet.tsx`, `components/offline/pending-changes-sheet.tsx` (retry/discard via `status/actions.ts`), recipe and meal-plan detail modals.
- E2E: `mobile/scripts/e2e-offline.sh` and 23 artifact runs exist. I did not re-run the Simulator; I rely on the 11-21 record (seed, offline write, kill, cold start, reconnect, replay).

## Requirement coverage

| Req | Status | Evidence |
|-----|--------|----------|
| OFF-01 offline read of pantry, shopping, recipes, meal plans | SATISFIED (device pending) | cache/seed, query-persister, bootstrap-client, boot gate; Simulator E2E cold start offline hydrated all four keys from SQLite |
| OFF-02 shopping add/edit/delete/check offline | SATISFIED | facade, ops/shopping-ops, executors/shopping, drain tests with flaky server; E2E queued check applied after reconnect |
| OFF-03 pantry add/qty/expiry, delta merge | SATISFIED | coalesce/fold (+2,+3 coalesced to one adjust), executors/pantry; E2E server delta exactly +5 |
| OFF-04 offline barcode | SATISFIED in unit tests (device pending) | barcode-cache, pending-scan, resolve-pending, scan-sheet wiring; no camera or E2E coverage |
| OFF-05 status and failed-change handling | SATISFIED (visual pending) | derive-indicator, toast-plan, sheet-model, pending-changes-sheet, retry/discard with rollback |
| OFF-06 offline cook, Cooked it, Finish trip, conflict messages | SATISFIED in unit and backend tests (device pending) | cook-ops, finish-ops, two-phase executors, occurredAt backend tests, offline recipe detail with servings scaling; not covered by Simulator E2E |
| OFF-07 meal plan view and mark meals offline | SATISFIED | meal plan hooks on canonical cache, meal-plan-detail-modal with Cooked it sheet |
| OFF-09 durability, exactly-once, LWW and delete-wins | SATISFIED | SQLite outbox, idempotency-key replay verified in E2E (server quantity unchanged on replay), kill while offline retained 3 ops; reboot is device-only |

No orphaned requirements (OFF-08 belongs to Phase 9).

## Anti-patterns / warnings

- Warning: Simulator E2E screenshots show runner status text, not app UI; barcode, cook and finish are not exercised end to end on a simulator or device. Covered by unit and backend tests only.
- Warning: true airplane mode and reboot are untested (simulated by forced-offline flag).
- Info: full suite has a pre-existing flaky `rank.bench` perf test under parallel load.

## Gaps

None blocking. Phase moves forward with the 11-22 real-iPhone checklist as the outstanding human item.
