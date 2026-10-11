# Phase 11: Offline Core - Research

**Researched:** 2026-10-11
**Domain:** Capacitor 8 iOS offline-first (SQLite persistence, React Query cache hydration, custom outbox, connectivity, optimistic UI) on top of an Express/Prisma REST API with Idempotency-Key support
**Confidence:** MEDIUM-HIGH (codebase findings HIGH; SQLite plugin runtime behaviour on-device MEDIUM until the first Simulator spike)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reads: persist the React Query cache to native SQLite (`@capacitor-community/sqlite` or the best maintained SPM-compatible option - verify) on native; IndexedDB fallback on web is optional. Hydrate at cold start BEFORE first render so airplane-mode launch shows data (this closes the Phase 9 cold-start gap for the rules engine). Initial/refresh fill via `GET /sync/bootstrap` paging; versioned cache schema with safe migration/wipe.
- Writes: a custom persisted outbox (NOT RQ paused mutations): each op has client UUID, Idempotency-Key, createdAt, type, payload, status, attempts, lastError. Stored in the same native SQLite. A single sequential drain worker (ordered per entity), exponential backoff, drains on app foreground, connectivity regain, and after each enqueue. Treat hung requests (weak signal) via short timeouts so offline is detected, not 30 s spinners.
- Optimistic UI: updates apply to the local cache immediately and are reconciled after drain; rollback + visible message on definitive failure.
- Offline-capable ops (v1): shopping add/edit/delete/check; pantry add/edit/delete, quantity as deltas via adjust, expiry; barcode scan (known products from a local OFF-lookup cache, unknown saved with code and resolved later); meal plan item mark; cooked-it and finish-trip QUEUED (applied on reconnect with clear conflict messages, using Phase 8 occurredAt and same-transaction merge). Online-only: AI, account/auth actions, recipe create/edit/import unless trivially safe, meal plan generation.
- Conflict policy: last-write-wins per field, delete wins, quantity deltas sum and clamp at 0, server errors with codes (409/404/410/422) map to user-readable outcomes; a failed op is parked (not retried forever) and shown in a "Pending changes" screen with retry/discard.
- Status UI (OFF-05): a persistent small connectivity/pending indicator and a Pending changes sheet (list, retry, discard); use the existing design system and the Phase 10 native chrome rules.
- Durability (OFF-09): outbox + cache survive app kill and reboot; exactly-once via idempotency keys; test with automated kill/relaunch in the Simulator and unit/integration tests with a fake flaky server.
- Auth offline: access token expiry offline must not log the user out; use refresh on reconnect (Phase 8); never wipe the outbox on 401.
- Keep the web app working: the offline layer is feature-detected; web build must not regress (Vercel build unchanged).

### Claude's Discretion
Library choices (verify maintenance), schema, file layout, exact backoff/timeouts, UI copy. Rules: small files, immutability, zod validation at boundaries, tests (80%+), additive backend changes only if needed (list any in the plan; do NOT deploy backend).

### Deferred Ideas (OUT OF SCOPE)
- Delta-pull incremental sync, household sharing, offline AI (Phase 13), purchase gating (Phase 12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OFF-01 | Open app with no connection and see pantry, shopping list, recipes, meal plans from last sync | SQLite KV persister + bootstrap seeding + pre-render hydrate gate; recipes/meal-plans pages are NOT React Query today (must be migrated, see Pitfall 1) |
| OFF-02 | Add/edit/delete/check shopping items offline | Outbox ops `shopping.item.{create,update,delete}`; client UUID create already accepted by backend (`body('id').optional().isUUID()`); reuse `lib/shopping/list-cache.ts` reducers |
| OFF-03 | Pantry add, qty, expiry offline; qty merges as deltas | Ops `pantry.create` (client id), `pantry.adjust` (`POST /pantry/:id/adjust {delta}`), `pantry.update`, `pantry.delete`; coalesce only un-attempted deltas |
| OFF-04 | Scan barcode offline; unknown saved with code, resolved later; known from local cache | `barcode_cache` table seeded from pantry + every successful lookup; `needsReview` pending-scan flow; native scanner is already offline-capable (VisionKit/Capacitor scanner) |
| OFF-05 | Connectivity + pending status, see/retry/discard failed ops | `SyncStatusIndicator`, `OfflineBanner`, `PendingChangesSheet` per 11-UI-SPEC; derived from outbox store subscription |
| OFF-06 | Cook offline (view, servings scaling); Cooked it and Finish trip queue and apply on reconnect with conflict messages | Cooked-it = two-phase queued op (resolve defaults via preview at drain time, persist body, then apply with the same key); Finish = queued with `occurredAt`, list locked while pending |
| OFF-07 | View and mark meals in the meal plan offline | Meal plans must move to RQ + persisted cache; "mark" = queued cook op against `mealPlanItemId` (only server-side mark that exists, see Open Question 1) |
| OFF-09 | Queued changes survive kill and reboot, applied exactly once, LWW per field with delete-wins | Atomic SQLite insert per enqueue; `in_flight` rows reset to `queued` on boot; same Idempotency-Key on every retry; never mutate a payload after first send |
</phase_requirements>

## Summary

The backend groundwork is done and is sufficient for almost all of Phase 11. Verified in code: `Idempotency-Key` middleware is mounted on the pantry, shopping, mealplan and cook routers (`backend/src/middleware/idempotency.middleware.ts`); `POST /pantry/:id/adjust {delta}` exists (decimal, max 2 dp, non-zero, clamped); `POST /pantry` and `POST /shopping/items` accept an optional client `id` UUID; `POST /shopping/finish` accepts `occurredAt` with a 14-day receipt window; `GET /sync/bootstrap` is a keyset-paged snapshot (sections pantry then recipes then mealPlans, with the active shopping list attached to the first page only). The client has refresh-token handling (`lib/api/session-refresh.ts`) that only expires the session on a definitive 401/403 from `/auth/refresh`. [VERIFIED: codebase grep]

The frontend is the real work, and it is less ready than CONTEXT.md assumes. (1) Only pantry, shopping list, preferences and notification stats use React Query. The **recipes page, meal plans page, dashboard, and budget/analytics pages fetch with `useEffect` plus local `useState`**, so persisting the React Query cache alone will not make recipes or meal plans visible offline (OFF-01, OFF-07). (2) Pantry list filtering is server-side with the filter in the query key. (3) The Cooked-it flow depends on a server `preview` and the server has no `occurredAt` for `cook/apply` (it stamps `new Date()`), so a queued cook needs a client-side two-phase design (no backend change required). (4) Vitest runs in a `node` environment and only includes `lib/**/*.test.ts`, so all new logic must live in pure `lib/offline/**` modules behind injected interfaces; there is no jsdom/React Testing Library.

**Primary recommendation:** Build a `frontend/lib/offline/` layer around three small interfaces (`SqlDb`, `Connectivity`, `Transport`) so everything is unit-testable in Node (with `node:sqlite` as a real-SQL fake), use `@capacitor-community/sqlite` 8.1.1 (SPM-capable) and `@capacitor/network` 8.0.1 only on native behind `loadPlugin`, persist the RQ cache with a hand-rolled per-key `dehydrate`/`hydrate` (no new TanStack package), route every offline-capable write through one outbox facade (direct API call on web), and verify offline E2E on the Simulator with an in-app forced-offline switch in the existing `KITCHA_E2E` runner (real airplane mode stays `human_needed`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Durable cache + outbox storage | Native SQLite (device) | none | Unsynced writes must not live in evictable WKWebView storage (research-v2/03 section 3) |
| Cache hydration before first render | Browser/Client (React boundary) | Native SQLite | Gate inside `Providers` so Phase 9 rules engine sees data at cold start |
| Initial/refresh fill | API (`/sync/bootstrap`) | Client pager | Server owns the snapshot; client pages and writes entity query keys |
| Write queue, backoff, drain | Browser/Client (pure TS worker) | API (idempotency) | No background execution on iOS; worker runs in the WebView, server provides exactly-once |
| Exactly-once / replay safety | API (Idempotency-Key middleware) | Client (stable key per op) | Already implemented in Phase 8 |
| Conflict resolution (delta clamp, delete-wins) | API | Client (reducers for optimistic display) | `adjust` clamps server-side; client mirrors for display |
| Connectivity detection | Client (`@capacitor/network` hint + `GET /health` probe) | API `/health` | `navigator.onLine` lies on weak signal |
| Barcode offline resolution | Client (local cache) | API `/food/barcode` | OFF cached server-side only today; add client cache |
| Cooked-it deduction plan | API (`cook/preview` + `apply`) | Client composes at drain time | Plan depends on live lots; never replay stale client plan |
| Status UI | Client | none | 11-UI-SPEC |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor-community/sqlite` | 8.1.1 (npm latest, modified 2026-09-28; peer `@capacitor/core >=8.0.0`) | Native SQLite for outbox + cache | Ships a `Package.swift` (SPM) with deps SQLCipher.swift >=4.14 and ZIPFoundation >=0.9, iOS 15 target, MIT, repo capacitor-community/sqlite, created 2020. Matches the project's SPM setup. [VERIFIED: npm view + inspected tarball Package.swift] |
| `@capacitor/network` | 8.0.1 (modified 2026-10-09; peer `@capacitor/core >=8.0.0`) | Connectivity hint events (`networkStatusChange`) | Official Capacitor plugin (ionic-team/capacitor-plugins). Works on web too. [VERIFIED: npm view] |
| `@tanstack/react-query` | existing ^5.90.8 (`dehydrate`, `hydrate`, `QueryCache.subscribe`) | Cache hydrate/dehydrate | Already installed; avoids adding `@tanstack/react-query-persist-client` 5.104.1 [VERIFIED: package.json] |
| `zod` | existing ^4.1.12 | Validate persisted rows, bootstrap pages, op payloads at the storage boundary | Project rule: validate at boundaries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:sqlite` (Node 24.9 built in, experimental warning) | Node v24.9.0 locally | Real-SQL fake for Vitest `SqlDb` adapter | Schema, migration, outbox ordering, crash-recovery unit tests. Verified it opens `:memory:` here. [VERIFIED: ran it] |
| existing `@capacitor/app` 8.1.2 | installed | `appStateChange`/`resume` for drain triggers | Already used in `token-storage.ts` |
| existing `react-hot-toast`, `lucide-react`, Radix `Modal` | installed | UI-SPEC surfaces | No new UI deps (UI-SPEC registry safety) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@capacitor-community/sqlite` | `@capawesome-team/capacitor-sqlite` | 404 on npm under both `@capawesome-team/` and `@capawesome/` scopes; research-v2/03 mentions a Capawesome alternative but it is a paid/insiders plugin, not on the public registry. Not usable. [VERIFIED: npm view 404] |
| `@capacitor-community/sqlite` | `@capacitor/preferences` (UserDefaults) | Not for large blobs, not transactional. Only fine for tiny flags. |
| `@capacitor-community/sqlite` | IndexedDB (`idb-keyval` 6.3.0) | Evictable in WKWebView; no atomic multi-row queue semantics. Allowed only as optional web fallback. |
| hand-rolled per-key persister | `@tanstack/react-query-persist-client` 5.104.1 + `createAsyncStoragePersister` | Blob-per-cache with ~1 s throttled write: a kill within ~1 s loses the last change. Per-key rows are crash-safer. The outbox is not in this blob anyway, so either is acceptable; per-key avoids a new dependency and a giant JSON rewrite at pantry sizes of hundreds of rows. |
| custom outbox | RQ paused mutations / PowerSync | Locked decision: custom outbox. |

**Installation:**
```bash
# frontend/ (JS side) and mobile/ (so cap sync generates the SPM entries; mirror Phase 10 which lists plugins in both package.json files)
npm install @capacitor-community/sqlite@8.1.1 @capacitor/network@8.0.1 --save-exact
# mobile/
cd ../mobile && npm install @capacitor-community/sqlite@8.1.1 @capacitor/network@8.0.1 --save-exact && npx cap sync ios
```
`mobile/scripts/verify-deps.mjs` exists and enforces dependency parity; update it for the two new plugins. After `cap sync`, `CapApp-SPM/Package.swift` is regenerated by Capacitor (do not hand-edit). First iOS build resolves SQLCipher.swift and ZIPFoundation over the network once. [ASSUMED: `verify-deps.mjs` behaviour not read in detail]

**Version verification:** `npm view @capacitor-community/sqlite version` returned 8.1.1 (time.modified 2026-09-28); `npm view @capacitor/network version` returned 8.0.1 (2026-10-09). Dist-tag `latest` is 8.1.1. Neither has a `postinstall` script (the `scripts.postinstall` query returned empty). The sqlite package depends on `jeep-sqlite ^2.7.2` (web component for browser use); it only enters the web bundle if imported, so import both plugins only through `loadPlugin(() => import(...))` inside native-only code.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @capacitor-community/sqlite | npm | ~6 yrs (created 2020-07-25) | not measured | github.com/capacitor-community/sqlite | not run (slopcheck unavailable) | [ASSUMED] gate behind `checkpoint:human-verify`; strong signals: named in research-v2/03, has SPM manifest, MIT, active 2026 releases |
| @capacitor/network | npm | official | not measured | github.com/ionic-team/capacitor-plugins | not run | [ASSUMED] same gate; official Ionic scope |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck could not be installed in this session).
**Packages flagged as suspicious [SUS]:** none observed; planner should still insert one `checkpoint:human-verify` before installing the two packages because slopcheck was unavailable.

## Architecture Patterns

### System Architecture Diagram

```
 UI hook (e.g. useToggleShoppingItem)
        |  (1) optimistic setQueryData via pure reducers (lib/shopping/list-cache.ts, new pantry reducers)
        v
 offlineWrite(op)  ----------------- web / offline layer disabled ----> direct apiClient call (unchanged legacy path)
        |  (2) INSERT outbox row (atomic SQLite txn: id, op_id, idempotency_key, user_id, kind, entity_id, payload, state='queued')
        v
 OutboxStore (SqlDb) <----------------- notify subscribers ------------> SyncStatusIndicator / PendingChangesSheet (useSyncExternalStore)
        |
        v  triggers: after enqueue | App resume | Network regain | backoff timer | manual Retry
 DrainWorker (single, sequential, ordered by seq)
        |  (3) reachability: Connectivity.isReachable() = hint AND GET /health (3 s timeout)
        |  (4) pick next 'queued' op whose entity is not blocked; mark 'in_flight'
        v
 Executor[kind] -> Transport (apiClient + Idempotency-Key header + per-op timeout 8-10 s)
        |--- 2xx (incl. Idempotency-Replayed) -> delete op row; patch cache with server row; (aggregate toast)
        |--- network error / timeout / 5xx / 429 / 409 IDEMPOTENCY_IN_FLIGHT -> attempts++, backoff, state back to 'queued'
        |--- 401 -> apiClient refresh interceptor; refreshed -> retried inside Transport; definitive -> expireSession(); queue PAUSED, rows kept
        |--- 400/404/409/410/422 -> state='failed' (parked), cascade-block later ops on same entity, rollback optimistic change
        v
 After drain empties: re-bootstrap (GET /sync/bootstrap paging) -> write entity query keys -> re-apply remaining pending ops over the fresh snapshot

 Cold start: NativeShell/Providers -> OfflineBootGate: open SQLite -> migrate/validate schema -> reset in_flight->queued -> hydrate RQ from cache_entries -> render children
             (fail-open after ~1.5 s with an empty cache + first-launch EmptyState if offline)
```

### Recommended Project Structure
```
frontend/lib/offline/
├── sql/                 # SqlDb interface, native adapter (capacitor-community/sqlite), node adapter (tests only), migrations.ts, schema constants
├── cache/               # query-persister.ts (dehydrate/hydrate per key), cache-keys.ts (whitelist + canonical full-list keys), bootstrap-client.ts (pager), cache-meta.ts (schema version + user id)
├── outbox/              # op-types.ts (zod discriminated union), store.ts, enqueue.ts, drain.ts, backoff.ts, executors/*.ts, classify-error.ts, coalesce.ts, fold.ts
├── connectivity/        # connectivity.ts (state machine), probe.ts, native-network.ts
├── barcode/             # barcode-cache.ts, pending-scan.ts
├── facade.ts            # offlineWrite(), isOfflineEnabled(), feature-detect
└── index.ts
frontend/components/offline/  # SyncStatusIndicator, OfflineBanner, PendingChangesSheet, OfflineBootGate, FirstLaunchOffline
frontend/lib/hooks/            # existing hooks switched to facade; new use-recipes.ts, use-meal-plans.ts (RQ)
```
Each file stays under 200-400 lines (project rule, 800 max).

### Pattern 1: `SqlDb` seam (testability)
**What:** One tiny interface (`exec`, `run`, `query`, `transaction`) with two adapters: native (`@capacitor-community/sqlite`) and Node (`node:sqlite`, tests only). All outbox/cache code takes `SqlDb` by injection.
**When to use:** Always. It is the only way to test SQL in Vitest's `node` environment and it keeps the plugin replaceable (research-v2/03 section 9 mitigation for single-maintainer risk).
```typescript
// Source: design; plugin capabilities from capacitor-community/sqlite README API table (executeSet, transaction, checkConnectionsConsistency)
export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly unknown[]): Promise<{ changes: number }>;
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T>;
}
```

### Pattern 2: Persist the cache per query key, hydrate before render
**What:** `queryClient.getQueryCache().subscribe` writes `dehydrate`d entries (whitelist only) to `cache_entries(key_hash PK, key_json, state_json, updated_at)`; boot reads all rows, zod-validates, and calls `hydrate(queryClient, { queries })`. Set persisted-key `gcTime: Infinity` and `networkMode: 'offlineFirst'`; add a `buster`-style schema version in `cache_meta`.
**Whitelist:** `pantry`, `shopping.active`, `recipes`, `mealPlans`, `preferences`, `cook.pantry/recipes` (Phase 9 keys), notification stats. **Exclude:** `['cook','preview',...]` (gcTime 0, server-computed), AI queries, history pages, anything with PII beyond the above.
**Do not** persist when `queryClient.clear()` runs from `clearUserSessionState` (session expiry): the subscribe handler must ignore `removed` events caused by a session-clear flag, or session expiry will wipe the on-disk cache and the offline outbox context. Explicit logout/account delete wipes it deliberately (see Pitfall 6).

### Pattern 3: Canonical full-list query keys, client-side filtering
Today `usePantryList(filters)` puts category/search in the key and filters on the server. Offline there is no server. Prescribe: one unfiltered key per entity populated by bootstrap (`['pantry','list','all']`, `['recipes','list','all']`, `['mealPlans','list','all']`), and a `select` that filters/sorts in memory (data is ~100s of rows, 100-250 KB per research-v2/03). Online refetch also fetches the full list. This also removes the server search/filters from the persisted key space.

### Pattern 4: Outbox facade with web fallback
`offlineWrite(op)` returns after the SQLite insert and the cache patch. If `!isNative()` (or SQLite unavailable) it calls the legacy direct API function so the web build behaves exactly as today. Hooks keep their optimistic cache code and replace only `mutationFn`. Online writes also go through the outbox on native (single code path, drain fires immediately); this is what makes "queued" and "synced" behave identically.

### Pattern 5: Op taxonomy (zod discriminated union, versioned)
| kind | Endpoint | Idempotency-Key | Coalescing |
|------|----------|-----------------|------------|
| `shopping.item.create` | `POST /shopping/items` (client `id`) | op key | none |
| `shopping.item.update` | `PATCH /shopping/items/:id` | op key | merge fields into an earlier **un-attempted** queued update of same entity (LWW per field) |
| `shopping.item.delete` | `DELETE /shopping/items/:id` | op key | drops un-attempted queued create/update of the same entity; 404 = success |
| `pantry.create` | `POST /pantry` (client `id`) | op key | none |
| `pantry.adjust` | `POST /pantry/:id/adjust {delta}` | op key | sum deltas of un-attempted queued adjusts for same entity (decimal-safe, round 2 dp) |
| `pantry.update` | `PATCH /pantry/:id` | op key | field merge, un-attempted only |
| `pantry.delete` | `DELETE /pantry/:id` | op key | drop un-attempted ops for entity; 404 = success. Enqueue AFTER the 5 s undo window (replace `useDeferredRemove` direct delete) |
| `shopping.finish` | `POST /shopping/finish` with `occurredAt`, `receiptDate` (local calendar date at tap time) | op key | none; locks list while pending |
| `cook.apply` (two-phase) | `POST /cook/preview` then `POST /cook/apply` | key bound to the persisted resolved body | none |
| `pantry.scan-pending` | local only; resolved to `pantry.update` on reconnect | n/a | n/a |

Backend contract facts used here (all [VERIFIED: codebase]): idempotency regex `^[A-Za-z0-9._:-]+$`, 8-255 chars (a UUID passes); same key + different body returns 422 `IDEMPOTENCY_KEY_REUSED`; in-flight duplicate returns 409 `IDEMPOTENCY_IN_FLIGHT` with `Retry-After: 1`; only 2xx responses are stored; replay sets `Idempotency-Replayed: true`.

### Pattern 6: Backoff and timeouts
Per-op timeout 8000 ms (override axios `timeout`, default 30000 in `client.ts`); `/health` probe timeout 3000 ms. Backoff: `min(30s, 1s * 2^attempts) +/-20% jitter`, honor `Retry-After`. Transient errors (network, timeout, 5xx, 429, `IDEMPOTENCY_IN_FLIGHT`) retry indefinitely with visible age but park after a ceiling (UI-SPEC: "Couldn't reach the server after {n} tries") at e.g. 8 attempts for 5xx only; network-unreachable never counts toward the ceiling (offline is not failure). 429 risk is low: pantry limiter 600/window, shopping 600, sync 300 [VERIFIED: rateLimiter.ts], but the apiLimiter is 100/15 min per IP for non-scoped routes; a long drain should not exceed one request in flight.

### Pattern 7: Cooked-it two-phase op (no backend change)
Server `cook/apply` requires explicit `deductions` (array, unique keys) and stamps `cookedAt = new Date()`; the plan comes from `POST /cook/preview` rows (`key`, `unit`, `use`, `status`). Offline the user cannot preview. Queue an **intent** `{ target: {recipeId | mealPlanItemId}, servings, occurredAt }`. At drain time: phase A calls `cook/preview` (non-mutating) and builds default deductions with the existing `toDeductions(editableRows, {})` (mismatch rows excluded by default, same as `cooked-it-sheet.tsx`); **persist the resolved body into the op row before sending** (state `resolved`); phase B calls `cook/apply` with that body and the op's Idempotency-Key. Persisting first is mandatory: if the response is lost and the pantry changed, a re-preview would produce a different body and the retry would hit 422 `IDEMPOTENCY_KEY_REUSED`. Also send `occurredAt` in the body: express-validator chains here are not strict, so an unknown field is ignored today (cookedAt will be sync time until the backend adds support). Additive backend change to list in the plan (do not deploy): accept optional `occurredAt` on `cook/apply` and use `clampOccurredAt` (already exists in `shopping.receipt-window.ts`) for `cookedAt`. Meal-item replay safety: the once-only `cookedAt` marker returns 409 `ALREADY_COOKED`.

### Pattern 8: Finish trip
`POST /shopping/finish` now takes `occurredAt` and a 14-day receipt window, and the merge runs in the same transaction (Phase 8). Client: send `receiptDate = localIsoDate(tap time)` and `occurredAt = tap time ISO`. While a finish op is pending or in flight, lock shopping item edits (UI-SPEC "Trip finishing when online") because carried-over items get new server rows and ops against old ids would 404. Finish must drain after every earlier shopping op (global seq order already guarantees this).

### Anti-Patterns to Avoid
- **Mutating an op after its first send attempt.** Changes the request hash, causing 422 `IDEMPOTENCY_KEY_REUSED`. Coalesce only ops with `attempts = 0` and `state = 'queued'`.
- **Gating on `navigator.onLine` alone or using `networkMode: 'online'`.** On weak signal requests hang; React Query pauses entirely when `onLine` is false. Use `networkMode: 'offlineFirst'` plus the own connectivity module.
- **Relying on RQ `onMutate` context for rollback after restart.** Rollback must come from the outbox row (store the previous value in the op's `inverse` field) so discard after a relaunch can still roll back.
- **Putting the outbox in the same throttled blob as the cache.** Separate tables; outbox writes are immediate and transactional.
- **Invalidating queries while ops are pending.** A refetch overwrites optimistic state. Invalidate only when the outbox for that entity set is empty, then re-apply pending ops over fresh data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exactly-once delivery | Client dedupe tables or timestamps | Server `Idempotency-Key` middleware (Phase 8) + stable per-op key | Already implemented and tested; client only needs key stability |
| Quantity merge/clamp | Client absolute-quantity rewrite | `POST /pantry/:id/adjust {delta}` | Server clamps under the pantry lock; absolute sets overwrite concurrent cook/merge |
| Token refresh on 401 | A second refresh path in the drain worker | Existing `createRefreshCoordinator`/`createAuthErrorHandler` in `apiClient` | Single-flight, already distinguishes definitive vs transient failure; drain just uses `apiClient` |
| Bottom-sheet dialog | New sheet library | Existing `components/ui/modal.tsx` (Radix) | UI-SPEC mandate |
| Toasts | Custom toast system | `react-hot-toast` (already mounted in `Providers`) | UI-SPEC mandate; aggregate one toast per drain |
| UUIDs | Math.random UUIDs | `crypto.randomUUID()` with a `crypto.getRandomValues` fallback | `randomUUID` needs Safari/WKWebView 15.4+; Capacitor 8 targets iOS 15.0 so a fallback is required (Pitfall 9) |
| Persisted query cache machinery | Custom diff/serialize engine | TanStack `dehydrate`/`hydrate` + `QueryCache.subscribe` | Handles dataUpdatedAt, state shape |
| SQL schema testing | A hand-written SQL parser/mock | `node:sqlite` adapter in tests | Real SQL semantics (ordering, constraints, transactions) |

**Key insight:** The hard parts (idempotency, delta clamp, refresh, bootstrap paging) are server-side and done. The client risk is state-machine correctness (crash windows, coalescing, cascade-blocking), so invest tests there, not in new infrastructure.

## Runtime State Inventory

Not a rename/refactor phase. One adjacent concern: this phase **introduces** on-device state (SQLite DB `kitcha.db` in `Library/CapacitorDatabase`, tables `cache_meta`, `cache_entries`, `outbox`, `barcode_cache`, `pending_scan`). Plan an explicit schema-version migration/wipe path from the first release (CONTEXT: "versioned cache schema with safe migration/wipe"): cache tables may be dropped and rebuilt on version bump; the `outbox` table must only ever be migrated forward (never dropped) because it holds unsynced user work.

## Common Pitfalls

### Pitfall 1: Recipes, meal plans, dashboard are not React Query
**What goes wrong:** Persisting the RQ cache leaves recipes and meal plans empty offline (OFF-01/OFF-07 fail). `app/(app)/recipes/page.tsx`, `app/(app)/mealplans/page.tsx`, `app/(app)/dashboard/page.tsx`, `components/shopping/generate-from-plan.tsx` call `recipeApi`/`mealPlanApi` inside `useEffect` with local state. `use-cook-from-pantry` and `cook-first-card` are RQ already. [VERIFIED: grep]
**How to avoid:** Add `use-recipes.ts` and `use-meal-plans.ts` RQ hooks on the canonical full-list keys, switch those pages to them (keep page markup), and have the dashboard read from the same cached lists with `.catch` fallbacks preserved. Budget/analytics are not in scope for offline reads in OFF-01 (document as online-only, show cached if present).
**Warning signs:** Page works online, shows a spinner or empty state in airplane mode.

### Pitfall 2: Pantry list capped / filtered server-side
Phase 8 fixed paging on the web client (`fetchAllPantryItems`), but bootstrap is the source of truth for offline. Make bootstrap the seeding path and keep `fetchAllPantryItems` for online refresh. Quantities arrive as strings (`Decimal`); normalize once at write time into the cache (existing `normalizeItem`) and never persist both shapes.

### Pitfall 3: Bootstrap is not snapshot-consistent and the shopping list is only on page 1
`getBootstrapPage` attaches `shoppingList` only when `cursor === null`; sections go pantry then recipes then mealPlans and pages are explicitly not snapshot-consistent (sync.service.ts header). **How to avoid:** accumulate all pages in memory, validate with zod, then write the cache in one SQLite transaction and one batch of `setQueryData`; never partially replace. Only write the shopping list from page 1. Keep a `lastBootstrapAt` (use `serverTime` from the response) for the "Last synced" copy. Re-apply pending ops after the write so a bootstrap racing an offline edit does not erase it.
Bootstrap omits preferences, notifications and budget: those rely on RQ persistence of their own queries (preferences is critical for Phase 9 diet filtering; mark it in the whitelist and prefetch it right after bootstrap).

### Pitfall 4: Hung requests on weak signal
`apiClient` timeout is 30000 ms. Add a `timeout` per call (8 s outbox ops, 3 s probe) and a connectivity short-circuit in a request interceptor: when `Connectivity.state === 'offline'` reject immediately with a typed `OfflineError` so React Query queries fail fast and keep cached data instead of spinning. `retry: 1` in `react-query.ts` doubles latency; use `retry: false` for queries when offline.

### Pitfall 5: The 401 path and `clearAuth` wiping state
`expireSession()` (definitive refresh failure) calls `clearAuth()` which calls `clearUserSessionState` which does `queryClient.clear()`. The outbox lives in SQLite and is not touched by that function today, but the new persister's `QueryCache.subscribe` would see removals. Also `use-logout.ts` always calls `clearAuth`. Required behaviours: (a) session expiry keeps outbox rows (state `paused-auth`) and keeps cached data on disk; after login as the same `userId` the worker resumes; (b) a different user logging in must not drain or see the previous user's rows (ops carry `user_id`; cache meta carries `user_id`; mismatch wipes cache but **parks the old user's ops untouched**); (c) explicit logout with pending ops should warn ("{n} changes haven't synced") per research-v2/03 section 6. Add a unit test asserting `clearUserSessionState` and `expireSession` do not touch the outbox.

### Pitfall 6: Crash windows
Kill between enqueue and cache patch: patch is re-derivable (fold pending ops over snapshot on boot). Kill with a row `in_flight`: boot resets `in_flight` to `queued`; retry uses the same key so the server replays or applies once. Kill after server commit but before the idempotency completion write is the documented residual risk in the middleware header; nothing client-side can fix it. Idempotency record TTL is configured by `IDEMPOTENCY_TTL_HOURS` (08-CONTEXT says ~24-48 h): an op first attempted, response lost, then offline longer than the TTL could double-apply on retry. Mitigation: on retry of an op with `attempts > 0` and age beyond the documented TTL, for `pantry.adjust` re-read the item before resending, or document as accepted risk in the plan. [ASSUMED: exact TTL default not located]

### Pitfall 7: Error mapping differs from UI-SPEC wording
Backend validation failures return **400** (`AppError(..., 400)`), while UI-SPEC maps 422. Treat 400 and 422 identically (`The server couldn't accept this change...`). 409 has three meanings: `IDEMPOTENCY_IN_FLIGHT` (transient, retry), `ALREADY_COOKED` (conflict; Retry is pointless, recommend Discard-only with the UI-SPEC copy), generic conflict. Classify by `getApiErrorCode()` first, then status. 404 on DELETE is success (delete wins); 404 on update/adjust parks with the "already removed" copy. A 403 `AI consent` path is irrelevant here.

### Pitfall 8: Cascade on parked ops
If `shopping.item.create` parks, later ops on the same entity id would 404. Mark later queued ops for that entity `blocked` (display under "Waiting", drain skips); discarding the parent discards dependents; retrying the parent unblocks. Other entities continue draining (CONTEXT: "ordered per entity").

### Pitfall 9: `crypto.randomUUID` and WKWebView
iOS 15.0 target (Package.swift `.iOS(.v15)`), `randomUUID` is 15.4+. Provide `newId()` with a `getRandomValues` fallback and unit test that the output matches the backend's `isUUID()` (v4) pattern.

### Pitfall 10: SQLite plugin connection lifecycle
The plugin keeps native connections in a registry; after a WebView reload or dev reload "connection already exists" errors occur. The README lists `checkConnectionsConsistency`/`isConnection`/`retrieveConnection` for this; wrap open in a single memoized `getDb()` that checks consistency first and reuses an existing connection. Set `iosDatabaseLocation: 'Library/CapacitorDatabase'` under `plugins.CapacitorSQLite` in `mobile/capacitor.config.ts`, and keep encryption off in v1 (no SQLCipher key management; the data is the user's own grocery data and DB lives in the app sandbox). [CITED: github.com/capacitor-community/sqlite README line 67 for the location option; encryption/consistency details ASSUMED, verify in the Wave 1 spike]

### Pitfall 11: Date and clock
Calendar fields (`expiryDate`, `receiptDate`) stay `YYYY-MM-DD` local strings (`localIsoDate`). "Expiring in N days" shown offline must be computed from cached raw items with the device local date (research-v2/03 section 6); the server expiring-soon query uses UTC and is not cached for offline use. Never order ops by device time; use SQLite `seq INTEGER PRIMARY KEY AUTOINCREMENT`.

### Pitfall 12: Splash and boot gating
`createSplashHider` forces hide after `SPLASH_MAX_MS = 2000` and on first paint. The hydrate gate must finish well under that or the user briefly sees a blank/spinner. Budget: open DB + read cache rows < 500 ms for hundreds of rows; gate fail-opens at ~1.5 s with an empty cache. `ProtectedRoute` already waits on Keychain tokens (local) and a 100 ms timer, so airplane cold start reaches the app shell; verify no query inside `ProtectedRoute`/`OnboardingGate`/`AiConsentHost` blocks on the network (`OnboardingGate` and `AiConsentHost` unread: verify in Wave 1). [ASSUMED]

## Code Examples

### Backoff and error classification (pure, unit-testable)
```typescript
// Source: design, grounded in backend/src/middleware/idempotency.middleware.ts and cook.constants.ts error codes
export type Outcome =
  | { kind: 'ok' }
  | { kind: 'retry'; afterMs: number }   // transient: network, timeout, 5xx, 429, IDEMPOTENCY_IN_FLIGHT
  | { kind: 'pause-auth' }               // 401 that the refresh coordinator could not recover definitively
  | { kind: 'park'; reason: 'gone' | 'conflict' | 'invalid' | 'max-attempts'; code?: string };

export function classify(status: number | undefined, code: string | undefined, isDelete: boolean): Outcome { /* ... */ }
```

### Idempotency header on a drain request
```typescript
// Source: apiClient (frontend/lib/api/client.ts) accepts axios config as 3rd arg on post/patch/delete
await apiClient.post(url, body, { timeout: 8000, headers: { 'Idempotency-Key': op.idempotencyKey } });
```

### Hydrate before first render
```typescript
// Source: @tanstack/react-query hydrate API (already a dependency); gate placement in components/providers.tsx
export function OfflineBootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isOfflineEnabled());
  useEffect(() => { void bootOffline(queryClient).finally(() => setReady(true)); }, []);
  return ready ? <>{children}</> : null; // splash still covers; fail-open timeout inside bootOffline
}
```

### Real SQLite in Vitest (no new dependency)
```typescript
// Source: Node 24 built-in node:sqlite (verified opens :memory: locally)
import { DatabaseSync } from 'node:sqlite';
export function createNodeSqlDb(): SqlDb { const db = new DatabaseSync(':memory:'); /* wrap exec/run/query/transaction */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serwist service worker for offline (old OFF-01..04) | Bundled static export in Capacitor + native SQLite | v2.0 decision | No SW needed on iPhone; web stays online-only |
| RQ paused mutations | Custom persisted outbox | CONTEXT decision | Survives kill, supports park/retry UI |
| 7-day JWT, wipe on 401 | Refresh tokens, wipe only on definitive refresh failure | Phase 8 | Offline expiry does not log out |
| Pantry capped at 50 rows | Bootstrap + `fetchAllPantryItems` | Phase 8 | Full list cacheable |

**Deprecated/outdated:** research-v2/03 proposed `deltaCents` for adjust; the implemented API is `{delta}` (decimal, 2 dp). Use the implemented contract. Research also proposed `@capacitor-community/sqlite` "v8.0.0"; current is 8.1.1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@capacitor-community/sqlite` and `@capacitor/network` are legitimate (slopcheck not run) | Standard Stack | Supply-chain risk; planner gates install behind `checkpoint:human-verify` |
| A2 | `checkConnectionsConsistency`-style connection reuse pattern and `iosDatabaseLocation` config work as described on iOS 26 Simulator | Pitfall 10 | Spike task in Wave 1 may need adjustment |
| A3 | Idempotency TTL default is ~24-48 h (from 08-CONTEXT, not from env schema) | Pitfall 6 | Long-offline double-apply window may be shorter/longer |
| A4 | `OnboardingGate`, `AiConsentHost`, `ReminderRuntime` do not block on network at cold start | Pitfall 12 | Airplane cold start could show a spinner |
| A5 | `mobile/scripts/verify-deps.mjs` needs updating for new plugins | Installation | Parity check fails the build |
| A6 | Unknown JSON fields on `cook/apply` are ignored by express-validator (chains are not strict) | Pattern 7 | `occurredAt` extra field could 400; verify with a backend test before relying on it |
| A7 | Per-key persister write volume is acceptable (hundreds of rows) on device | Pattern 2 | May need batching; measure in the spike |
| A8 | Skipping SQLCipher encryption in v1 is acceptable to the owner | Pitfall 10 | Privacy expectation; sandboxed grocery data only |

## Open Questions

1. **What does "mark" a meal plan item mean for OFF-07?**
   - What we know: `MealPlanItem` has no completed flag besides `cookedAt`, set only by `POST /cook/apply` (once-only). Meal plan update rebuilds items and is online-only per CONTEXT.
   - What's unclear: whether "mark" must work without deducting pantry.
   - Recommendation: treat "Mark as cooked" in the meal plan as the queued `cook.apply` op with `mealPlanItemId` (deducts on sync, consistent with OFF-06 and research-v2/03 "Mark cooked, deduct when online"). If a pure mark is wanted, that is an additive backend endpoint (not planned; flag to the user).
2. **Does the owner want `occurredAt` on `cook/apply`?** Without it, queued cooks get the sync time as `cookedAt`. Additive and small; list as an optional backend task, do not deploy.
3. **Web IndexedDB fallback.** CONTEXT marks optional. Recommendation: skip in this phase (web keeps legacy direct path; indicator never renders), revisit later.
4. **Notification mark-read, preferences edits offline.** Not in the op list; leave online-only.
5. **Persisting Phase 9 `cook.*` queries:** confirm `COOK_PANTRY_KEY`/`COOK_RECIPES_KEY` are the same data as the canonical lists to avoid double storage; if possible alias them to the canonical keys.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, Vitest, `node:sqlite` | yes | v24.9.0 | none needed |
| Xcode / xcodebuild | iOS build, Simulator E2E | yes | Xcode 26.6 (17F113) | none |
| iOS Simulator | offline E2E | yes | iOS 26.5, "iPhone 17 Pro" booted (mobile scripts default to "iPhone 17", fall back to first iPhone) | `SIM_DEVICE` env |
| `xcrun simctl` | install/launch/terminate/screenshot | yes | with Xcode | none |
| jq, curl, openssl | `e2e-smoke.sh` | assumed present (script `require_cmd`) | not probed | scripts abort with a clear error |
| npm registry access | installing 2 plugins | yes (npm view worked) | n/a | none |
| SPM remote fetch (SQLCipher.swift, ZIPFoundation) | first iOS build with sqlite plugin | needs network on first build | n/a | Pre-resolve once; cached after |
| Real iPhone | airplane-mode and reboot confirmation | not available to automation | n/a | `human_needed` |
| slopcheck | legitimacy gate | no (could not install) | n/a | mark packages `[ASSUMED]`, human-verify checkpoint |
| Capacitor `simctl` airplane toggle | automated airplane mode | no such simctl command | n/a | in-app forced-offline switch (see Validation Architecture) |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** slopcheck (human-verify gate); true airplane-mode automation (in-app forced offline + `human_needed` real-device check).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.3 (`@vitest/coverage-v8` 5.0.3), `environment: 'node'`, `include: ['lib/**/*.test.ts']` (`frontend/vitest.config.ts`) |
| Config file | `frontend/vitest.config.ts` (alias `@` to frontend root). No jsdom, no React Testing Library: **component tests are not possible without adding infrastructure**; keep logic in pure `lib/offline/**` and keep components thin (state derived by pure selectors that are unit-tested). |
| Quick run command | `cd frontend && npx vitest run lib/offline` |
| Full suite command | `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint` |
| Coverage | `cd frontend && npx vitest run --coverage` (target 80%+ for `lib/offline/**`, project rule) |
| Backend (if any additive change) | existing backend Jest/Vitest setup (not researched here); backend tests only if the optional `occurredAt` change is taken |
| Web build non-regression | `cd frontend && NEXT_PUBLIC_API_URL=https://example.invalid npm run build` (web target must pass; native imports only via `loadPlugin(() => import())`) |
| Native build | `cd mobile && npm run build:ios` then `npm run verify:bundle` |
| Simulator smoke (existing) | `cd mobile && npm run e2e:ios` (creates a throwaway production account) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OFF-01 | Persister round-trips whitelisted queries; schema-version mismatch wipes cache not outbox; bootstrap pages assemble atomically; hydrate-before-render gate fail-opens | unit (node:sqlite) | `npx vitest run lib/offline/cache` | Wave 0 |
| OFF-01 | Airplane cold start shows pantry/shopping/recipes/plans | Simulator E2E | `mobile` E2E offline script (below) | Wave 0 |
| OFF-02 | enqueue/coalesce/fold for shopping create/update/delete/check; delete cancels un-attempted ops; 404 delete = success | unit | `npx vitest run lib/offline/outbox` | Wave 0 |
| OFF-03 | Adjust deltas sum (decimal-safe, 2 dp), only un-attempted ops coalesce; expiry LWW | unit | `npx vitest run lib/offline/outbox/coalesce` | Wave 0 |
| OFF-04 | Barcode resolution order: own pantry (local) then barcode cache then pending scan; negative cache TTL; LRU cap | unit | `npx vitest run lib/offline/barcode` (+ update `lib/scan/resolve-barcode.test.ts`) | partly exists |
| OFF-05 | State machine: attention > syncing > offline > pending > synced > just-synced priority; labels per UI-SPEC; counts debounce | unit (pure selector) | `npx vitest run lib/offline/status` | Wave 0 |
| OFF-06 | Cook two-phase: resolved body persisted before apply; retry reuses persisted body+key; ALREADY_COOKED parks; finish locks list; `occurredAt` sent | unit with fake transport | `npx vitest run lib/offline/outbox/executors` | Wave 0 |
| OFF-07 | Meal plan hook reads cached list; mark enqueues cook op | unit | `npx vitest run lib/hooks` (pure parts) | Wave 0 |
| OFF-09 | Fake flaky server: drops responses after commit, duplicates, timeouts, 5xx; op applied exactly once; kill simulated by rebuilding worker from the same SQLite file (`in_flight` reset); parked ops don't block other entities; 401 pauses without deleting rows | unit/integration | `npx vitest run lib/offline/drain` | Wave 0 |
| OFF-09 | Kill/relaunch durability on device | Simulator E2E | `mobile` E2E offline script | Wave 0 |

### Verifying offline E2E on the iOS Simulator
`simctl` has no airplane-mode switch. Prescribed approach, reusing the existing harness (`mobile/scripts/e2e-smoke.sh`, `frontend/components/e2e/e2e-runner.tsx`, `KITCHA_E2E {"step":...}` console protocol, `E2E_PHASE_KEY` phase machine in `localStorage`, `simctl terminate/launch --console-pty`):
1. Add an **E2E-only forced-offline switch** in the connectivity module (compiled only when `NEXT_PUBLIC_E2E === '1'`, which `assertNativeEnv` already restricts to native builds): when set, `Connectivity` reports offline and the Transport rejects immediately with `OfflineError`. Persist the flag in `localStorage` so it survives the relaunch.
2. New runner phases appended to the existing flow (login already done in launch 1): **seed** (online, bootstrap completes, assert SQLite row counts), **offline-write** (force offline, enqueue shopping check + pantry adjust(+2, +3) + pantry create + queued finish-trip-free ops, assert outbox count), **kill** (script `simctl terminate`), **offline-cold-start** (relaunch with flag still set; assert `pantry>0`, `recipes>0` visible from hydrated cache before any network and outbox count unchanged), **reconnect** (clear flag, drain, assert outbox 0, then re-fetch from API and assert each op applied exactly once: adjust sum equals +5 once, created ids present once), **replay** (re-run drain with a forged duplicate to assert idempotent replay).
3. Add `wait_for_step` calls in a new `mobile/scripts/e2e-offline.sh` (same structure/EXIT-trap cleanup as `e2e-smoke.sh`, throwaway account, wipe E2E build output at the end because it embeds credentials).
4. Optional extra (not CI): a manual run that turns off host Wi-Fi (`networksetup -setairportpower en0 off`) while the app runs in the Simulator, since the Simulator shares the Mac network. Leave to the human checklist.
5. Real iPhone: airplane mode, force-quit, device reboot, then open app offline and reconnect: `human_needed` (Blockers list in STATE.md). Fold into the existing five deferred real-device verifications.

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run lib/offline` (under ~10 s with isolate workers)
- **Per wave merge:** `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint`, plus web `npm run build`
- **Phase gate:** full suite green, web build green, `npm run build:ios` + `npm run verify:bundle`, Simulator offline E2E pass, 80%+ coverage on `lib/offline/**`, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/lib/offline/sql/node-sqldb.test-helper.ts` (node:sqlite adapter) and migration tests
- [ ] `frontend/lib/offline/test-helpers/flaky-server.ts` (fake transport: configurable drop-response-after-commit, duplicate delivery, latency/timeouts, 401/409/404 scripts, idempotency replay semantic mirroring the middleware)
- [ ] Test files per row in the map above
- [ ] `mobile/scripts/e2e-offline.sh` and runner phases
- [ ] `mobile/scripts/verify-deps.mjs` updated for the two plugins
- [ ] Framework install: none (Vitest present). Do not add jsdom just for this phase.

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json` (absent), so this section applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Reuse Keychain token store and refresh coordinator; never persist tokens in SQLite |
| V3 Session Management | yes | Definitive refresh failure expires session but keeps outbox; user-id scoping of cache and ops |
| V4 Access Control | yes | Ops and cache rows carry `user_id`; drain only the current user's ops; server enforces ownership (client ids returning 404 cross-user, per Phase 8) |
| V5 Input Validation | yes | zod validation of every persisted row on read, bootstrap pages on receipt, op payload on enqueue and before send |
| V6 Cryptography | partial | No custom crypto; random IDs from `crypto.getRandomValues`; DB not encrypted in v1 (A8) |
| V8 Data Protection | yes | Cache wipe on logout/account delete; exclude AI content and receipts from persistence; `NSFileProtection` default for the app sandbox |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in the local store | Tampering | Parameterized `run/query` only; no string-built SQL with user data |
| Cross-user data leak after account switch | Information disclosure | `cache_meta.user_id` check at boot; wipe cache and quarantine other user's ops |
| Stale queued ops replayed against a different account | Spoofing / Elevation | Ops bound to `user_id`; drain filters by current user |
| Idempotency-Key reuse with changed body | Tampering | Never mutate payload post-send; classify 422 `IDEMPOTENCY_KEY_REUSED` as a client bug (park, log) |
| Poisoned or oversized cache rows crash boot | DoS | Zod-validate and drop invalid rows; wrap hydrate in try/catch and fail open to empty cache |
| Sensitive data in logs | Information disclosure | Log op kind/id/status only, never payloads or tokens (existing convention in token-storage) |
| Local-only `needsReview` scan items resolved to wrong product | Integrity | Never auto-overwrite user-edited fields; fill blanks only (reuse `mergeScanIntoForm` semantics) |

## Sources

### Primary (HIGH confidence)
- Codebase (read in this session): `frontend/lib/react-query.ts`, `lib/api/client.ts`, `lib/api/session-refresh.ts`, `lib/api/token-storage.ts`, `lib/hooks/use-pantry.ts`, `use-shopping-list.ts`, `use-finish-shopping.ts`, `use-cook-from-pantry.ts`, `lib/shopping/list-cache.ts`, `lib/scan/resolve-barcode.ts`, `lib/auth/session-cleanup.ts`, `lib/stores/auth-store.ts`, `lib/platform/*`, `components/providers.tsx`, `components/platform/native-shell.tsx`, `components/e2e/e2e-runner.tsx`, `app/(app)/layout.tsx`, `vitest.config.ts`, `next.config.ts`, `lib/build/native-config.ts`; `backend/src/middleware/idempotency.middleware.ts`, `modules/idempotency/*`, `modules/sync/*`, `modules/pantry/pantry.routes.ts` + validation, `modules/cook/*`, `modules/shopping/shopping.receipt-window.ts` + routes/validation, `middleware/rateLimiter.ts`; `mobile/scripts/*`, `capacitor.config.ts`, `CapApp-SPM/Package.swift`
- npm registry (`npm view`): `@capacitor-community/sqlite` 8.1.1, `@capacitor/network` 8.0.1, `@tanstack/react-query-persist-client` 5.104.1, `idb-keyval` 6.3.0; tarball `Package.swift` of sqlite 8.1.1 inspected
- `.planning/research-v2/03-offline-sync.md` (project research), `08-CONTEXT.md`, `11-CONTEXT.md`, `11-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `CLAUDE.md`

### Secondary (MEDIUM confidence)
- capacitor-community/sqlite README (API table: executeSet, transaction, checkConnectionsConsistency, `iosDatabaseLocation: 'Library/CapacitorDatabase'`) from the npm tarball

### Tertiary (LOW confidence)
- On-device behaviour of the SQLite plugin connection lifecycle and write throughput (needs the Wave 1 Simulator spike); Idempotency TTL default

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - versions and SPM support verified; slopcheck unavailable; device behaviour pending spike
- Architecture: HIGH - grounded in verified backend contracts and the existing hook/test structure
- Pitfalls: HIGH for codebase-derived (non-RQ pages, 400 vs 422, cook `occurredAt`, bootstrap shape); MEDIUM for plugin lifecycle

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (stable stack; re-check plugin versions at plan time)

## Recommended Wave Order (for the planner)
1. **Wave 0/1 spike + foundations:** install the two plugins (human-verify checkpoint), `SqlDb` seam + node adapter + native adapter, migrations, flaky-server test helper, a Simulator spike proving open/insert/kill/relaunch/read of the DB.
2. **Reads (OFF-01, OFF-07 view):** persister, bootstrap client, boot gate, canonical keys, migrate recipes/meal plans/dashboard to RQ, pantry client-side filtering, first-launch offline empty state.
3. **Outbox core (OFF-02, OFF-03, OFF-09):** store, enqueue, coalesce, fold, drain, classify, connectivity, shopping and pantry executors, switch hooks via the facade, replace `useDeferredRemove` direct delete.
4. **Status UI (OFF-05):** indicator, banner, sheet, toasts, list-row pending icons, haptics, online-only disabling with "Needs a connection".
5. **Queued cook and finish (OFF-06, OFF-07 mark):** two-phase cook executor, finish lock, conflict copy, optional additive backend `occurredAt` for cook (not deployed).
6. **Offline scan (OFF-04):** barcode cache, pantry seeding, pending scan with `needsReview`, resolve on reconnect.
7. **Auth/session hardening (OFF-09):** user scoping, logout warning, session-expiry keeps outbox, tests.
8. **E2E + verification:** `e2e-offline.sh`, runner phases, coverage gate, web build check, `human_needed` real-iPhone checklist.

## Project Constraints (from CLAUDE.md and global rules)
- Keep Next.js + Express + Prisma + Postgres; no rewrite; Prisma stays on 5.22.x.
- Immutability (never mutate; return new objects), files under 800 lines (aim 200-400), functions under 50 lines, no deep nesting.
- Validate at boundaries with schema validation (zod); handle errors explicitly; never swallow silently; no hardcoded secrets.
- Tests: TDD (RED/GREEN/REFACTOR), 80%+ coverage, unit + integration + E2E.
- Do not add `railway.json`; do NOT deploy backend in this phase; additive backend changes only and list them in the plan; may push to origin main only if all tests green and web build unaffected.
- GSD workflow enforcement: make repo edits through a GSD command.
- UI-SPEC: light mode only, reuse `Modal`, `Button`, `EmptyState`, `lucide-react`, `react-hot-toast`; no new UI dependencies; plain-language copy (never "outbox", "idempotency", "409").
- Commit attribution lines and no-emoji communication rules apply to commits and replies.
