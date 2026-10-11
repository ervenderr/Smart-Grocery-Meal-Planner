---
phase: 11-offline-core
fixed_at: 2026-10-11T07:39:00Z
review_path: .planning/phases/11-offline-core/11-REVIEW.md
iteration: 1
findings_in_scope: 26
fixed: 23
skipped: 3
status: partial
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-10-11T07:39:00Z
**Source review:** .planning/phases/11-offline-core/11-REVIEW.md
**Iteration:** 1 (plus one self re-review pass over the changes)

**Summary:**
- Findings in scope: 26 (5 critical, 13 warning, 8 info; Info was taken only where the fix was small)
- Fixed: 23 (all 5 critical, all 13 warning, 5 info)
- Skipped: 3 (IN-02, IN-06, IN-08)

Each fix has its own commit with a regression test under `frontend/lib/**`. Logic fixes are marked "requires human verification". The tests check the behavior, but the reasoning about the race or ordering should still get a human read.

## Fixed Issues

### CR-01: Drain/coalesce race silently loses merged changes or sends cancelled ops
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/drain.ts`, `frontend/lib/offline/outbox/drain-race.test.ts`
**Commit:** ea86833
**Status:** fixed: requires human verification
**Applied fix:** New `store.claim(seq)`. In one transaction it re-reads the row, marks it `in_flight` only if it is still `queued`, and returns the stored row. The drain sends the claimed row. If the row was dropped, it sends nothing. Tests cover a merge (+2/+3 sends +5) and a cancel (+1/-1 sends nothing).

### CR-02: Coalescing a pantry.update into a pending pantry.create writes an invalid row
**Files modified:** `frontend/lib/offline/outbox/coalesce.ts`, `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/store-rows.ts`, `frontend/lib/offline/outbox/coalesce-validate.test.ts`
**Commit:** 4a8814d
**Status:** fixed: requires human verification
**Applied fix:**
- Null patch fields are dropped when merging into a `pantry.create`.
- Every merged payload is validated with `NewOpSchema` before it is written. If validation fails, the op is inserted on its own instead.
- A readable row whose payload no longer validates is now returned as `failed`/`invalid`. `nextReady` parks it, which also blocks its dependents. The user can see and discard it instead of it being hidden while blocking its entity.

### CR-03: A transient refresh failure parks the whole outbox in paused_auth
**Files modified:** `frontend/lib/offline/outbox/classify-error.ts`, `frontend/lib/offline/outbox/drain.ts`, plus tests in `classify-error.test.ts` and `drain.test.ts`
**Commit:** 492d897
**Status:** fixed: requires human verification
**Applied fix:**
- `classify` takes `sessionActive`. A 401 while the op's owner is still signed in is now a counted transient retry, which parks after max attempts. It pauses only once the session has really ended (a definitive refresh failure clears the user synchronously).
- Each drain pass releases `paused_auth` ops of the signed-in user.
- The old test "401 pauses all rows" now runs with the session ended first.

### CR-04: Pending-op overlay dropped by refetches and per-op results
**Files modified:** `frontend/lib/offline/reconcile/fold-query.ts` (new), `frontend/lib/offline/reconcile/apply-result.ts`, `frontend/lib/offline/outbox/drain.ts`, `frontend/lib/offline/runtime.ts`, `frontend/lib/hooks/use-pantry.ts`, `frontend/lib/hooks/use-shopping-list.ts`, `frontend/lib/hooks/use-meal-plans.ts`, `frontend/lib/offline/reconcile/fold-query.test.ts`
**Commit:** 810bfbe
**Status:** fixed: requires human verification
**Applied fix:**
- The canonical query functions (pantry all, shopping active, meal plans) are wrapped in `withPendingOps`, which folds pending outbox ops over the server data on native.
- `applied` drain events now carry the remaining ops. `applyResult` re-folds same-entity ops (or all shopping ops for a finish) over the server row.
- The cooked-it-sheet invalidate is handled under WR-13.

### CR-05: Persisted offline cache rows deleted by React Query GC
**Files modified:** `frontend/lib/offline/cache/query-persister.ts`, `frontend/lib/offline/cache/query-persister.test.ts`, `frontend/lib/offline/session/apply-transition.test.ts`
**Commit:** ddd4a63
**Status:** fixed
**Applied fix:**
- `start()` sets `gcTime: Infinity` for the persisted prefixes.
- A `removed` cache event (GC or clear) never deletes the SQLite row. Only `wipe()` does.
- Writes that fire while the persister is suspended are deferred and run on `resume()`.
- Two existing tests that encoded "clear deletes rows" were updated.

### WR-01: Native query() bypasses the connection serializer
**Files modified:** `frontend/lib/offline/sql/native-sqldb.ts`, `frontend/lib/offline/sql/native-sqldb.test.ts`
**Commit:** 17ae23d
**Status:** fixed
**Applied fix:**
- Top-level `query` now goes through the same serial guard as writes. Reads inside a transaction still run directly.
- I checked by hand that no code awaits a top-level `db.query` inside a `db.transaction` callback, which would deadlock. All such callers use `tx`.

### WR-02: insertRow trusts lastInsertRowid via a cast
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/store-insert-id.test.ts`
**Commit:** e25c4a9
**Status:** fixed
**Applied fix:** If `lastInsertRowid` is not a finite number, the seq is re-selected by the unique `op_id` generated before the insert.

### WR-03: cook.apply / shopping.finish barriers ignore failed, blocked and paused ops
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/status/sheet-model.ts`, `frontend/lib/offline/outbox/store-barrier.test.ts`, `frontend/lib/offline/status/sheet-model-barrier.test.ts`
**Commit:** be67af2
**Status:** fixed
**Applied fix:**
- The barrier query uses `OPEN_STATES`.
- In the pending sheet, a held-back finish or cook shows the badge "Waiting on N failed change(s)".

### WR-04: doRefresh applies a snapshot without checking the user or drain progress
**Files modified:** `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/runtime-refresh.test.ts`
**Commit:** d9ba80d
**Status:** fixed: requires human verification
**Applied fix:**
- A session epoch is bumped on every user change. The snapshot is skipped if the user or epoch changed during the fetch.
- Ops are listed before and after the fetch. If an op completed during the fetch, the snapshot is fetched again (up to 3 times).

### WR-05: canPersist check-then-write race can persist optimistic state
**Files modified:** `frontend/lib/offline/cache/query-persister.ts`, `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/cache/query-persister.test.ts`, `frontend/lib/offline/runtime-refresh.test.ts`
**Commit:** 1449f92
**Status:** fixed: requires human verification
**Applied fix:**
- The persister dehydrates first and runs the check afterwards. It then re-checks the user and suspension.
- The runtime gate also refuses while `queryClient.isMutating() > 0`. This covers the gap between `onMutate` writing optimistic state and the op reaching the outbox.

### WR-06: Any parked op freezes all cache persistence
**Files modified:** `frontend/lib/offline/reconcile/reapply.ts`, `frontend/lib/offline/cache/query-persister.ts`, `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/runtime-refresh.test.ts`
**Commit:** 6a47469
**Status:** fixed
**Applied fix:**
- `canPersist(key)` blocks only keys that ops fold into (via `foldEntityTypes`) while ops of related entity types are pending:
  - pantry keys: pantry-item and cook ops
  - shopping: shopping-item and shopping-list ops
  - meal plans: cook ops
- Recipes, preferences and notifications always persist.

### WR-07: Fold re-applies in-doubt ops whose request already reached the server
**Files modified:** `frontend/lib/offline/outbox/fold.ts`, `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/drain.ts`, `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/runtime-in-doubt.test.ts`
**Commit:** 886c6f9
**Status:** fixed: requires human verification
**Applied fix:**
- Timeouts and rows reset from `in_flight` at boot are marked `IN_DOUBT`. `isInDoubt` also covers `in_flight` and `IDEMPOTENCY_IN_FLIGHT`.
- Before applying a bootstrap snapshot, the refresh replays in-doubt ops through the idempotent drain. It skips the snapshot while any op is still in doubt.
- Scope note: the refetch path (`withPendingOps`) still folds in-doubt ops optimistically. The drain's server-row patch (`applyResult`) corrects it as soon as the replay lands.

### WR-08: Connectivity can stay offline indefinitely with no re-probe
**Files modified:** `frontend/lib/offline/connectivity/connectivity.ts`, `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/connectivity/connectivity-recovery.test.ts`
**Commit:** fd6bb86
**Status:** fixed
**Applied fix:**
- While probed offline (and the hint is not false or forced), connectivity re-probes with backoff: 5s, 15s, 30s, then every 60s.
- `setHint(true)` probes immediately.
- `dispose()` stops the timer and is called from the runtime's dispose.

### WR-09: Server idempotency TTL (48h) shorter than plausible offline periods
**Files modified:** `frontend/lib/offline/outbox/op-types.ts`, `frontend/lib/offline/outbox/drain.ts`, `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/status/describe-op.ts`, `frontend/lib/offline/outbox/drain-replay-age.test.ts`
**Commit:** 7ac6ac6
**Status:** fixed: requires human verification
**Applied fix:**
- In-doubt errors keep a `since` timestamp across later inconclusive failures.
- The drain parks an in-doubt op older than 42h (48h TTL minus 6h) as `conflict`/`REPLAY_EXPIRED` instead of sending it. The copy reads "This change may already be saved. Check the item, then retry or discard it."
- A manual retry clears the marker and sends the op once more, as an explicit user choice.
- The 42h constant mirrors the backend default `IDEMPOTENCY_TTL_HOURS=48`. Keep the two in sync.

### WR-10: retry() does not reset attempts
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/store-retry.test.ts`
**Commit:** 0b83cf3
**Status:** fixed
**Applied fix:** A manual retry sets `attempts = 0`.

### WR-11: pending_scan rows survive account deletion
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/session/apply-transition.test.ts`
**Commit:** 48ed1e7
**Status:** fixed
**Applied fix:**
- `deleteForUser` (account deletion only) deletes the user's `pending_scan` rows in the same transaction.
- Logout still keeps them, along with the user's paused ops.

### WR-12: Discarding a pending change has no error handling
**Files modified:** `frontend/lib/offline/status/actions.ts`, `frontend/components/offline/pending-changes-sheet.tsx`, `frontend/lib/offline/status/sheet-action.test.ts`
**Commit:** 8bf2d25
**Status:** fixed
**Applied fix:** A new tested helper, `runSheetAction`, wraps sheet actions. The sheet's `run` and `handleDiscard` use it, so a failure shows the error toast instead of becoming an unhandled rejection.

### WR-13: Queued cook invalidates the pantry
**Files modified:** `frontend/lib/offline/ops/cook-ops.ts`, `frontend/components/cook/cooked-it-sheet.tsx`, `frontend/lib/offline/ops/cook-settle.test.ts`
**Commit:** ff1603d
**Status:** fixed
**Applied fix:** `refreshAfterCook(queryClient, result)` invalidates the pantry only for a direct (non-null) result.

### IN-01: Release native build does not scrub inherited E2E env vars
**Files modified:** `mobile/scripts/frontend-build.sh`, `frontend/lib/build/frontend-build-script.test.ts`
**Commit:** 39dfd81
**Status:** fixed
**Applied fix:** The release branch runs `env -u` on all five `NEXT_PUBLIC_E2E*` vars before `npx next build`. A guard test checks the script text.

### IN-03: Status source can commit an older list() result
**Files modified:** `frontend/lib/offline/status/status-source.ts`, `frontend/lib/offline/status/status-source-order.test.ts`
**Commit:** 803bef1
**Status:** fixed
**Applied fix:** A sequence counter makes only the newest refresh commit.

### IN-04: Mutation against project immutability rule
**Files modified:** `frontend/lib/offline/runtime.ts`, `frontend/lib/offline/runtime-compose.test.ts`
**Commit:** f94242d
**Status:** fixed
**Applied fix:**
- `extras` is replaced with a new object on each registration.
- `dispose` detaches the session subscription directly instead of being reassigned after construction.
- This is a pure refactor, so the test is a characterization test (it passes before and after).

### IN-05: applyResult for pantry.create uses map, not upsert
**Files modified:** `frontend/lib/offline/reconcile/apply-result.ts`, `frontend/components/pantry/add-pantry-item-modal.tsx`, `frontend/lib/offline/reconcile/apply-result-upsert.test.ts`
**Commit:** a1dfd43
**Status:** fixed
**Applied fix:**
- `pantry.create` appends the server row when it is absent.
- The add modal skips its optimistic insert if the row is already there, so no duplicate appears.

### IN-07: Derived preview key can exceed the server's 255-char limit
**Files modified:** `frontend/lib/offline/outbox/store.ts`, `frontend/lib/offline/outbox/store-key-length.test.ts`
**Commit:** 5b373b8
**Status:** fixed
**Applied fix:** `KEY_RE` now caps caller keys at 200 characters.

## Skipped Issues

### IN-02: useOfflineStatus is not reactive to the runtime being set
**File:** `frontend/lib/offline/status/use-offline-status.ts:23-31`
**Reason:** Not a small fix. It needs a `useSyncExternalStore` subscription on the runtime slot, and there is no React test harness: vitest runs only `lib/**/*.test.ts` in a node environment. Left for a follow-up.
**Original issue:** `getOfflineRuntime()` is read during render with no subscription, so early renders keep `null`.

### IN-06: Edit modal optimistic update skips COOK_PANTRY_KEY
**File:** `frontend/components/pantry/edit-pantry-item-modal.tsx:149-155`
**Reason:** The suggested `pantryWrites(...)` would do nothing for the cook key. `COOK_PANTRY_KEY` holds `{ items, capped }` from the cook hook's `fetchAllPages`, and `pantryWrites` only updates arrays. See the new observation below. This needs that shape mismatch resolved first.
**Original issue:** Only `PANTRY_ALL_KEY` is patched, so the cook-from-pantry view shows pre-edit values offline.

### IN-08: OfflineBootGate can stay on booting under a double-invoked effect
**File:** `frontend/components/offline/offline-boot-gate.tsx:28-68`
**Reason:** Not a small fix. It needs a module-level boot singleton, it is dev/StrictMode-only, and there is no React test harness. Left for a follow-up.
**Original issue:** The StrictMode effect cleanup sets `cancelled` and the second effect returns early, so `setPhase` never runs.

## New observation (not fixed, outside review scope)

- **COOK_PANTRY_KEY shape mismatch:** `applySnapshot` (cache/seed.ts), `reapplyForKey` and `pantryWrites` treat `COOK_PANTRY_KEY` as a `PantryItem[]`. `useCookFromPantry` stores and reads it as `{ items, capped }` (`pantryQuery.data?.items`). After a bootstrap refresh or a cold-start hydrate of a persisted array, the cook-from-pantry view likely sees an empty pantry until a refetch. Please verify and fix in a follow-up.

## Self re-review (1 iteration)

I re-read the combined diff for regressions:
- WR-01 serialization against transaction callbacks: no nested top-level reads.
- The WR-07 refresh waiting on `drain.whenIdle()` when called from a drain `finished` event: it is not awaited inside the pass, so it does not deadlock.
- The CR-03 pass-level `resumeAuth` only runs when a user is signed in.
- CR-05 deferred writes after a session switch: a cleared query is skipped.

No further changes were needed.

## Verification

| Check | Result |
|-------|--------|
| `cd frontend && npx vitest run` | 160 files, 1593 tests passed (baseline 142 files / 1539 tests; +18 files / +54 tests). `rank.bench` failed once under load in the worktree and passed on rerun (known flake). |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 128 warnings (same count as before the fixes) |
| `NEXT_PUBLIC_API_URL=https://example.invalid npm run build` | success, all routes static |
| `cd mobile && npm run build:ios` | success (App.app built for the Simulator; the user's `project.pbxproj` change was untouched, checked byte-for-byte) |
| `npm run e2e:offline` (Simulator) | **PASS**: seed, offline-write, offline-cold-start, reconnect, replay, done (79s). Report and screenshots refreshed in commit d4912d6. An earlier attempt failed at `reconnect` with `reason: offline` while the host lost DNS: the Mac slept mid-run, and curl could not resolve the API host. One passing run reported seed counts of 2 per list; this did not happen again on the next run. |
| `npm run e2e:ios` (smoke) | **PASS**: render, login, relaunch, sqlite, scan, haptics, notifications, done (57s). The overwritten Phase 10 screenshots and report were restored with `git checkout`. |

**Throwaway accounts:** The passing runs used accounts created and deleted by a wrapper (DELETE /users/me returned 204 each time). The first, interrupted `e2e:offline` run created a `kitcha-e2e+…@example.com` account. Its cleanup could not delete it because DNS was down. The script never stores the random password, so that one orphan account remains on production and needs deleting by hand (for example, by email prefix `kitcha-e2e+` and a creation time around 2026-10-11 06:33Z).

---

_Fixed: 2026-10-11T07:39:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Follow-up: COOK_PANTRY_KEY shape mismatch (fixed)

**Verified real.** `applySnapshot` wrote plain arrays to both `COOK_PANTRY_KEY` and `COOK_RECIPES_KEY` (recipes had the same bug). `reapplyForKey` and `pantryWrites` only folded arrays. `useCookFromPantry` reads `data.items`, so after a bootstrap refresh it saw `undefined` items and ranked nothing until a refetch. A persisted array would also hydrate broken on an offline cold start.
**Fix:** The new `frontend/lib/offline/cache/cook-page.ts` holds the shape helpers: `toCookPage`, `mapCookPage` and `cookPageItems`. Changes per file:
- Seed writes `{ items, capped }`, with the same caps as `fetchAllPages`.
- `reapplyForKey` and `pantryWrites` fold the cook key's page items and keep `capped`.
- `mapCookPage` turns a legacy array into a page.
- The hook reads items via `cookPageItems`, so a legacy persisted array still renders.
**Tests:**
- New `cook-page.test.ts`.
- Regression cases in `seed.test.ts`, `reapply.test.ts` and `apply-result.test.ts`.
- `rollback.test.ts` now feeds the cook key the page shape.
**Note:** IN-06 is now unblocked. `pantryWrites` patches the cook key correctly, so the edit modal can switch to it in a follow-up.
**Verification:**
- `vitest run lib/offline`: 482/482 pass.
- `tsc --noEmit`: clean.
- `lint`: 0 errors.
- `NEXT_PUBLIC_API_URL=https://example.invalid npm run build`: OK.
- Simulator E2E: not run.
