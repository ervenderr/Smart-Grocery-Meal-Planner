---
phase: 11-offline-core
reviewed: 2026-10-11T12:00:00Z
depth: deep
files_reviewed: 82
files_reviewed_list:
  - frontend/lib/offline/sql/types.ts
  - frontend/lib/offline/sql/schema.ts
  - frontend/lib/offline/sql/migrations.ts
  - frontend/lib/offline/sql/native-sqldb.ts
  - frontend/lib/offline/sql/get-db.ts
  - frontend/lib/offline/sql/native-sqlite-loader.ts
  - frontend/lib/offline/outbox/store.ts
  - frontend/lib/offline/outbox/store-rows.ts
  - frontend/lib/offline/outbox/drain.ts
  - frontend/lib/offline/outbox/coalesce.ts
  - frontend/lib/offline/outbox/op-types.ts
  - frontend/lib/offline/outbox/classify-error.ts
  - frontend/lib/offline/outbox/backoff.ts
  - frontend/lib/offline/outbox/fold.ts
  - frontend/lib/offline/outbox/executors/index.ts
  - frontend/lib/offline/outbox/executors/cook.ts
  - frontend/lib/offline/outbox/executors/pantry.ts
  - frontend/lib/offline/outbox/executors/shopping.ts
  - frontend/lib/offline/outbox/executors/shopping-finish.ts
  - frontend/lib/offline/outbox/executors/types.ts
  - frontend/lib/offline/transport.ts
  - frontend/lib/offline/runtime.ts
  - frontend/lib/offline/triggers.ts
  - frontend/lib/offline/facade.ts
  - frontend/lib/offline/direct-or-queue.ts
  - frontend/lib/offline/boot.ts
  - frontend/lib/offline/enabled.ts
  - frontend/lib/offline/ids.ts
  - frontend/lib/offline/cache/bootstrap-client.ts
  - frontend/lib/offline/cache/cache-keys.ts
  - frontend/lib/offline/cache/cache-meta.ts
  - frontend/lib/offline/cache/query-persister.ts
  - frontend/lib/offline/cache/seed.ts
  - frontend/lib/offline/connectivity/connectivity.ts
  - frontend/lib/offline/connectivity/forced-offline.ts
  - frontend/lib/offline/connectivity/native-network.ts
  - frontend/lib/offline/connectivity/probe.ts
  - frontend/lib/offline/session/apply-transition.ts
  - frontend/lib/offline/session/logout-confirm-store.ts
  - frontend/lib/offline/session/logout-guard.ts
  - frontend/lib/offline/session/session-hooks.ts
  - frontend/lib/offline/session/user-scope.ts
  - frontend/lib/offline/reconcile/apply-result.ts
  - frontend/lib/offline/reconcile/cache-writes.ts
  - frontend/lib/offline/reconcile/inverse.ts
  - frontend/lib/offline/reconcile/reapply.ts
  - frontend/lib/offline/reconcile/rollback.ts
  - frontend/lib/offline/barcode/barcode-cache.ts
  - frontend/lib/offline/barcode/pending-scan.ts
  - frontend/lib/offline/barcode/resolve-pending.ts
  - frontend/lib/offline/ops/cook-ops.ts
  - frontend/lib/offline/ops/finish-ops.ts
  - frontend/lib/offline/ops/pantry-ops.ts
  - frontend/lib/offline/ops/shopping-ops.ts
  - frontend/lib/offline/status/actions.ts
  - frontend/lib/offline/status/status-source.ts
  - frontend/lib/offline/status/use-offline-status.ts
  - frontend/lib/hooks/use-pantry.ts
  - frontend/lib/hooks/use-shopping-list.ts
  - frontend/lib/hooks/use-finish-shopping.ts
  - frontend/lib/api/client.ts
  - frontend/lib/api/session-expiry.ts
  - frontend/lib/auth/use-logout.ts
  - frontend/lib/stores/auth-store.ts
  - frontend/lib/account/delete-account.ts
  - frontend/lib/build/native-config.ts
  - frontend/components/cook/queue-cook.ts
  - frontend/components/cook/offline-cook-body.tsx
  - frontend/components/cook/cooked-it-sheet.tsx
  - frontend/components/offline/offline-boot-gate.tsx
  - frontend/components/offline/pending-changes-sheet.tsx
  - frontend/components/pantry/add-pantry-item-modal.tsx
  - frontend/components/pantry/edit-pantry-item-modal.tsx
  - frontend/components/pantry/scan/scan-sheet.tsx
  - frontend/components/e2e/offline-runner.tsx
  - frontend/app/e2e/page.e2e.tsx
  - backend/src/modules/cook/cook.service.ts
  - backend/src/modules/cook/cook.validation.ts
  - backend/src/types/cook.types.ts
  - mobile/scripts/frontend-build.sh
  - mobile/scripts/e2e-offline.sh
  - scripts/store/capture-screenshots.sh
findings:
  critical: 5
  warning: 13
  info: 8
  total: 26
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-11T12:00:00Z
**Depth:** deep
**Files Reviewed:** 82 primary (plus cross-referenced callers: backend idempotency middleware/hash/TTL, session-refresh, react-query defaults, expiry sheet)
**Status:** issues_found

## Summary

Deep review of the Phase 11 offline core: SQLite layer, outbox store/coalescing/drain, executors, transport, cache persister and fold/reconcile, session transitions, boot, connectivity, and the hooks/components that write through the outbox. Backend `occurredAt` additions and the E2E/build scripts were also checked.

What holds up: every SQL statement uses positional parameters (the only interpolations are compile-time constants `STATE_LIST` / `OPEN_STATES`), so no SQL injection was found. Server idempotency hashing is canonical (key-sorted), so client key-order differences after zod parsing are harmless. Release-bundle gating of the E2E flag/key and credentials is in place. No file exceeds 800 lines (largest reviewed source is 447 lines).

What does not hold up: the exactly-once guarantee has two client-side holes (a drain/coalesce race that drops or resurrects user changes, and an unvalidated coalesce merge that produces rows the store silently hides forever). A transient token-refresh failure parks the whole queue in `paused_auth` with no path back while the user stays signed in. The optimistic pending-op overlay is lost on ordinary refetches and on per-op server results, and pantry quantity edits are then converted to deltas against the wrong base, which writes wrong quantities to the server. The persisted offline cache is deleted by React Query GC in any session that did not run `hydrateAll`, which includes every first sign-in.

## Critical Issues

### CR-01: Drain/coalesce race silently loses merged changes or sends cancelled ops

**File:** `frontend/lib/offline/outbox/drain.ts:104-123`, `frontend/lib/offline/outbox/store.ts:119-131,151,89-105`
**Issue:** `nextReady` reads the op outside any transaction, then `sendOne` awaits `markInFlight` (a separate serialized transaction) and finally sends the **in-memory snapshot** `op`. An `enqueue` transaction can run in between. `isUnattempted` still sees the row as `queued`/0 attempts/no error, so `planEnqueue` merges into it or drops it:
- Merge: pantry stepper +2 then +3. Drain read `delta: 2`, the enqueue rewrites the row to `delta: 5`, drain sends `+2`, then `complete(seq)` deletes the row. The extra `+3` is lost permanently, while the UI showed +5 until the next refresh.
- Drop: +1 then -1 sums to 0, so the row is deleted. `markInFlight` updates 0 rows, the drain still sends `+1`, and the server ends at +1 while the client thinks nothing happened. The same applies to create-then-delete: the server creates an item the client believes is gone.
The window covers `isReachable()` (possibly a network probe) plus the `nextReady` queries, so quick double taps while online hit it.
**Fix:** Make claiming atomic and send what was claimed:
```ts
claim: (seq, expectedUpdatedAt) => mutate(async (tx) => {
  const r = await tx.run(
    `UPDATE outbox SET state='in_flight', updated_at=? WHERE seq=? AND state='queued' AND updated_at=?`,
    [now(), seq, expectedUpdatedAt]);
  return r.changes === 1 ? getBySeq(tx, seq) : null;   // fresh row or lost race
}),
// drain: const claimed = await store.claim(op.seq, op.updatedAt); if (!claimed) continue; executor.run(claimed, ...)
```
Alternatively, do `nextReady` + mark in one transaction and re-read the row there.

### CR-02: Coalescing a pantry.update into a pending pantry.create writes an invalid row the store then hides forever

**File:** `frontend/lib/offline/outbox/coalesce.ts:39-43`, `frontend/lib/offline/outbox/store.ts:93-96`, `frontend/lib/offline/outbox/store-rows.ts:28-56`, `frontend/lib/offline/outbox/op-types.ts:39-63`
**Issue:** `pantryPatch` allows `null` for `expiryDate`, `purchaseDate`, `location`, `notes` and `barcode`, but `pantryCreate` allows only `string | undefined`. `planUpdate` spreads the patch into the create item (`{ ...item, ...patch }`), and the merge path writes `payload_json` with **no schema validation**. On every read, `rowToOp` runs `NewOpSchema.parse`, fails, logs `skipping invalid row`, and returns `null`. Two real UI paths trigger this: "Clear date" in the expiry sheet (`onSave(null)` → `{ expiryDate: null }`), and clearing a barcode in the edit modal (`barcode: data.barcode || null`) on an item created offline. Result:
- The created item is never sent. `list()` and `nextReady` filter the row out, so it is lost silently.
- The row stays `queued`. The SQL `NOT EXISTS ... OPEN_STATES` in `nextReady` still sees it, so **every later op on that entity is blocked forever**.
- It does not appear in the pending sheet and cannot be discarded. `counts()` (raw SQL) still counts it, so the logout warning and indicator disagree with the sheet.
**Fix:** Validate every merged payload before writing, and strip nulls when merging into a create:
```ts
// coalesce.ts planUpdate (create branch)
const merged = Object.fromEntries(Object.entries({ ...item, ...patch }).filter(([, v]) => v !== null));
// store.ts merge branch
const checked = NewOpSchema.parse({ kind: target.kind, label: target.label, payload: plan.payload });
```
Also make `rowToOp` failures visible: park the row as `failed`/`invalid` instead of hiding it, so the user can discard it and dependents are not stuck.

### CR-03: A transient refresh failure parks the whole outbox in `paused_auth` with no way back while signed in

**File:** `frontend/lib/offline/outbox/classify-error.ts:41`, `frontend/lib/offline/outbox/drain.ts:80-83`, `frontend/lib/api/session-refresh.ts:81-88`, `frontend/lib/offline/session/apply-transition.ts:73-75`
**Issue:** When an outbox request gets a 401 and `/auth/refresh` fails **transiently** (offline blip, timeout, 5xx), `createAuthErrorHandler` rethrows the original 401 and does not expire the session (by design, SYNC-07). The drain classifies it as `pause-auth`, and `pauseAuth` moves all `queued` and `in_flight` ops to `paused_auth`. The only caller of `resumeAuth` is the `resume-user-ops` transition, which runs only on a user-id change. The user is still signed in, so the queue never syncs again until they log out and back in. `retry`/`retryAll` handle only `failed`. This is likely on flaky grocery-store cellular networks. While paused, the `cook.apply` / `shopping.finish` barriers (which ignore `paused_auth`, see WR-03) let later ops overtake the paused pantry/shopping ops.
**Fix:** Pause only when the session actually ended. Otherwise treat it as transient:
```ts
// classify: 401 -> pause only if the session is gone
if (s === 401) return ctx.sessionActive() ? { kind: 'retry', countsAttempt: true } : { kind: 'pause-auth' };
```
Also resume on any successful authenticated request or token refresh (for example, `writeTokens` hook → `store.resumeAuth(userId); drain.kick('token')`), and on foreground when a user is present.

### CR-04: The pending-op overlay is dropped by plain refetches and per-op results, so quantity edits produce wrong server deltas

**File:** `frontend/lib/offline/reconcile/apply-result.ts:35-42`, `frontend/lib/hooks/use-pantry.ts:26-40,78-88`, `frontend/lib/offline/ops/pantry-ops.ts:16-22`, `frontend/components/cook/cooked-it-sheet.tsx:156`, `frontend/lib/hooks/use-shopping-list.ts:104-112`
**Issue:** Pending ops are folded over server data only in `doRefresh` and `foldPendingOps`. Two other paths write raw server state into the canonical keys:
1. `applyResult` for `pantry.adjust/update/create` replaces the cached item with the server row, which erases the optimistic effect of **later** still-pending ops on the same item.
2. Ordinary query refetches (`refetchOnMount` after the 5-minute `staleTime`, the shopping list's `refetchOnWindowFocus: true`, undo's invalidate, and the cooked-it sheet's unconditional `invalidateQueries(pantry.all)` even when the cook was queued) do not fold pending ops.
`usePantryPatch` and the edit modal turn an absolute quantity into `delta = typed - displayed`. When "displayed" no longer includes a pending delta `d1`, the server ends at `typed + d1`. Example: server 3, queued +2 (paused or failed per CR-03, or still in flight). A refetch shows 3, the user sets 6, and `+3` is queued. The server ends at 8. This is persistent data corruption, not a display glitch. `rollbackOp` for a discarded adjust likewise subtracts from a base that never included it.
**Fix:** Route every canonical-key write through the fold. Wrap the canonical `queryFn`s (pantry all, cook pantry, shopping active, meal plans) so they return `reapplyForKey(key, serverData, await store.list(userId))` on native, and in `applyResult` re-fold the remaining ops for that entity after substituting the server row. Remove the unconditional pantry invalidate in `cooked-it-sheet.tsx:156` when `result === null` (queued).

### CR-05: Persisted offline cache rows are deleted by React Query GC in sessions that did not run `hydrateAll`

**File:** `frontend/lib/offline/cache/query-persister.ts:107-120,140-142`, `frontend/lib/offline/session/user-scope.ts:42-44`, `frontend/lib/react-query.ts:10`
**Issue:** The persister deletes the SQLite row on every `removed` cache event (unless suspended). `gcTime: Infinity` for persisted prefixes is set **only inside `hydrateAll()`**. `hydrateAll` does not run on a first sign-in, after logout and re-login (meta is cleared, so the plan is `set-meta-user`), on an account switch, or at boot with no user. In all of those sessions the global `gcTime` is 10 minutes. Leave the pantry page for 10 minutes and the pantry query is garbage-collected, the `removed` event fires, and `DELETE FROM cache_entries` runs. A later offline cold start then has no pantry, recipes or shopping list, which defeats OFF-01/02.
**Fix:** Set the GC defaults once when the persister is created or started, not in `hydrateAll`. Also ignore GC removals and delete rows only on explicit wipes:
```ts
const start = () => {
  for (const prefix of GC_PREFIXES) queryClient.setQueryDefaults(prefix, { gcTime: Infinity });
  return queryClient.getQueryCache().subscribe((event) => { ... if (event.type === 'removed') { cancel(hash); return; } ... });
};
```

## Warnings

### WR-01: Native `query()` bypasses the connection serializer, so reads observe other tasks' uncommitted transactions

**File:** `frontend/lib/offline/sql/native-sqldb.ts:45-48`
**Issue:** `run`/`exec`/`transaction` are serialized on the single plugin connection, but top-level `query` is not. While another task holds `BEGIN`, a top-level `nextReady`/`list`/`counts` runs on the same connection inside that open transaction. It sees uncommitted rows that may be rolled back, and it can interleave with migration DDL. This also widens CR-01.
**Fix:** Wrap top-level `query` in `guard(...)` the same way as `run`. Inside a transaction keep it direct.

### WR-02: `insertRow` trusts `lastInsertRowid` via a cast

**File:** `frontend/lib/offline/outbox/store.ts:71`
**Issue:** `res.lastInsertRowid as number`. If the plugin omits `changes.lastId`, which is optional in `ChangesLike`, `getBySeq(undefined)` returns `null`, so `enqueue` reports "dropped/no op" for a row that was inserted. `queueCook` and `applyQueuedFinish` then skip the optimistic update.
**Fix:** If `lastInsertRowid` is not a finite number, re-select by `op_id` (generate it before the insert and query `WHERE op_id = ?`).

### WR-03: `cook.apply` / `shopping.finish` barriers ignore failed, blocked and paused ops

**File:** `frontend/lib/offline/outbox/store.ts:108-116`
**Issue:** The barrier counts only `queued`/`in_flight`. A failed or blocked shopping-item check-off, or any `paused_auth` op (CR-03), lets `shopping.finish` run first. The trip is then recorded without those items, and the later retry 404s and parks. `cook.apply` similarly deducts against a pantry missing failed or paused creates and adjusts.
**Fix:** Use `OPEN_STATES` in the barrier query, and surface a blocked finish/cook in the sheet ("waiting on N failed changes").

### WR-04: `doRefresh` applies a snapshot without checking the user or the drain progress since the fetch

**File:** `frontend/lib/offline/runtime.ts:101-120`
**Issue:** (a) `userId` is captured before a multi-page fetch. If the user logs out during it, the snapshot (user A's data) is written into the freshly cleared query client after the wipe, and if B signs in, the persister may store it under B. (b) Ops are listed **after** the snapshot is fetched. An op applied and completed in between is missing from both, so its effect disappears (and with an empty outbox it is persisted). An op applied server-side but still `in_flight` is folded twice (see WR-07).
**Fix:** Re-check `getUserId() === userId` (and a session epoch counter) before `applySnapshot`. List ops **before** fetching and fold `ops ∪ ops-still-present-after`, or skip applying when the drain completed ops during the fetch and re-run instead.

### WR-05: `canPersist` check-then-write race can persist optimistic state, which is double-applied on cold start

**File:** `frontend/lib/offline/cache/query-persister.ts:69-84`, `frontend/lib/offline/runtime.ts:62-73`
**Issue:** `writeKey` awaits `canPersist()` (enqueuing counter plus an async `store.list`) and **then** dehydrates the current cache. Hooks apply optimistic state in `onMutate` before `runtime.enqueue` increments `enqueuing`. If a scheduled write is executing at that moment, `list()` returns `[]`, the write passes, and it dehydrates state that already includes the optimistic delta. The enqueue then commits. On an offline cold start, `foldPendingOps` applies the adjust a second time, and per CR-04 the user's next edit computes its delta from the doubled value.
**Fix:** Take the dehydrated snapshot first, then check, both inside one serialized step. Better, stamp each cache write with the outbox high-water `seq` and on hydrate fold only ops with `seq >` the stamp.

### WR-06: Any parked op freezes all cache persistence indefinitely

**File:** `frontend/lib/offline/runtime.ts:68-72`
**Issue:** `canPersist` returns false whenever `store.list(userId).length > 0`, including `failed` ops that wait for a user decision indefinitely. Recipes, meal plans and preferences fetched online after that are never written to disk, so offline cold starts show arbitrarily old data.
**Fix:** Block persistence only for keys affected by pending ops, by entity type: pantry for pantry ops, shopping for shopping ops. Or persist the server-confirmed snapshot separately from the folded view (see WR-05).

### WR-07: Fold re-applies in-doubt ops whose request already reached the server

**File:** `frontend/lib/offline/outbox/fold.ts:66-69`, `frontend/lib/offline/reconcile/reapply.ts:13-25`
**Issue:** `reapplyForKey` folds every op in every state over a fresh server snapshot. A `pantry.adjust` that timed out after the server committed (`lastError` set, still queued or in flight) is already in the snapshot and gets added again. Combined with CR-04, the displayed quantity is wrong exactly when the user is most likely to correct it.
**Fix:** Do not fold attempted ops (`attempts > 0 || lastError !== null || state === 'in_flight'`) into the authoritative quantity. Show them as "syncing" markers instead, or resolve them first by replaying (idempotent) before the refresh is applied.

### WR-08: Connectivity can stay "offline" indefinitely with no re-probe, and the offline gate then blocks every API call

**File:** `frontend/lib/offline/connectivity/connectivity.ts:69-84`, `frontend/lib/offline/outbox/drain.ts:58-69`
**Issue:** One outbox network failure or timeout calls `reportNetworkFailure()` (`probed = 'offline'`). Nothing re-probes on a schedule. `setHint(true)` does not trigger a probe, and `armTimer` arms only for ops whose `nextAttemptAt` is in the future (a network failure sets ~1 s, but after the next failed probe the op is "ready" and no timer is armed). Meanwhile `registerOfflineGate` makes `apiClient` reject every request, including login, AI and reads. Recovery waits for an app foreground or a new write.
**Fix:** While the state is `offline` and the native hint is not false, schedule a periodic probe with backoff (for example 5 s, 15 s, 30 s, then 60 s). Also run a probe on `setHint(true)`.

### WR-09: Server idempotency TTL (48 h) is shorter than plausible offline periods for in-doubt ops

**File:** `frontend/lib/offline/outbox/drain.ts:104-123` (client), `backend/src/config/env.schema.ts:72` (TTL), `backend/src/middleware/idempotency.middleware.ts` (expired → takeOver)
**Issue:** An op whose request reached the server (timeout or app kill while in flight) is replayed with the same key. If the device stays offline for more than 48 h (a weekend trip), the key has expired, the server re-executes it, and `pantry.adjust` / `shopping.finish` / `cook.apply` (recipe target) are applied twice. The client has no age guard.
**Fix:** Have the client park attempted ops older than TTL minus a margin as `conflict` ("this change may already be saved, review it"). Alternatively make adjust/finish carry a client op id that the server dedupes permanently per entity.

### WR-10: `retry()` does not reset `attempts`, so a max-attempts op gets only one more try

**File:** `frontend/lib/offline/outbox/store.ts:179-188`, `frontend/lib/offline/outbox/classify-error.ts:29-31`
**Issue:** An op parked with `max-attempts` has `attempts = 7`. After a user retry, the first transient failure hits `attempts + 1 >= 8` and the op is parked again immediately. Backoff also starts at the 30 s cap.
**Fix:** `UPDATE outbox SET state='queued', attempts=0, next_attempt_at=0 ... WHERE seq=?` on manual retry.

### WR-11: `pending_scan` rows (user id plus barcode) survive account deletion and logout wipes

**File:** `frontend/lib/offline/session/apply-transition.ts:55-61`, `frontend/lib/offline/cache/cache-meta.ts:30-36`, `frontend/lib/offline/outbox/store.ts:197-198`
**Issue:** `delete-user-ops` deletes only `outbox`. `wipeCache` clears `cache_entries`, `cache_meta` and `barcode_cache`, but not `pending_scan`. After account deletion, the user's scan history stays on the device. This contradicts the privacy labels and deletion promises in `docs/store/PRIVACY-LABELS.md`.
**Fix:** Delete `pending_scan WHERE user_id = ?` in `deleteForUser` (same transaction), and include it in the deletion transition.

### WR-12: Discarding a pending change has no error handling

**File:** `frontend/components/offline/pending-changes-sheet.tsx:46-51`
**Issue:** `handleDiscard` awaits `discardOp` outside the `run()` wrapper, so a SQLite failure becomes an unhandled rejection with no toast, and the UI gives no feedback.
**Fix:** `run(async (rt) => { await discardOp(rt, seq); toast(UNDONE); })`.

### WR-13: Queued cook invalidates the pantry, which contradicts the "queued writes never refetch" rule

**File:** `frontend/components/cook/cooked-it-sheet.tsx:152-158`
**Issue:** `onSuccess` invalidates `pantry.all` even when `result === null` (queued). When the queue happened because of a flaky but reachable network, this refetch replaces the folded pantry with raw server data and feeds CR-04.
**Fix:** `if (result) void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });`

## Info

### IN-01: Release native build does not scrub inherited E2E env vars

**File:** `mobile/scripts/frontend-build.sh:54-55`
**Issue:** The non-E2E branch runs `npx next build` with the caller's environment. An exported `NEXT_PUBLIC_E2E*` (or a `.env.local`) would be inlined. `verify-bundle.sh` catches markers, but only if it runs, and it checks the password only when `E2E_PASSWORD` is set in that shell.
**Fix:** `env -u NEXT_PUBLIC_E2E -u NEXT_PUBLIC_E2E_EMAIL -u NEXT_PUBLIC_E2E_PASSWORD -u NEXT_PUBLIC_E2E_SUITE -u NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY BUILD_TARGET=native ... npx next build`.

### IN-02: `useOfflineStatus` is not reactive to the runtime being set

**File:** `frontend/lib/offline/status/use-offline-status.ts:23-31`
**Issue:** `getOfflineRuntime()` is read during render with no subscription. Components that render before a slow boot finishes keep `null` and `useIsOnline() === true` until something else re-renders them.
**Fix:** Subscribe through `whenOfflineRuntime` (`useSyncExternalStore` on the runtime slot).

### IN-03: Status source can commit an older `list()` result after a newer one

**File:** `frontend/lib/offline/status/status-source.ts:67-80`
**Issue:** Concurrent `refresh()` calls, one per store notify, resolve out of order, so stale counts can win.
**Fix:** Use a sequence counter and drop results from older calls.

### IN-04: Mutation against project immutability rule

**File:** `frontend/lib/offline/runtime.ts:212-214,223-227`
**Issue:** `Object.assign(extras, extra)` and reassigning `runtime.dispose` mutate shared objects (CLAUDE.md / global rules require immutable patterns).
**Fix:** Keep `extras` as a replaced reference (`extras = { ...extras, ...extra }`) and compose `dispose` before constructing the object.

### IN-05: `applyResult` for `pantry.create` uses `map`, not upsert

**File:** `frontend/lib/offline/reconcile/apply-result.ts:41`
**Issue:** If the drain applies the create before the add modal inserts its optimistic row (`add-pantry-item-modal.tsx:199-214` awaits `pending.add` first), the server row is never inserted until the next refresh.
**Fix:** Upsert (append when absent) for `pantry.create`.

### IN-06: Edit modal optimistic update skips `COOK_PANTRY_KEY`

**File:** `frontend/components/pantry/edit-pantry-item-modal.tsx:149-155`
**Issue:** Only `PANTRY_ALL_KEY` is patched, so the cook-from-pantry view shows pre-edit values offline.
**Fix:** Use `pantryWrites(...)` from `reconcile/cache-writes.ts`.

### IN-07: Derived preview key can exceed the server's 255-char limit

**File:** `frontend/lib/offline/outbox/store.ts:7`, `frontend/lib/offline/outbox/executors/cook.ts:30`
**Issue:** `KEY_RE` accepts caller keys up to 255 characters. `${key}.preview` adds 8, and the server rejects it (`IDEMPOTENCY_KEY_INVALID` → park invalid). Current callers use 36-char UUIDs, so this is latent.
**Fix:** Cap caller keys at 200 in `KEY_RE`.

### IN-08: `OfflineBootGate` can stay on `booting` under a double-invoked effect

**File:** `frontend/components/offline/offline-boot-gate.tsx:28-68`
**Issue:** With StrictMode (dev), the first effect's cleanup sets `cancelled = true` and the second effect returns early on `started.current`, so `setPhase` never runs and the app renders nothing.
**Fix:** Keep the boot promise in a module-level singleton and let each effect instance subscribe to it with its own `cancelled` flag.

---

_Reviewed: 2026-10-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
