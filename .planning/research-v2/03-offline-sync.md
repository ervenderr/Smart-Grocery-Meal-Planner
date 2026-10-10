# Kitcha offline-first iPhone app: research and recommendation

Date: 2026-10-10. Scope: read-only research. No repo files were modified.
Confidence tags: [H] verified in code or a first-party doc, [M] secondary source or inference, [L] from memory or unverified.

## 0. Recommendation in one paragraph

Wrap the existing Next.js frontend in **Capacitor 8** (static export, assets bundled in the app).
Keep the REST API as the only source of truth. Do **not** adopt a sync engine now.

- **Reads:** persist the React Query cache to a durable store. In the native build that is a SQLite file via `@capacitor-community/sqlite`. In the web build it is IndexedDB.
- **Writes:** use a small custom **outbox** (a persisted FIFO queue of operations). Every operation gets a client UUID and an `Idempotency-Key`. A sync loop drains the queue on resume, on reconnect, and after each enqueue.
- **Conflict policy:**
  - Field-level last-write-wins for checks, edits and deletes.
  - Delta ops for pantry quantity steppers.
  - Server-authoritative, online-only for cook apply, AI, recipe edits and meal-plan edits (v1).
- **Auth:** add refresh tokens, store tokens in the Keychain, and stop the 401 handler from wiping unsynced work.
- **Backend:** about 8 small additive steps (section 7).
- **Effort:** about 22-28 solo dev days for the core (phases 1-5). Optional phases 6-7 add about 8-10 days.
- **Escape hatch:** shape outbox ops as CRUD ops so PowerSync can replace the outbox later without touching the UI.

## 1. What the code says (verified) [H]

### Data model (`backend/prisma/schema.prisma`)

- IDs are `String @default(uuid())`, so client-generated UUIDs are compatible.
- Every table has `updatedAt` (Prisma `@updatedAt`) and `createdAt`.
- Soft delete (`deletedAt`) exists on `pantry_items`, `recipes`, `meal_plans` and `shopping_lists`.
- **Not soft-deleted:** `shopping_list_items` are hard-deleted, so there are no tombstones for them.
- `PantryItem` is a "lot": quantity `Decimal(10,2)`, unit, `expiryDate` and `purchaseDate` as `@db.Date`, and `barcode`. Quantity 0 means "used up".
- `MealPlanItem.cookedAt` is set once by cook apply. `ShoppingHistory.receiptDate` is a `Date`.
- `ShoppingList` has one active list per user, enforced by a partial unique index.

### Server-authoritative operations (these cannot be run from stale client state)

| Operation | Why server-authoritative |
|---|---|
| `POST /cook/apply` | `cook.service.ts` takes `lockUserPantry` (`FOR UPDATE` on all the user's lots, ordered by id) and reads lots ordered by expiry. `allocateDeduction` does FIFO and unit-aware deduction. The once-only `cookedAt` marker is a conditional `updateMany`; a replay gets 409. `cook/preview` computes the plan from live lots. |
| `POST /shopping/finish` | In one transaction: lock the active list, require at least 1 checked item, mark the list completed, create `ShoppingHistory`, `ensureActiveListId`, and carry over unchecked items. |
| bought-it pantry merge | Runs **after** the finish transaction commits (`shopping-pantry.service.ts`, under `lockUserPantry`). The finish and the merge are two transactions, so a crash between them loses the merge. A replay of finish returns `SHOPPING_LIST_EMPTY`, not the original result. |
| `POST /shopping/generate` | Merges a meal plan into the list under the list lock, with unit math in `intelligence/*`. |
| Meal plan update | `mealplan.service.ts` (788 lines) rebuilds meal items; `cookedAt` is carried over. |

### Naturally offline-safe operations (single-row, absolute or flag writes)

- Shopping `PATCH /items/:id` (`isChecked`, `actualCostCents`, quantity, notes) and `DELETE /items/:id`. Both take the list lock briefly.
- Pantry `PATCH /:id` (absolute `quantity`, `expiryDate`) and the soft `DELETE`.
- Pantry `POST /`.

**Gaps that block offline use:**
- `POST /shopping/items` and `POST /pantry` ignore client IDs. The server generates the ID, so an offline-created row cannot be referenced by later queued ops.
- There is no idempotency support anywhere. A request that times out at 30 s (the axios default in `client.ts`) is ambiguous.
- The pantry quantity PATCH is an absolute set. That overwrites a concurrent cook or merge. It is only safe because of the single-user assumption.

### Frontend data layer

- `lib/react-query.ts`: `staleTime` 5 min, `gcTime` 10 min, no persistence, `mutations.retry: 0`.
- `use-shopping-list.ts` is already close to an outbox in spirit:
  - One shared mutation `scope` (`shopping-list-writes`) serialises writes in tap order.
  - Optimistic updates go through `list-cache.ts` (`applyItemPatch`, `revertItemPatch`).
  - `onError` reverts and toasts, and `onSettled` invalidates.
- `use-pantry.ts`:
  - `usePantryPatch` uses an optimistic patch plus rollback.
  - `useDeferredRemove` uses a 5 s undo window and then calls delete directly, outside React Query.
  - The list is fetched with **no `limit`**, so the server default of 50 applies (`pantry.service.ts` `limit = 50`, validator max 100). Filtering by category and search happens **server-side** in `usePantryList`.
- `use-debounced-quantity.ts` debounces 400 ms and commits the **absolute** value.
- `scan/resolve-barcode.ts` looks in the user's own pantry first (an API call with `barcode=`), then Open Food Facts (OFF) via `/food/barcode/:code`. OFF is cached **server-side** only (`AiCache`).
- `client.ts`:
  - The token is in `localStorage['auth-token']`.
  - Any 401 on a non-auth endpoint calls `clearUserSessionState` and hard-redirects to `/login`.
  - That wipes the query cache and storage. **Offline, this is harmless. Online with an expired token and a non-empty outbox, it destroys unsynced work.**
- Auth is a 7-day JWT with no refresh token (`auth.service.ts` `expiresIn: '7d'`).
- No service worker is present. `app/manifest.ts` exists.
- The project's own decision log defers the Serwist offline SW (OFF-01..04) and lists native Expo/RN as out of scope (`.planning/PROJECT.md`).
- The app has no dynamic routes and no server actions, cookies, or middleware, so `output: 'export'` is feasible.

### Date and clock hazards found

- `shopping.validation.ts:143` rejects `receiptDate` unless it is within +/-1 day of UTC today (`withinOneDayOfUtcToday`). A finish queued offline and replayed 2 or more days later is **rejected**.
- `cookedAt = new Date()` is stamped server-side at apply time. A queued cook would get the sync time, not the cook time.

## 2. Options evaluated

| Option | Fit for Kitcha | Verdict |
|---|---|---|
| **A. RQ persistQueryClient + paused mutations** | Cheap and uses the existing hooks. Problems are listed below. | Use RQ persistence for **reads only**. |
| **B. Custom outbox + persisted RQ cache (recommended)** | About 400-600 LOC. You control the retry, dead-letter and idempotency semantics. | **Choose** |
| **C. PowerSync** | Best-in-class if you need a real sync engine. Heavy for one user and about 500 rows. | Escape hatch |
| D. ElectricSQL | Read-path sync only. Writes are DIY. | No |
| E. Replicache / Zero | Replicache is in maintenance mode. Zero needs its own cache server and has an offline-write gap. | No |
| F. WatermelonDB / RxDB / TinyBase | Needs the delta endpoints anyway, plus an RN or storage-layer rewrite. | No |
| G. Dexie Cloud | Brings its own auth and backend. | No |
| H. Custom delta-sync endpoints | Only buys cheaper refetch at this data size. | Defer (phase 7) |

### A. React Query persistence and paused mutations [H/M]

Sources:
- https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- https://tanstack.com/query/latest/docs/react/guides/mutations

What the docs say:
- Only mutation **state** is persisted, because functions cannot be serialised.
- A default `mutationFn` must be registered with `setMutationDefaults` so paused mutations can resume after a reload (otherwise "No mutationFn found").
- `resumePausedMutations()` is called after restore.
- `maxAge` defaults to 24 h, and `gcTime` must be at least `maxAge`.
- `createAsyncStoragePersister` throttles saves to about once per second.

Why it is not enough here:
1. **Paused means offline per `navigator.onLine`.** In a grocery aisle with poor signal the device is "online" but requests hang for 30 s and then fail. The current `onError` handler then rolls back the optimistic UI and toasts "Couldn't save". That is the exact scenario the owner described. A fix needs `networkMode: 'always'` plus your own retry and backoff logic, and at that point you have written an outbox.
2. **Restart loses optimistic context.** The `onMutate` context (`previousItem`, `removed`) lives in memory and is not rehydrated after an app kill. The UI would not re-apply pending patches. The outbox design re-applies pending ops over the server snapshot on every render.
3. **Crash-safety.** Mutation state shares one throttled blob with the whole cache, so a kill within about 1 s of a tap can lose the write.
4. **No visibility or dead-letter.** There is no "3 changes waiting" badge, no per-op error state, and no way to skip a poisoned op.
5. `useDeferredRemove` bypasses React Query entirely, so it needs rework anyway.

### B. Custom outbox (recommended)

- Table `outbox(seq INTEGER PK AUTOINCREMENT, op_id TEXT UNIQUE, kind TEXT, entity TEXT, entity_id TEXT, payload JSON, created_at, attempts, last_error, state)`.
- Writes are atomic SQLite inserts, so the queue is crash-safe.
- UI state is derived as `serverSnapshot (RQ cache)` plus `pendingOps` folded over it. Optimistic UI is therefore stateless and survives restarts.
- The same `list-cache.ts` pure functions (`applyItemPatch`, `upsertItem`, `removeItem`) can be reused as the fold reducers. The existing tests become reducer tests.
- Sync loop:
  - Run strictly in `seq` order. This preserves create then patch then delete.
  - Per-op timeout of 8-10 s instead of 30 s.
  - Exponential backoff on network errors and 5xx.
  - 401: pause the queue and show a re-login sheet.
  - 4xx validation or 404: move the op to dead-letter and continue (see the conflict table).
- Triggers:
  - App foreground (Capacitor `App.addListener('appStateChange')`).
  - Network change (`@capacitor/network`).
  - After each enqueue.
  - A `GET /health` reachability probe before draining (the endpoint exists and is DB-free; see `app.ts:51`).
- Reusing `scope`-style serialisation is no longer needed once the outbox is the single writer.

### C. PowerSync (sync engine) [M]

Sources:
- https://docs.powersync.com/client-sdks/reference/capacitor
- https://powersync.com/pricing

Facts:
- The Capacitor SDK is **beta**.
- It requires **Capacitor 8+** and iOS 15+. It wraps `@capacitor-community/sqlite` on native.
- Writes go through **your** `uploadData` connector into **your REST API**. So cook, finish and merge would stay REST calls regardless.
- Pricing: Free cloud tier is 2 GB synced per month, 500 MB hosted, and projects are deactivated after 1 week of inactivity. Pro is from $49/month. A self-hosted Open Edition exists under the Functional Source License (an extra Railway service).
- The Postgres source needs logical replication and a publication.

Cost for Kitcha:
- A second always-on service on a Hobby plan with a spend cap.
- Sync rules plus a rewrite of every `useQuery` hook to SQL.
- A pantry with fewer than 1,000 rows gains nothing a persisted JSON cache does not give.
- Reconsider if household sharing (HH-01 in the roadmap) ships and multi-writer conflicts become real.

### D. ElectricSQL [H]

Source: https://electric-sql.com/docs/guides/writes (also served at https://electric.ax/docs/sync/guides/writes).

The docs state it does not offer write-path sync. You would build the outbox yourself, so it is plan B plus a replication service.

### E. Replicache and Zero [M]

Sources:
- https://replicache.dev/
- https://infoq.com/news/2026/06/zero-version-1
- https://zero.rocicorp.dev/docs/connection

Facts:
- Replicache is in maintenance mode.
- Zero reached 1.0 in June 2026, but its docs say offline writes can be lost on an app restart with a new Zero or schema version. The Replicache "mutation recovery" feature is not yet ported.
- Zero needs its own `zero-cache` server.
- Poor fit for a Capacitor WKWebView app deployed by a solo dev.

### F. WatermelonDB, RxDB, TinyBase [L/M]

- WatermelonDB is RN-oriented. Its sync protocol requires you to implement pull and push endpoints with `updatedAt` cursors and tombstones, which is option H with extra weight. Its 2026 maintenance status is unconfirmed (docs site still shows 0.27.1; last dated changelog entry October 2023; https://watermelondb.dev/docs/CHANGELOG).
- RxDB SQLite storage is a premium plugin [L, from memory].
- TinyBase has persisters but no Postgres sync.

### G. Dexie Cloud [M]

Source: https://dexie.org/pricing.

- It is IndexedDB-based and ships its own user and auth backend. It conflicts with Express/Prisma/JWT.
- IndexedDB is the storage layer with the eviction risk (section 3).

### H. Custom delta endpoints (`updatedAt` cursor + tombstones)

- Works without any client engine. Costs: an `(user_id, updated_at)` index per table, tombstones for shopping items, and cursor-gap handling for long-running transactions (use an overlap window of cursor minus 60 s).
- Only valuable once payloads are large. At 200-500 pantry rows (about 100-250 KB JSON) a full refetch on resume is cheaper than building and testing this.
- Defer to phase 7.

## 3. Capacitor vs React Native, and storage durability

### Capacitor 8 (recommended) [H/M]

- Reuses about 90% of the UI (Next, Tailwind, Radix, recharts).
- Capacitor 8 (announced 2025-12-08) makes Swift Package Manager the default for new iOS projects. CocoaPods keeps working. https://ionic.io/blog/announcing-capacitor-8
- Next.js:
  - Set `output: 'export'`.
  - Set `images: { unoptimized: true }`.
  - Set `trailingSlash: true`.
  - Set the Capacitor `webDir` to `out`.
  - Guides found target Next 15 + Capacitor 8; verify on Next 16.4 [M]. https://capgo.app/blog/how-to-use-capacitor-with-nextjs
  - Ship one flag-gated config (e.g. `NEXT_PUBLIC_NATIVE=1`) so the web deploy is unaffected. Check that `app/manifest.ts` still builds under export (it needs `export const dynamic = 'force-static'`) [L].
- Because the bundle is local, the app shell works offline with **no service worker**. That removes the pending Serwist/Turbopack spike (OFF-01..04) from the critical path for the iPhone app. Keep it for the web PWA only if wanted.
- Backend CORS must allow the Capacitor origin. iOS defaults to `capacitor://localhost` [L; verify against `server.iosScheme`]. The repo has `config/cors.config.ts` with an origin guard (`app.ts:10`), so this is a required change.
- Barcode scanning:
  - The current `getUserMedia` + `barcode-detector` (ZXing WASM) path should work in WKWebView (iOS 14.3+) [M].
  - For a native feel and the App Store "4.2" argument, consider `@capacitor-mlkit/barcode-scanning` (on-device ML Kit) [L: not verified in this research].
- Local notifications for expiry reminders (`@capacitor/local-notifications`) can be scheduled from the cached pantry and work with zero connectivity. They also count as real native functionality for App Review.

### React Native / Expo (not recommended now)

- Needs a rewrite of every screen (Radix, Tailwind v4, framer-motion, recharts have no RN equivalents) while reusing hooks and API clients.
- PowerSync's RN SDK (op-sqlite adapter) is more mature than the Capacitor one [M]: https://docs.powersync.com/client-sdks/reference/react-native-and-expo.md
- `expo-sqlite` is actively maintained (docs touched Sep 2026) [M]: https://docs.expo.dev/versions/latest/sdk/sqlite.md
- RN would be the right call only if the Capacitor camera or scroll feel is rejected on a real iPhone, or if background work becomes critical.
- It contradicts the milestone constraint "no rewrite" in CLAUDE.md.

### Apple App Review guideline 4.2 risk [M]

Sources: https://developer.apple.com/forums/thread/812889, https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper

- Thin wrappers are rejected under 4.2 (Minimum Functionality). Reviewers have said push, location and share alone were not enough.
- Native offline storage, local notifications, an on-device scanner and Keychain auth help.
- For a personal app, **TestFlight** avoids the question while you iterate. A paid Developer Program membership is needed [M, general knowledge].

### Storage durability on iOS [H/M]

| Storage | Behaviour | Source |
|---|---|---|
| Safari tab IndexedDB/localStorage | Script-writable storage is deleted after 7 days of Safari use with no user interaction on the site. | https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ |
| Home Screen web app | Exempt from the 7-day counter (own usage counter). WebKit treats deletion of first-party data there as a serious bug. | same |
| Quota (Safari 17+) | Browser and Home Screen apps: up to 60% of disk per origin. "Other apps" (likely WKWebView in a native app): up to **15%** of disk per origin, 20% overall. Eviction occurs under storage pressure or via ITP, LRU per origin. `StorageManager.persist()` is granted heuristically. | https://webkit.org/blog/14403/updates-to-storage-policy/ |
| Capacitor WKWebView IndexedDB/localStorage | WebKit documents no explicit 7-day rule for app WebViews. Ionic claims no counter applies. Developers still report unexplained loss on Apple Developer Forums (localStorage cleared on iOS 17.4 navigation). Treat as non-durable. | https://ionic.io/blog/is-apple-trying-to-kill-pwas, https://developer.apple.com/forums/thread/751820, https://developer.apple.com/forums/thread/750682 |
| `@capacitor/preferences` | UserDefaults on iOS, not encrypted, and not meant for big blobs. | https://capacitorjs.com/docs/apis/preferences |
| `@capacitor-community/sqlite` native | SQLite file in app storage (set `iosDatabaseLocation: 'Library/CapacitorDatabase'`). Optional SQLCipher encryption (US export self-classification note in README). v8.0.0 dated 2026-01-20 per the changelog anchor; a third-party post says 8.1.1 shipped Aug 2026 [M]. | https://github.com/capacitor-community/sqlite |
| Tokens | Use a Keychain-backed plugin such as `@aparajita/capacitor-secure-storage` v8 (Capacitor 8 line). Keychain items can survive uninstall. | https://unpkg.com/@aparajita/capacitor-secure-storage@8.0.0/README.md |

**Decision:** in the native build put the outbox and the persisted query cache in native SQLite. Unsynced writes are the one thing that must not be evicted. In the web build use IndexedDB and call `navigator.storage.persist()`. A Home Screen PWA is covered by the 7-day exemption; the web build has no outbox durability guarantee beyond that.

## 4. Per-feature decisions

| Feature | Offline? | Mechanism | Notes |
|---|---|---|---|
| View pantry, shopping list, recipes, meal plans, notifications, budget | Read from cache | Persisted RQ cache with `gcTime: Infinity`, `maxAge` 30 d, `buster` = schema version | Bootstrap must fetch **all** pantry pages (the current call gets only 50). Move category and search filtering **client-side** when offline. Recipe images stay remote; show a placeholder offline. |
| Check or uncheck shopping items, edit `actualCostCents` | Yes | Outbox `shopping.item.update` | Field-level LWW. The highest-value feature for the aisle. |
| Add shopping item | Yes | Outbox `shopping.item.create` with client UUID | Needs backend change B2. `MAX_ITEMS_PER_LIST` still enforced; the item may land in dead-letter. |
| Delete shopping item | Yes | Outbox delete | 404 on replay is treated as success. |
| Pantry quantity +/- | Yes | Outbox `pantry.adjust {delta}` | Delta, not absolute (B3). |
| Pantry set exact quantity, expiry edit, notes | Yes | Outbox `pantry.update` (absolute, LWW) | Last write by arrival wins. |
| Pantry delete | Yes | Outbox delete | Replace the 5 s deferred timer with: hide in UI immediately, queue the op after the undo window. |
| Pantry add (manual or scan) | Yes | Outbox `pantry.create` with client UUID | |
| Scan barcode offline | Partly | Local barcode cache lookup, else queue (section 6) | |
| Recipes create/edit | No (v1) | Online only | JSON ingredients, rare in the aisle. Disable with "Needs connection". |
| Meal plan create/edit | No (v1) | Online only | Server rebuilds items; `cookedAt` carry-over logic. |
| Cook it (preview and apply) | No (v1) | Online only | See below. |
| Finish trip | Phase 6 (optional) | Queued op with idempotency key | See below. |
| Generate list from plan | No | Online only | Server-side unit merge. |
| AI features | No | Online only | Quota-limited by design. |
| Expiry reminders | Yes | Local notifications from cache | Native feature; no server round-trip. |
| Notification mark-read | Phase 6 | Outbox, trivial LWW | |

### Cook apply: why it stays online-only in v1

- The deduction plan depends on live lot state, FIFO expiry ordering, and the pantry lock. A client plan built from a stale cache can deduct the wrong lots.
- The once-only `cookedAt` marker already makes replay safe (409), so queuing is possible later.
- Safe offline variant (phase 6): queue an *intent* `{mealPlanItemId|recipeId, servings, occurredAt}`, and let the **server recompute** the plan at sync time (call `computeCookPlan` with no client deductions, applying the default plan). Never replay client-computed deductions.
- Ambiguity to resolve first: preview currently lets the user adjust per-ingredient `use`. A queued intent would only support "accept default". That is acceptable as "Mark cooked, deduct when online".

### Finish trip

- The user is most likely to tap Finish at checkout, with poor signal. It is the one non-trivial write worth queuing.
- Today it is unsafe to retry: a lost response followed by a retry returns 400 `SHOPPING_LIST_EMPTY`, because the list is already completed and the new one is empty.
- With `Idempotency-Key` the server returns the stored first response.
- The pantry merge runs in a second transaction after the finish commits. To make the key meaningful, either (a) move the merge into the same transaction, or (b) store `merge_pending` in the idempotency record and re-run the merge idempotently. Option (a) is preferred and the pantry lock is already shared via `lockUserPantry`.
- The `receiptDate` window must widen (B6).
- UI while pending: lock the list ("Trip finishing when online") and show the queued state.

## 5. Conflict policy

| Data | Policy | Rationale |
|---|---|---|
| Shopping `isChecked`, notes, cost | Field-level **LWW by server arrival order** | Single user. Outbox replays in tap order. |
| Shopping quantity edit | LWW (absolute) | Rare. |
| Shopping delete vs concurrent edit | **Delete wins.** A 404 on a queued PATCH is dropped and logged to a "sync issues" list. | Avoids resurrecting rows (no tombstones for items). |
| Pantry `+/-` quantity | **Merge as delta**, server computes `GREATEST(quantity + delta, 0)` under `lockUserPantry`. Response flags `clamped: true` if it hit 0. | Intent is relative ("I used 1"). Absolute sets would overwrite a cook or merge. |
| Pantry absolute set (edit form) | LWW. Optional `baseUpdatedAt`; on mismatch return 409 with the current row and let the user choose. | Defer 409 UI to phase 6. |
| Pantry delete vs edit | Delete wins (soft delete exists). | |
| Cook apply, finish, generate | Server-authoritative. No client merge. | |
| Two devices | The same rules apply. If household sharing (HH-01) ships, add `baseUpdatedAt` guards on every absolute write and re-evaluate PowerSync. | |

Dead-letter rules:
- Validation 4xx (400/422) goes to a "Needs attention" list with the op payload, and **does not block** later ops, except ops on the same entity id.
- 5xx and network errors retry with backoff, without limit but with visible age.
- 401 pauses the whole queue (see Auth).

Decimal handling:
- Quantities are `Decimal(10,2)` and arrive as strings. Send deltas as integer hundredths (`deltaCents`) or as strings to avoid float drift. Round at 2 dp the same way as `toQuantity` in `shopping.service.ts`.

## 6. Idempotency, clocks, auth, barcode cache

### Idempotency keys

- Client: generate `opId = crypto.randomUUID()` at enqueue time and persist it. Send as `Idempotency-Key`. Reuse the same key for every retry of that op.
- Server table `idempotency_keys(user_id, key, method, route, request_hash, status, response jsonb, created_at)` with `PRIMARY KEY (user_id, key)`.
- Protocol (Stripe-style):
  - The same key with the same hash replays the stored response.
  - The same key with a different hash returns 422.
  - A concurrent in-flight key returns 409 with `Retry-After`.
- For `adjust`, `finish` and `cook/apply`, write the key row **inside the business transaction** so there is no crash window between commit and key save. For naturally idempotent ops (set `isChecked`, create with client id, delete) the key is optional but cheap.
- TTL: 14 days, pruned by a daily job (the repo already has a scheduler for Zapier jobs).
- Client IDs for creates:
  - Accept an optional `id` (UUID v4) in the request body.
  - `INSERT ... ON CONFLICT (id) DO NOTHING`, then read back.
  - If the row exists but belongs to another user, return 404 and not the row.

### Clock and timezone

- Never order by device time. Ordering is the outbox `seq`, and the server stamps arrival time.
- Send `occurredAt` (ISO instant) only for *labels*: `cookedAt`, `completedAt`. The server clamps it to `[now - 14 d, now]`.
- Calendar fields (`expiryDate`, `purchaseDate`, `receiptDate`) stay `YYYY-MM-DD` strings in the user's local calendar, as `localIsoDate` already does.
- Replace `withinOneDayOfUtcToday` with a 14-day past window and a +1 day future bound.
- "Expiring in N days" shown offline must use the device's local date. The server's expiring-soon query uses UTC midnight (`pantry.service.ts`), so cache the raw items and compute the badge client-side to avoid an off-by-one at day boundaries.
- Detect large device clock skew only for *display* of "last synced"; never gate writes on it.

### Auth while offline

- Today: 7-day JWT, no refresh, `localStorage`, and a 401 handler that wipes everything.
- Target:
  - Short access token (1 day) plus a rotating opaque refresh token (90 d, hashed in DB, reuse detection by family).
  - Both tokens in the Keychain (`@aparajita/capacitor-secure-storage`).
  - The app **never validates expiry locally to gate the UI**. Cached data stays readable for as long as the install holds a user record.
  - When the outbox sync gets a 401: try refresh once; if refresh fails, pause the queue, show "Sign in to sync N changes", and keep all state. After login as the **same user id**, resume. If a different user logs in, ask before discarding the outbox.
  - `clearUserSessionState` must skip the outbox and keep the cache scoped by `userId`.
- Logout with a non-empty outbox: warn "N changes haven't synced" and offer to sync first.

### Offline barcode cache for Open Food Facts

- Facts from CLAUDE.md research: OFF has a 15 req/min per IP product-read limit, requires a User-Agent, and is ODbL with CC BY-SA images. The server already caches lookups in `AiCache`.
- Client cache `barcode_cache(barcode PK, product JSON, fetched_at, source)` in SQLite:
  - Write on every successful `/food/barcode` result (the server response includes `attribution`; store it).
  - Seed from the user's own pantry rows that carry a `barcode` (name, category, unit), so repeat-scan prefill works with no network.
  - LRU cap of about 500 entries; TTL 30 days for hits.
  - Keep negative results ("unknown") for 24 hours so the offline UI does not retry endlessly.
- Resolution order offline: own pantry (local filter on cached items; replace the API call in `findOwn`), then barcode cache, then **queue**.
- "Scan and queue": when the barcode is unknown offline, create a local `pending_scan` and an optimistic pantry row "Scanned item ...1234" flagged `needsReview`. On reconnect, resolve it against `/food/barcode`; if found, auto-fill the name, category and unit via a `pantry.update` op; otherwise surface it in the review tray. `needsReview` can be client-only (no schema change) in v1.
- Do **not** try to bulk-download OFF. The full dump is far too large for the use case.

### Poor-signal behaviour ("lie-fi")

- Use `@capacitor/network` only as a hint. Decide "reachable" by `GET /health` with a 3 s timeout.
- Set op timeout to 8-10 s. A timeout is ambiguous, so retry with the same key.
- Show a persistent badge "N waiting to sync" and "Last synced 3 min ago".

### Background sync

- iOS gives no reliable background execution to a Capacitor WebView. Do not promise background sync. Drain on foreground, on network change, and after every enqueue. Add a visible unsynced count so users keep the app open at checkout.

## 7. Required backend changes (small, additive, ordered)

| # | Change | Migration? | Size |
|---|---|---|---|
| B1 | CORS: allow the Capacitor iOS origin(s) in `cors.config.ts` / `CORS_ORIGIN`; keep it off `*`. | no | 0.25 d |
| B2 | Accept optional client `id` (UUID) on `POST /pantry` and `POST /shopping/items`; idempotent insert; cross-user collision returns 404. | no | 1 d |
| B3 | `POST /pantry/:id/adjust {deltaCents}`: lock, `GREATEST(quantity + delta, 0)`, return the row and `clamped`. | no | 1 d |
| B4 | `idempotency_keys` table and a `withIdempotency(tx, userId, key, fn)` helper. Wire into adjust, finish, cook/apply, generate. 14-day prune job. | yes | 2 d |
| B5 | Merge the bought-it pantry merge into the finish transaction (or store `merge_pending` in the key record), so a replay returns the first result and the merge cannot be skipped. | no | 1.5 d |
| B6 | Widen `receiptDate` window to 14 days past; accept `occurredAt` (clamped) for `cookedAt` and `completedAt`. | no | 0.5 d |
| B7 | Refresh tokens: `refresh_tokens(id, user_id, token_hash, family_id, expires_at, revoked_at, created_at)`; `POST /auth/refresh`; logout revokes the family; shorten access TTL. | yes | 2 d |
| B8 | `GET /api/v1/sync/bootstrap`: one response with all pantry rows (no 50-row page), active shopping list, recipes, current and next meal plans, preferences, unread notifications. Optional `ETag`. | no | 1 d |
| B9 *(optional, phase 7)* | `updated_at` composite indexes and `GET /sync/pull?since=` per resource, with an overlap window. | yes | 3-4 d |

Notes:
- Migrations follow the existing hand-written SQL style (see `20261011000000_shopping_active_list_unique`).
- Prisma stays on 5.22.x per CLAUDE.md.
- `validateGetItems` caps `limit` at 100; B8 sidesteps pagination for the bootstrap.
- The Railway `railway.json` deprecation note in CLAUDE.md means nothing here changes in deployment; keep migrations in `entrypoint.sh`.

## 8. Phased plan and effort (solo dev, focused days)

| Phase | Scope | Exit criteria | Days |
|---|---|---|---|
| **1. Native shell** | Capacitor 8 project; flag-gated `output: 'export'`; B1; run on a real iPhone via Xcode; safe areas; camera permission and scanner check; icons and splash. | Login, view lists, and scan work on device against Railway. | 3-4 |
| **2. Read cache** | B8 bootstrap; SQLite KV persister for RQ (native) and IDB (web); `gcTime: Infinity`; `maxAge` 30 d; `buster`; client-side pantry filtering; hydration gate (`useIsRestoring`); offline and unsynced banner. | Airplane-mode cold start shows pantry, list, recipes, plan. | 4-5 |
| **3. Outbox core** | SQLite `outbox`; enqueue API; fold reducers reusing `list-cache.ts`; sync loop, backoff, dead-letter UI; B2, B3, B4; migrate shopping check/edit/add/delete and pantry adjust/update/create/delete; replace `useDeferredRemove`; tests (target 80%+ on reducers and loop). | Toggle 20 items offline, kill app, relaunch, reconnect: all land once. | 8-10 |
| **4. Auth** | B7; Keychain token store; 401 and refresh flow that preserves the outbox; logout warning; user-scoped storage. | A 10-day-old install syncs after one re-login without losing queued ops. | 3-4 |
| **5. Offline scan** | Local barcode cache and pantry-seeded lookup; `pending_scan` flow with `needsReview`; native scanner plugin evaluation. | Scan known and unknown items on a plane. | 3 |
| **6. Optional** | Queued Finish (B5, B6 plus UI lock); queued "mark cooked" intent; 409 compare UI; notification mark-read; local expiry notifications. | Finish at checkout with no signal. | 6-8 |
| **7. Optional** | B9 delta pull if refetch size or time becomes a problem; or evaluate PowerSync if household sharing ships. | | 4-6 |

**Core total (phases 1-5): about 21-26 days (4.5-5.5 weeks).** Add 8-10 days for phases 6-7. The estimates assume the existing 80%-coverage TDD rules and real-device testing.

Sequence rationale: phase 2 delivers visible value (read offline) before the risky write path, and phase 3 is the only one touching production writes, so it ships behind a feature flag.

## 9. Risks and open questions

| Risk | Mitigation |
|---|---|
| Next 16.4 `output: 'export'` incompatibilities (manifest route, images, `use client` boundaries) | 0.5-day spike at the start of phase 1 [M]. |
| `@capacitor-community/sqlite` maintenance (single maintainer, 33 open issues on the repo page) | Hide behind a `KeyValueStore`/`OutboxStore` interface. The Capawesome alternative exists [M]: https://capawesome.io/docs/blog/alternative-to-capacitor-community-sqlite-plugin/ |
| WKWebView storage eviction is under-documented | Keep unsynced data only in native SQLite; show the unsynced count; offer "export pending ops" in debug. |
| App Review 4.2 | Use TestFlight first; ship native-only features (local notifications, native scanner, offline). |
| Prisma `@updatedAt` is client-side, and raw SQL updates use `now()` | Only matters for phase 7 cursors; use DB-side timestamps for the cursor column. |
| Clock skew in outbox timestamps | Not used for ordering. `occurredAt` clamped by the server. |
| Idempotency table growth | 14-day TTL prune. |
| Two-transaction finish | B5 fixes. Until then, do not queue finish. |

Open questions for the owner:
1. Is this personal use only (TestFlight) or will it go to the public App Store? That decides how much native surface is needed.
2. Is household sharing (HH-01) coming? If yes within 6 months, plan the `baseUpdatedAt` guards early and re-check PowerSync.
3. Do cooked-meal deductions need to work with no signal, or is "Mark cooked, deduct when online" enough?
4. Should the web PWA keep a service worker (Serwist), or is the web build online-only once the iPhone app exists?

## 10. Source list

- TanStack Query persistence: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- TanStack Query mutations: https://tanstack.com/query/latest/docs/react/guides/mutations
- PowerSync Capacitor SDK: https://docs.powersync.com/client-sdks/reference/capacitor
- PowerSync pricing: https://powersync.com/pricing
- PowerSync React Native/Expo: https://docs.powersync.com/client-sdks/reference/react-native-and-expo.md
- ElectricSQL writes: https://electric-sql.com/docs/guides/writes
- Replicache: https://replicache.dev/
- Zero 1.0: https://infoq.com/news/2026/06/zero-version-1
- Zero connection docs: https://zero.rocicorp.dev/docs/connection
- Dexie pricing: https://dexie.org/pricing
- WatermelonDB changelog: https://watermelondb.dev/docs/CHANGELOG
- WebKit storage policy: https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit ITP 7-day cap: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Ionic on PWA storage: https://ionic.io/blog/is-apple-trying-to-kill-pwas
- Apple forums (WKWebView storage): https://developer.apple.com/forums/thread/750682 and https://developer.apple.com/forums/thread/751820
- Capacitor 8 announcement: https://ionic.io/blog/announcing-capacitor-8
- capacitor-community/sqlite: https://github.com/capacitor-community/sqlite
- Capacitor Preferences: https://capacitorjs.com/docs/apis/preferences
- Secure storage plugin: https://unpkg.com/@aparajita/capacitor-secure-storage@8.0.0/README.md
- Next.js + Capacitor guide: https://capgo.app/blog/how-to-use-capacitor-with-nextjs
- App Store 4.2 discussion: https://developer.apple.com/forums/thread/812889 and https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite.md
