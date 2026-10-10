# Phase 8: Offline Sync Backend - Research

**Researched:** 2026-10-10
**Domain:** Express 4 + Prisma 5.22 + Postgres API hardening for flaky-network (offline outbox) clients: idempotency, delta ops, client ids, refresh tokens, atomic finish, bootstrap paging, safe 401 handling
**Confidence:** HIGH on codebase facts (all read in this session), MEDIUM on the refresh-rotation grace-window design (a design recommendation, not a documented standard)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Idempotency (SYNC-01):** `Idempotency-Key` header on mutating routes (pantry, shopping, mealplan, cook, finish). New `idempotency_keys` table (userId, key, route, requestHash, status, responseStatus, responseBody, createdAt, expiresAt ~24-48h). Replay returns the stored response; same key + different body returns 422; in-flight duplicate handled safely. Implemented as middleware, not per-route copy-paste. Cleanup of expired keys.
- **Pantry adjust (SYNC-02):** `POST /pantry/:id/adjust` with `{delta, unit?}`; Decimal math, clamp at 0, uses existing pantry lock; combined with idempotency.
- **Client ids (SYNC-03):** pantry and shopping item create accept optional client-generated UUID `id` (validated, conflict -> idempotent return of existing for same user).
- **CORS + refresh tokens (SYNC-04):** allow origins `capacitor://localhost` and `ionic://localhost` (confirm exact set in research) in addition to current; refresh token flow (rotating, hashed at rest, revocable, long-lived) with short-lived access token; logout and account delete revoke. Keep web app working unchanged (backwards compatible login response additive).
- **Finish trip (SYNC-05):** accept `occurredAt`; widen receipt-date window (offline trips may be days old); move pantry merge into the SAME transaction as finish; a retried finish must be idempotent (no `SHOPPING_LIST_EMPTY` surprise).
- **Bootstrap (SYNC-06):** `GET /sync/bootstrap` paged/cursored returning pantry, shopping list, recipes, meal plans (+ server time); fix the pantry list fetch cap of 50 rows on the web client so all rows load (paging).
- **401 handling (SYNC-07):** frontend 401 no longer wipes unsynced local state; try refresh first; only clear on definitive refresh failure.

### Claude's Discretion
Names, file layout, exact limits/TTLs - follow existing module patterns, zod at boundaries, tests (unit + integration against real DB as in v1.0), smoke checks added to scripts/smoke-prod.sh where cheap.

### Deferred Ideas (OUT OF SCOPE)
- Delta-pull sync endpoints, queued finish on the client (Phase 11).

Additional orchestrator constraints: migrations additive with a timestamp AFTER `20261014070000_store_readiness`; new refresh-token and idempotency tables MUST be covered by account deletion (delete transaction + all-models test); real-DB integration tests; do NOT touch `frontend/lib/rules` or the recipes UI (Phase 9, another agent); no Xcode.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | `Idempotency-Key` replay returns original result, applies once | Section "Idempotency middleware design"; CORS must allow the header; table + cleanup |
| SYNC-02 | `POST /pantry/:id/adjust` delta, clamp at 0 | "Pantry adjust"; existing `lockUserPantry`; Decimal math |
| SYNC-03 | Client-generated ids on pantry/shopping create | "Client ids"; P2002-inside-transaction pitfall; shopping items have no userId column |
| SYNC-04 | Capacitor origin in CORS + refresh tokens | "CORS" (env schema rejects non-http origins, so constant not env) and "Refresh tokens" (rotation + grace window) |
| SYNC-05 | `occurredAt`, wider receipt window, merge in same tx | "Finish trip"; `withinOneDayOfUtcToday` consumers; lock ordering |
| SYNC-06 | Paged bootstrap; pantry no longer capped at 50 | "Bootstrap"; private `formatItem`; frontend pager (do not import `lib/rules`) |
| SYNC-07 | 401 no longer wipes unsynced work | "Frontend 401 handling" single-flight refresh in `client.ts` |
</phase_requirements>

## Summary

The backend is a clean, conventional Express 4 module layout (`routes -> controller -> service`, tests under `backend/tests` using supertest against a real Postgres, jest + ts-jest, `createApp()` imported directly). Everything this phase needs fits without new dependencies: Node `crypto`, existing `zod@^4.6.5`, `express-validator`, `express-rate-limit`, `node-cron`, Prisma 5.22. No new npm packages are recommended, so there is no package legitimacy risk.

Five findings change how the plan must be written. (1) CORS: `allowedHeaders` is `["Content-Type","Authorization"]`, so a browser/WKWebView preflight with `Idempotency-Key` will FAIL until it is added; and `env.schema.ts` rejects any non-`http(s)` origin in `CORS_ORIGIN`, so `capacitor://localhost` cannot be configured through env and must be a code constant in `cors.config.ts`. (2) The global `apiLimiter` is 100 req / 15 min / IP and only shopping and notification stats are exempt, so an outbox draining pantry adjusts, bootstrap paging and `/auth/refresh` will hit 429 unless the skip list and a per-user limiter are extended. (3) Refresh rotation with reuse detection will log users out whenever a refresh response is lost on a bad network, which is the exact scenario this phase targets; a short grace window is required. (4) `ShoppingListItem` has no `userId`, and a Prisma P2002 thrown inside an interactive transaction poisons that transaction, so client-id conflicts must be pre-checked, not caught. (5) Account deletion already cascades via FK, but `tests/account-deletion.test.ts` has a DMMF completeness test that will FAIL until `RefreshToken` and `IdempotencyKey` get a factory and a counter in `tests/helpers/user-owned-fixtures.ts`.

**Primary recommendation:** One additive migration `20261015000000_offline_sync` (two tables, both `ON DELETE CASCADE` to users); a generic `idempotency` middleware mounted once per router after `authenticate`; reuse `lockUserPantry`; make the finish transaction own the pantry merge; add a thin `sync` module for bootstrap; implement refresh rotation with a 60 s reuse-grace window; frontend 401 interceptor does a single-flight refresh and clears only on a definitive 401/403 from the refresh endpoint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Idempotent replay of mutations | API / Backend (middleware + Postgres table) | Client generates the key | Server must be the single arbiter of "already applied"; table in Postgres, no Redis |
| Quantity delta merge | API / Backend (row lock + Decimal) | Database (row locks) | Clamp and sum must be serialised with cook/merge writers |
| Client-generated ids | Client (generates UUID) | API (validates, dedups) | Server enforces ownership and uniqueness |
| Refresh-token issue/rotate/revoke | API / Backend | Database (hashed rows) | Secrets never stored in plaintext; revocation needs server state |
| Refresh-token storage on device | Browser/Client (localStorage on web now; Keychain in Phase 10) | - | Out of scope here except the web client wiring |
| Finish + pantry merge atomicity | API / Backend (one transaction) | Database | Crash between two transactions loses the merge today |
| Bootstrap snapshot | API / Backend (keyset-paged read) | Database | Client persists it; server only pages |
| CORS for Capacitor origin | API / Backend (cors.config) | - | Constant allow-list |
| 401 recovery / unsynced-state preservation | Browser/Client (axios interceptor) | API (`/auth/refresh`) | Client decides whether to clear local state |
| Expired-row cleanup | API (node-cron job) | Database | Existing scheduler pattern |

## Standard Stack

### Core (all already installed; no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.18.2 | HTTP, middleware | Existing. Express 4 does not catch async errors: wrap with `asyncHandler` or `next(err)` [VERIFIED: backend/package.json, errorHandler.ts] |
| @prisma/client / prisma | 5.22.0 (pinned) | ORM, `$transaction`, `$queryRaw` | CLAUDE.md: stay on 5.22.x [VERIFIED: package.json, CLAUDE.md] |
| zod | ^4.6.5 | Boundary validation for new modules (refresh body, bootstrap query, cursor, idempotency header) | Already a backend dep; CONTEXT says zod at boundaries [VERIFIED: package.json] |
| express-validator | ^7.0.1 | Extend existing pantry/shopping validation chains (client `id`, `occurredAt`, adjust body) | The pantry and shopping modules use it; do not mix styles inside one module [VERIFIED: pantry.validation.ts, shopping.validation.ts] |
| jsonwebtoken | ^9.0.2 | Access token (existing `generateToken`) | Existing |
| express-rate-limit | ^8.2.1 | Refresh / sync limiters | Existing pattern `createShoppingLimiter` (per-user key, `ipKeyGenerator` fallback) [VERIFIED: rateLimiter.ts] |
| node-cron | ^4.2.1 | Daily prune of expired keys/tokens | Existing scheduler `initializeScheduler()` in zapier.scheduler.ts, called from index.ts [VERIFIED] |
| Node `crypto` | built-in (Node 24 locally, `node:crypto`) | `randomBytes`, `createHash('sha256')`, `randomUUID` | No dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@prisma/client/runtime/library` `Decimal` | 5.22 | Quantity math | Already imported by pantry.service.ts and shopping.service.ts |
| supertest / jest / ts-jest | ^6.3.3 / ^29.7 / ^29.1 | Real-DB integration tests | Existing harness |
| vitest | 5.0.3 | Frontend unit tests | `npm test` -> `vitest run` in `frontend/` [VERIFIED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres idempotency table | Redis / in-memory Map | Redis is not deployed; in-memory breaks on restart and replica change. Rejected. |
| Opaque refresh token + sha256 hash | Refresh JWT | JWT cannot be revoked without a table anyway; opaque + hash is simpler and matches CONTEXT "hashed at rest" |
| Fast hash (sha256) for refresh tokens | bcrypt | Token is 256 bits of CSPRNG output; slow hashing adds latency per refresh for no gain [ASSUMED: standard practice] |

**Installation:** none. `npm view` / slopcheck not required because no packages are added.

## Package Legitimacy Audit

No external packages are installed by this phase. Everything uses already-present dependencies and Node built-ins.

**Packages removed due to slopcheck [SLOP] verdict:** none (n/a)
**Packages flagged as suspicious [SUS]:** none (n/a)

## Architecture Patterns

### System Architecture Diagram

```
Client (web now / Capacitor later)
  | Authorization: Bearer <access JWT>      Idempotency-Key: <uuid>
  v
Express: trust proxy -> /health -> helmet -> originGuard(+capacitor://localhost) -> cors(+Idempotency-Key header)
  -> apiLimiter (skip list now also: /pantry, /sync with valid bearer) -> json parser -> routes
  |
  +-- POST /auth/refresh  (refreshLimiter) --> rotate row in refresh_tokens (grace window) --> {token, refreshToken}
  +-- POST /auth/logout   (no auth needed)  --> revoke family
  |
  +-- /pantry|/shopping|/mealplans|/cook routers:  authenticate -> idempotency middleware -> validators -> handler
  |        idempotency: no header? next()
  |                     INSERT idempotency_keys (user,key) ON CONFLICT DO NOTHING
  |                       inserted  -> run handler; wrap res.json: persist {status,body} (2xx only) BEFORE sending; non-2xx -> delete row
  |                       conflict  -> hash differs: 422 | in_progress: 409 + Retry-After | completed: replay stored response
  |        handler tx:  [shopping list lock] -> lockUserPantry -> writes   (finish: history + carry-over + pantry merge in ONE tx)
  |
  +-- GET /sync/bootstrap?cursor=  --> keyset page over pantry -> recipes -> mealPlans; first page also shoppingList + serverTime
  |
  v
Postgres (users, pantry_items, shopping_*, refresh_tokens, idempotency_keys)   <-- daily cron prunes expired rows
```

### Recommended Project Structure
```
backend/src/
├── middleware/idempotency.middleware.ts       # generic middleware (<200 lines)
├── modules/idempotency/                       # hash.ts (canonical body hash), store.ts (reserve/complete/release), idempotency.constants.ts, idempotency.cleanup.ts
├── modules/auth/refresh-token.service.ts      # issue/rotate/revoke/prune, family + grace logic
├── modules/auth/refresh-token.validation.ts   # zod bodies
├── modules/pantry/pantry.adjust.ts            # adjust service fn (keeps pantry.service.ts <800 lines; it is 433 now)
├── modules/pantry/pantry.format.ts            # extract formatItem (currently private) so sync can reuse it
├── modules/shopping/shopping-finish.service.ts  # now takes addToPantry + occurredAt, merge inside tx
├── modules/shopping/shopping-pantry.service.ts  # split: applyPantryMergeInTx(tx, ...) + thin wrapper
├── modules/sync/{sync.routes,sync.controller,sync.service,sync.cursor,sync.validation}.ts
└── config/cors.config.ts                      # NATIVE_APP_ORIGINS constant
backend/prisma/migrations/20261015000000_offline_sync/migration.sql
backend/tests/helpers/user-owned-fixtures.ts   # + RefreshToken, IdempotencyKey factories/counters
frontend/lib/api/client.ts, frontend/lib/auth/*  # SYNC-07 and pantry paging only
```

### Pattern 1: Idempotency middleware (generic, mounted once per router)
**What:** `router.use(authenticate); router.use(idempotency);` in pantry, shopping, mealplan, cook routers. The middleware is a no-op for `GET/HEAD/OPTIONS` or when the header is absent (web client keeps working unchanged).
**Protocol:**
1. Validate the key with zod: string, 8-255 chars, `[A-Za-z0-9._:-]+`. Malformed -> 400 `IDEMPOTENCY_KEY_INVALID`.
2. `requestHash = sha256(method + " " + baseUrl + path + " " + canonicalJson(body))`. Canonical JSON = recursively key-sorted. Compute it BEFORE validators run (express-validator sanitizers like `toFloat`/`trim` mutate `req.body`, which would make the hash differ from the client's retry only if sanitizers were non-deterministic, but hashing the raw body is still the safest). The route+method are inside the hash so the same key on another route also yields 422.
3. Reserve: `INSERT INTO idempotency_keys (...) VALUES (...) ON CONFLICT (user_id, key) DO NOTHING RETURNING id` via `$queryRaw` tagged template (project rule: never the `*Unsafe` variants). A returned row means "we own it".
4. If not owned, `SELECT` the existing row, then in this order: (a) `expires_at` passed -> treat as absent (delete and re-reserve); (b) `request_hash` differs -> **422** `IDEMPOTENCY_KEY_REUSED`; (c) `status='in_progress'` -> **409** `IDEMPOTENCY_IN_FLIGHT` with `Retry-After: 1`; (d) `completed` -> send stored `response_status` + `response_body` with header `Idempotency-Replayed: true`.
5. Owned: wrap `res.json`. On the first call, if `res.statusCode` is 2xx persist `{status:'completed', response_status, response_body}` **before** delegating to the original `res.json` (so any response a client ever sees is already recorded). If non-2xx (including errors rendered by `errorHandler`, which also calls `res.status().json()`), `DELETE` the reservation so the client may retry the same key (a 400/500 must not be cached; a failed first attempt followed by a corrected retry with the same key would otherwise 422).
6. `res.on('close')` safety net: if the response never reached `json` (client aborted, handler used `send/end`), release the reservation unless it was completed.
7. A stale `in_progress` row older than a bound (suggest 120 s, larger than any request timeout) is treated as crashed: replace it. Document the residual window honestly: a process kill between the business commit and the completion write can double-apply on retry. Railway runs one replica and the window is a single UPDATE; the planner may optionally harden adjust and finish by passing the key row into the business transaction, but this is not required for the success criteria. [ASSUMED: acceptable risk given single replica and low traffic]
8. FK failure on reservation (user deleted concurrently, Prisma `P2003`) -> map to 401.

**Why not per-route:** CONTEXT locks "middleware, not per-route copy-paste". **TTL:** 48 h (CONTEXT says ~24-48 h; the earlier research doc suggests 14 d, but the locked CONTEXT wins).
**Stored body size:** finish returns a list DTO of at most 300 items; fine as `jsonb`. Skip persistence (and delete the reservation) if the serialised body exceeds ~512 KB.

### Pattern 2: Pantry adjust (SYNC-02)
`POST /api/v1/pantry/:id/adjust` body `{ delta, unit? }`.
- Validate `delta`: finite, non-zero, at most 2 decimal places, `|delta| <= 99999`. Accept number or numeric string; parse with `new Decimal(String(delta))` (never float math). Do not accept `deltaCents` (CONTEXT locks `delta`).
- Transaction: `lockUserPantry(tx, userId)` (it locks all live lots in id order, so it serialises with cook-apply and the finish merge), then `findFirst({id, userId, deletedAt: null})` -> 404 if missing, then `next = Decimal.max(current.plus(delta), 0)`, upper bound 99999 (matches the PATCH validator max) , `update`. Response = formatted item + `clamped: boolean` (true when the unclamped result was below 0 or above the cap).
- `unit?`: if absent, assume the item's unit. If present and different after normalisation, convert with `intelligence/units.ts` (`resolveUnit`, `toBase`, `fromBase`, `familyKey`) when the families match, otherwise 400 `UNIT_MISMATCH`. Never silently apply a delta in the wrong unit.
- Preserve the existing low-stock side effect: `updateItem` dispatches Zapier `stock_low` when `0 < qty <= 2`. Extract that into a small shared function and call it from adjust.
- Two queued adjusts (+1, -3 on qty 2) must end at max(2+1-3,0) = 0 and (-3 then +1) at 1; test both orders and concurrent execution via `Promise.all`.

### Pattern 3: Client ids (SYNC-03)
- Pantry `POST /`: add optional `id` to `validateCreateItem` (`body('id').optional().isUUID()`), pass into `prisma.pantryItem.create({ data: { id, ... } })`. The pantry create is a plain (non-interactive-transaction) call, so catching `P2002` on the primary key and then `findUnique({id})` is safe. If the row's `userId` equals the caller: return **200 with the existing row** (original create was 201), without resurrecting a soft-deleted row and without applying new field values. If it belongs to another user: **409** `CLIENT_ID_CONFLICT` (generic message, no row data).
- Shopping `POST /items`: **do not catch P2002 inside the transaction.** In Postgres, a failed statement aborts the whole interactive transaction, so later statements fail with "current transaction is aborted". Instead, after `ensureActiveListId` (which holds the list row lock and therefore serialises same-user retries), do `tx.shoppingListItem.findUnique({ where: {id}, include: { shoppingList: { select: { userId: true } } } })`. Existing and owned -> return it (no insert). Existing and foreign -> 409. Absent -> proceed. Run this BEFORE the `MAX_ITEMS_PER_LIST` count so a replay on a full list still succeeds.
- Edge: after a finish, carried-over unchecked items get NEW ids, so a replayed create whose original row was carried over returns the old (now completed-list) row; its id is not patchable on the new list. This is a Phase 11 outbox concern; note it, do not solve it here.

### Pattern 4: Finish trip (SYNC-05)
- `finishShopping(userId, carryOver, receiptDate, { addToPantry, occurredAt })`; inside the existing transaction, after history creation and carry-over, if `addToPantry` call `applyPantryMergeInTx(tx, userId, checkedItems, date)` (refactor of `shopping-pantry.service.ts`: the body of its `$transaction` callback becomes the in-tx function; keep a thin wrapper if other callers/tests use `applyPantryMerge`; `tests/shopping-finish-pantry.test.ts` spies on that module, so update the spy target).
- **Lock order:** list lock (`findActiveListIdForUpdate`) first, then `lockUserPantry`. No other code path takes the pantry lock and then a list lock (cook and adjust only touch the pantry), so this order cannot deadlock; document it in a comment.
- **Behaviour change to call out in the plan:** a merge failure now rolls back the finish (previously the finish committed and the response said `pantry.failed: true`). The response keeps the `pantry: { added, merged, failed: false }` shape so the existing frontend `finish-toast` logic keeps working; `failed` is now always false. Remove the controller try/catch.
- `occurredAt`: optional ISO-8601 instant, clamped to `[now - 14 d, now]` (future values clamp to now, not rejected). Used for `completedAt`. If `receiptDate` is absent, default it to the UTC date of the clamped `occurredAt`; if both absent keep today (UTC).
- Replace `withinOneDayOfUtcToday` (exported from `shopping-finish.service.ts`, imported by `shopping.validation.ts:18,143`) with `withinReceiptWindow(value, now)`: not more than 14 days before and not more than 1 day after the UTC date. Update the message at validation line 144. Check `tests/shopping-finish.test.ts` lines ~182-220, which assert 400s for out-of-window dates and the +1 day case; adjust bounds there.
- Replay safety = the idempotency middleware: a retried finish with the same key returns the stored first 200 instead of `SHOPPING_LIST_EMPTY`. Test with a real second request and also a concurrent pair.

### Pattern 5: Refresh tokens (SYNC-04)
- **Table `refresh_tokens`:** `id`, `user_id` (FK cascade), `token_hash` (unique, sha256 hex), `family_id`, `expires_at`, `revoked_at`, `revoked_reason` (`rotated`|`logout`|`reuse`|`password_change`), `last_used_at`, `created_at`; indexes on `user_id`, `family_id`, `expires_at`.
- **Token:** 32 bytes `randomBytes`, base64url. Return plaintext once; store only the hash. Lifetime `REFRESH_TOKEN_TTL_DAYS` env (default 90), added to `env.schema.ts` as optional with a default.
- **Responses (additive):** signup/login keep `token` and `expiresIn` (now derived from `config.jwt.expiresIn` instead of the hard-coded `'7d'` in `auth.service.ts`) and add `refreshToken` and `refreshExpiresAt`. `POST /auth/refresh {refreshToken}` returns `{ token, expiresIn, refreshToken, refreshExpiresAt }`.
- **Rotation (atomic):** inside a transaction, conditional `updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now, revokedReason: 'rotated' } })`; `count === 0` means a concurrent refresh won; then apply the grace rule below. Insert the successor with the same `family_id`. Check `user.isActive` and user existence (a deleted user's rows are gone via cascade, so unknown hash -> 401).
- **Reuse detection with a grace window (required):** if a presented token is already revoked with reason `rotated` and `revoked_at` is within `REFRESH_REUSE_GRACE_SECONDS` (suggest 60), issue a fresh successor in the same family instead of treating it as theft. This covers a lost refresh response, double tabs, and an app killed mid-refresh. Outside the grace window, revoke the whole family (`reuse`) and return 401. Without this window, every dropped response on a bad connection logs the user out, which defeats the phase goal. [ASSUMED: design choice; Auth0's rotation page (fetched) describes strict reuse detection with no overlap, so the grace window is our deliberate relaxation, bounded to 60 s.]
- **Logout:** `POST /auth/logout` stays unauthenticated (an expired access token must still be able to log out); accepts optional `{refreshToken}`; revokes the family; always 200 (do not reveal token validity). Apply the new limiter.
- **Revocation hooks:** password change (`users.service.ts changePassword`, ~line 266) revokes all of the user's refresh rows; account deletion removes them by FK cascade (also add an explicit `tx.refreshToken.deleteMany` in `account-deletion.service.ts` for clarity, plus `tx.idempotencyKey.deleteMany`).
- **Access TTL:** CONTEXT wants short-lived. Change the `JWT_EXPIRES_IN` default in `env.schema.ts` from `7d` to `1h` and return the real value. Deployment warning for the plan: Railway may already set `JWT_EXPIRES_IN=7d`, and the deployed Vercel frontend must ship the SYNC-07 refresh logic BEFORE the access TTL is shortened in production, otherwise logged-in web users get 401 and are signed out. Production deploy is a separate approved step per CONTEXT, so record the ordering in the plan.
- **Limiter:** new `refreshLimiter` (suggest 30 / 15 min per IP, `skipSuccessfulRequests: true`). `authLimiter` (5 / 15 min) is far too tight and would also block legitimate silent renewals.

### Pattern 6: CORS (SYNC-04)
- Add `export const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost'] as const` in `cors.config.ts` and include them in the `exact` set inside `buildOriginPredicate` by default. Capacitor's documented defaults are `iosScheme: capacitor`, `hostname: localhost` (so the iOS origin is exactly `capacitor://localhost`) and `androidScheme: https`. [CITED: capacitorjs.com/docs/config] `ionic://localhost` is the legacy Ionic/Cordova iOS scheme, kept because CONTEXT locked it; it is harmless. Android's `https://localhost` is not needed (iOS-only milestone) and is deliberately excluded.
- **Do not route these through `CORS_ORIGIN`:** `env.schema.ts parseOrigin()` accepts only `http:`/`https:` and production forces https and non-loopback, so the config would crash on startup. [VERIFIED: env.schema.ts]
- `buildCorsOptions`: `allowedHeaders: ["Content-Type","Authorization","Idempotency-Key"]`, `exposedHeaders: ["Idempotency-Replayed","Retry-After","RateLimit-Reset"]` (non-safelisted response headers are otherwise invisible to JS). Without `Idempotency-Key` in `allowedHeaders` the preflight fails and every offline-queued write breaks from both web and Capacitor.
- Native HTTP plugins send no `Origin` header; `originGuard` already passes `undefined` origins.
- Tests: extend `tests/cors.test.ts` (preflight `OPTIONS` with `Access-Control-Request-Headers: idempotency-key`, allowed and rejected origins, still rejects `capacitor://evil`).

### Pattern 7: Bootstrap (SYNC-06)
`GET /api/v1/sync/bootstrap?cursor=<opaque>&limit=<1-200, default 100>` behind `authenticate` and a per-user limiter.
- Fixed section order: `pantry -> recipes -> mealPlans`. Cursor = base64url of `{ s: 'pantry'|'recipes'|'mealPlans', after: string|null }`, parsed and validated with zod (reject malformed -> 400, never trust it into a query).
- Each page returns `{ section, items, nextCursor|null }`; when a section is exhausted `nextCursor` points to the start of the next section; `null` after meal plans. **The first page (no cursor) additionally carries `serverTime` (ISO) and `shoppingList`** (reuse `ShoppingService.getActiveList`, bounded to 300 items, lazily creates the list exactly as `GET /shopping/list` already does). Include `serverTime` on every page for clock-skew display.
- Keyset pagination on primary key `id` (`orderBy: {id:'asc'}`, `where: {id: {gt: after}}`, `take: limit`): stable under concurrent inserts, no skipped rows (offset paging would skip rows when items are deleted between pages). Filters: `userId`, `deletedAt: null`. Pantry includes quantity-0 rows (the list endpoint keeps them visible). Meal plans: include `mealPlanItems` with `recipe` select exactly as `getMealPlans` does.
- **Reuse formatters so cached shapes equal the list endpoints:** `toRecipeResponse` (recipe.format.ts, exported), `formatMealPlan` (mealplan.format.ts, exported), and pantry `formatItem` which is currently `private` in `PantryService` (extract to `pantry.format.ts`, keep the class method delegating).
- Not snapshot-consistent across pages (documented trade-off; Phase 11 delta pull addresses it).
- Notifications/preferences are not in CONTEXT scope; leave out.

### Pattern 8: Frontend (SYNC-06 pantry cap, SYNC-07)
- Pantry cap: `usePantryList` (frontend/lib/hooks/use-pantry.ts:26-38) calls `pantryApi.getAll` with no `limit`, so the server default of 50 applies; the server caps `limit` at 100 (validator). Write a small local paging helper under `frontend/lib/api` or `frontend/lib/pantry` that loops `page` with `limit: 100` until `pagination.totalPages` (with a safety cap, e.g. 50 pages). **Do not import or edit `frontend/lib/rules/cook-data.ts` `fetchAllPages`** (Phase 9 territory, another agent is changing that area); duplicating ~15 lines is the correct call. Other no-limit callers (`data-settings.tsx`, `pantry-analytics.tsx`) should also page; `dashboard` uses `limit:1` for a count and `onboarding-flow` searches with `limit:50`, both fine.
- 401 handling in `frontend/lib/api/client.ts`: replace the unconditional `clearToken + clearUserSessionState + redirect` (lines ~55-68) with: skip for `/auth/login|signup|refresh`; if no stored refresh token -> current behaviour (cannot recover); else single-flight `refreshPromise` (shared by all concurrent 401s), call refresh with a **bare axios instance** (not the intercepted one, to avoid recursion), store both new tokens, retry the original request once (`config._retry = true`). Definitive failure = refresh endpoint answered 401/403 -> then and only then clear tokens, `clearUserSessionState`, redirect. Network error, timeout or 5xx on refresh -> do NOT clear anything; reject the original request with its error.
- Store `refresh-token` next to `auth-token` in localStorage for the web build (Keychain storage is Phase 10). Extend `auth-store.setAuth(token, user, refreshToken?)` (callers: `login-form.tsx:44`, `signup-form.tsx:87`) and `AuthResponse` type additively; `clearAuth` removes it; call `POST /auth/logout` with the refresh token in `useLogout`.
- Tests (vitest): extract the decision logic into a pure function (`shouldClearSession(refreshOutcome)`) and unit test it, plus an interceptor test with a mocked axios adapter: concurrent 401s trigger exactly one refresh; success retries original; network failure preserves state; refresh 401 clears.

### Anti-Patterns to Avoid
- **Catching P2002 inside `prisma.$transaction`:** aborts the Postgres transaction; pre-check instead.
- **Caching non-2xx responses under an idempotency key:** blocks legitimate retries.
- **Hashing after validators/sanitizers ran:** hash the raw body in the middleware.
- **Strict single-use refresh with no grace:** logs users out on lost responses.
- **Putting capacitor origins in `CORS_ORIGIN`:** fails env validation in production.
- **Offset paging for bootstrap:** skips rows on concurrent deletes.
- **Unconditional 401 wipe (current client.ts):** destroys the cache and storage on any 401, including a transient expiry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-key request dedup across requests | In-memory Map, cache layer | `idempotency_keys` Postgres table with unique `(user_id,key)` and `INSERT ... ON CONFLICT DO NOTHING` | Survives restarts; unique index is the arbiter under concurrency |
| Crypto-grade tokens | `Math.random`, UUID as secret | `crypto.randomBytes(32)` + sha256 | CSPRNG required |
| Request-body canonicalisation | Ad-hoc `JSON.stringify` | Small recursive key-sort helper (tested) | Key order differs between retries |
| Decimal arithmetic | JS floats | Prisma `Decimal` (decimal.js) | `Decimal(10,2)` drift |
| Unit conversion for adjust | New converters | `intelligence/units.ts` | Already tested, shared with cook/merge |
| Row serialisation of pantry writers | New locking scheme | `lockUserPantry` | Already the contract for cook and merge |
| Per-user rate limiting | Custom counters | `createShoppingLimiter` pattern | Existing key generator and IPv6-safe fallback |
| Scheduling cleanup | setInterval | `node-cron` as in `zapier.scheduler.ts` | Existing pattern |

**Key insight:** every "hard" primitive already exists in the repo (locks, units, formatters, limiter factory, scheduler); the phase is mostly wiring plus two small tables.

## Runtime State Inventory

Not a rename/refactor phase, but there is migration/deploy state to record:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing users have no refresh tokens or idempotency rows; new tables are empty. Existing 7-day access JWTs stay valid until expiry. | None (additive migration). Existing sessions have no refresh token; after SYNC-07 ships they simply behave as before until next login. |
| Live service config | Railway env: `JWT_EXPIRES_IN` may be pinned to `7d`; `CORS_ORIGIN`/`FRONTEND_URL` unaffected. | Deploy-time check; shorten TTL only after the frontend refresh code is live (see Pattern 5). |
| OS-registered state | None | None, verified: no OS tasks tied to this phase. |
| Secrets/env vars | New optional env: `REFRESH_TOKEN_TTL_DAYS`, `REFRESH_REUSE_GRACE_SECONDS`, `IDEMPOTENCY_TTL_HOURS`. No new secrets (opaque tokens are random, no signing key). | Add to `env.schema.ts`, `.env.example`/README table; no Railway secret needed. |
| Build artifacts | Prisma client must be regenerated after the schema change (`prisma generate` runs in `postinstall`/`build`). | Run `npx prisma generate` locally after editing schema. |

## Common Pitfalls

### Pitfall 1: CORS preflight blocks `Idempotency-Key`
**What goes wrong:** every queued write fails in browsers/WKWebView. **Why:** `allowedHeaders` omits it. **Avoid:** add it plus `exposedHeaders`. **Warning sign:** `OPTIONS` returns no `Access-Control-Allow-Headers` containing `idempotency-key`; supertest preflight test catches it.

### Pitfall 2: apiLimiter 429s during outbox drain
**What goes wrong:** 100 req / 15 min / IP applies to `/pantry`, `/sync`, `/auth/refresh`, cook, mealplans. **Avoid:** generalise `isShoppingRequest` skip logic (rateLimiter.ts `skip`) to include `/pantry` and `/sync` for valid-bearer requests, backed by a per-user limiter with a sane ceiling (e.g. 600 / 15 min like shopping); give `/auth/refresh` its own limiter. Unauthenticated traffic stays under the IP limit. Note the skip uses `hasValidBearerToken`, so an EXPIRED token request is still IP-limited, which is acceptable.

### Pitfall 3: DMMF completeness test fails
**What goes wrong:** `tests/account-deletion.test.ts` "has a factory and counter for every model related to User" throws `No deletion fixture for model RefreshToken/IdempotencyKey`. **Avoid:** in the same plan that edits `schema.prisma`, add factories and counters to `tests/helpers/user-owned-fixtures.ts` (`OWNED_MODEL_FACTORIES` / `OWNED_MODEL_COUNTERS`) and, in the main deletion test, assert the counts are > 0 before and 0 after, and the other user's rows are unchanged (the existing loop already does this for every registered model). Keep the models related to `User` via a Prisma relation (`user User @relation(... onDelete: Cascade)`) so the DMMF check applies and the FK cascade works. Add `refreshTokens`/`idempotencyKeys` arrays to the `User` model.

### Pitfall 4: Postgres aborted-transaction after unique violation
See Pattern 3. Never `try { tx.x.create } catch (P2002)` then continue using `tx`.

### Pitfall 5: Refresh rotation vs lost response
See Pattern 5 grace window. Also concurrent refresh from two tabs; the conditional `updateMany` count check plus grace rule handles it deterministically.

### Pitfall 6: Replayed response must be byte-equivalent in meaning
Store `res.statusCode` and the JSON body exactly; replay with the same status (201 for create, 200 for finish). Do not re-run `toItemDto`.

### Pitfall 7: Finish lock ordering and long transactions
The merge reads up to `PANTRY_MERGE_READ_CAP` (2000) rows under lock inside the finish transaction. Keep Prisma's default interactive transaction timeout (5 s) in mind; if tests with big pantries time out, pass `{ timeout: 15000 }` to `$transaction`.

### Pitfall 8: `shopping.validation.ts` imports from `shopping-finish.service.ts`
Moving or renaming `withinOneDayOfUtcToday` breaks that import (circular-ish module coupling). Put `withinReceiptWindow` in `shopping.constants`-adjacent util file and import from both.

### Pitfall 9: Migration style and shadow DB
Migrations are hand-written SQL in the Prisma folder style. Generate the SQL with `npx prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script` or `prisma migrate dev --create-only`, review it, name it `20261015000000_offline_sync` (must sort after `20261014070000_store_readiness`; Phase 9 does not add migrations per its plans, but re-check `ls prisma/migrations` before committing). Use `TEXT` ids and `TIMESTAMP(3)` like existing migrations; FKs `ON DELETE CASCADE`. Partial index for cleanup optional.

### Pitfall 10: Express 4 + async middleware
Errors thrown in an `async` middleware are not caught; wrap in try/catch -> `next(err)` (see `auth.middleware.ts`) or `asyncHandler`.

## Code Examples

### Idempotency reservation (raw SQL, parameterised)
```typescript
// Source: project pattern (shopping.repository.ts uses tagged $queryRaw/$executeRaw)
const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
  INSERT INTO idempotency_keys (id, user_id, key, method, route, request_hash, status, expires_at)
  VALUES (${randomUUID()}, ${userId}, ${key}, ${method}, ${route}, ${hash}, 'in_progress', ${expiresAt})
  ON CONFLICT (user_id, key) DO NOTHING
  RETURNING id`;
const owned = inserted.length === 1;
```

### Persist-before-send wrapper
```typescript
// Source: design for this phase
const originalJson = res.json.bind(res);
res.json = (body: unknown) => {
  const status = res.statusCode;
  const settle = status >= 200 && status < 300
    ? store.complete(rowId, status, body)
    : store.release(rowId);
  void settle.catch(logError).finally(() => originalJson(body));
  return res;
};
```

### Adjust core (inside tx, after lockUserPantry)
```typescript
// Source: pantry.lock.ts contract + shopping.service.ts Decimal usage
const current = new Decimal(item.quantity);
const raw = current.plus(new Decimal(String(delta)));
const next = Decimal.min(Decimal.max(raw, 0), 99999);
const clamped = !next.equals(raw);
const row = await tx.pantryItem.update({ where: { id }, data: { quantity: next } });
```

### Opaque refresh token
```typescript
// Source: Node crypto docs (nodejs.org/api/crypto.html)
const raw = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(raw).digest('hex');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 7-day JWT, no refresh | Short access + rotating opaque refresh | this phase | Sessions survive offline; revocable |
| Absolute pantry quantity PATCH | Delta adjust | this phase | Queued taps merge |
| Finish then merge in 2 txs | One tx | this phase | No lost merge on crash |
| Stripe-style idempotency keys | Same pattern, Postgres-backed | established practice | Replay semantics 422/409/replay |

**Deprecated/outdated:** `withinOneDayOfUtcToday` window (replaced by 14 d past / +1 d future); hard-coded `expiresIn: '7d'` in `auth.service.ts`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | sha256 is adequate for hashing 256-bit random refresh tokens (no bcrypt) | Pattern 5 | Low; standard practice, easily swapped |
| A2 | 60 s reuse grace window, 90 d refresh TTL, 1 h access TTL, 48 h idempotency TTL are acceptable defaults | Patterns 1, 5 | Low; env-configurable. User may prefer different numbers (earlier research doc suggested 1 d access, 14 d key TTL) |
| A3 | Residual crash window between business commit and idempotency completion write is acceptable on single-replica Railway | Pattern 1 | Medium-low; mitigated by optional in-tx hardening for adjust/finish |
| A4 | Prod Railway may have `JWT_EXPIRES_IN=7d` set explicitly | Runtime State | Low; deploy-time check |
| A5 | `ionic://localhost` is harmless to allow and only relevant to legacy Ionic iOS WebViews | Pattern 6 | Low; locked by CONTEXT |
| A6 | Cross-user client-id collision returns 409 (research doc suggested 404) | Pattern 3 | Low; either is acceptable, pick one and test it |
| A7 | Express request-level timeout of Prisma interactive tx (5 s default) is enough for finish+merge | Pitfall 7 | Low; configurable |

## Open Questions

1. **Should adjust/finish write the idempotency completion inside the business transaction?**
   - Known: middleware approach leaves a one-statement crash window. Cook-apply is already replay-safe via `cookedAt` (409).
   - Recommendation: ship the generic middleware; treat in-tx hardening as an optional follow-up task, not a requirement.
2. **Access-token TTL in production**
   - Unknown: current Railway `JWT_EXPIRES_IN` value and frontend deploy ordering.
   - Recommendation: plan a deploy-order note; change code default now, change Railway var only after the frontend ships.
3. **Allow replaying 2xx only vs also deterministic 4xx (e.g. 409 already cooked)?**
   - Recommendation: 2xx only (simplest, safe).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (local) | Real-DB tests, migrations | yes | server accepting on localhost:5432; client psql 14.19 | - |
| Node | Everything | yes | v24.9.0 | - |
| Jest + real DB | Backend tests | yes (account-deletion + cors suites: 27 passed in 2.7 s) | jest 29.7 | - |
| Prisma CLI | migrate/generate | yes (5.22.0 in node_modules) | 5.22.0 | - |
| vitest | Frontend tests | declared (5.0.3) | not run in this session | - |

**Missing dependencies with no fallback:** none. Production deploy of migrations is a separate approved step (CONTEXT).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest 29.7 + ts-jest + supertest (backend); vitest 5.0.3 (frontend) |
| Config file | `backend/jest.config.js` (roots `tests/`, setup `tests/setup.ts`, 30 s timeout, `resetMocks/restoreMocks: true`); `frontend/vitest.config.ts` |
| Quick run command | `cd backend && npx jest tests/<file>.test.ts --coverage=false` |
| Full suite command | `cd backend && npm test` ; `cd frontend && npm test` |

Note: `resetMocks: true` means jest mocks must be re-established inside each test or `beforeEach`; real-DB tests tag users with a unique prefix (`${PREFIX}-x@example.com`) and delete by `startsWith` in `afterEach/afterAll` (pattern in account-deletion and shopping tests).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Same key replays stored response, data changed once; different body 422; concurrent duplicate gets 409 or replay, single apply; non-2xx not cached; missing header no-op; malformed key 400; expiry; per-user scoping (same key, two users) | integration | `npx jest tests/idempotency.test.ts --coverage=false` | Wave 0 |
| SYNC-01 | canonical body hash and key validation | unit | `npx jest tests/idempotency-hash.test.ts --coverage=false` | Wave 0 |
| SYNC-01 | prune job deletes only expired rows | integration | `npx jest tests/sync-cleanup.test.ts --coverage=false` | Wave 0 |
| SYNC-02 | adjust sums +/- deltas, clamps at 0 (`clamped`), cap, 404 other user/deleted, unit mismatch 400, concurrent `Promise.all` adjusts sum correctly, serialised with cook | integration | `npx jest tests/pantry-adjust.test.ts --coverage=false` | Wave 0 |
| SYNC-03 | create with id twice -> one row (200 replay), foreign id 409, invalid uuid 400, soft-deleted not resurrected; shopping same incl. full-list replay and concurrent duplicates | integration | `npx jest tests/client-ids.test.ts --coverage=false` | Wave 0 |
| SYNC-04 | CORS: capacitor origins allowed, evil rejected, preflight allows `Idempotency-Key`, exposes headers | integration | `npx jest tests/cors.test.ts --coverage=false` | exists, extend |
| SYNC-04 | refresh: login/signup return refreshToken; rotate; old token within grace OK; outside grace revokes family; expired/unknown 401; inactive user; logout revokes; password change revokes all; delete account removes rows; concurrent refresh | integration | `npx jest tests/auth-refresh.test.ts --coverage=false` | Wave 0 |
| SYNC-04 | deletion covers new tables (DMMF completeness + counts) | integration | `npx jest tests/account-deletion.test.ts --coverage=false` | exists, extend fixtures |
| SYNC-05 | finish with `occurredAt` and receiptDate 10 days old succeeds; 15 days / +2 days rejected; merge in same tx (force merge failure -> finish rolled back, list still active); replay with key returns first result, no second history row, pantry merged once | integration | `npx jest tests/shopping-finish.test.ts tests/shopping-finish-pantry.test.ts --coverage=false` | exist, update |
| SYNC-06 | bootstrap pages through >100 pantry rows with no gaps/dupes, all sections, first page has serverTime + shoppingList, bad cursor 400, other user's rows absent, soft-deleted absent, 401 unauthenticated | integration | `npx jest tests/sync-bootstrap.test.ts --coverage=false` | Wave 0 |
| SYNC-06 | frontend pantry pager loads all pages | unit | `cd frontend && npx vitest run lib/pantry` | Wave 0 |
| SYNC-07 | interceptor: single-flight refresh, retry once, network failure preserves state, refresh 401/403 clears | unit | `cd frontend && npx vitest run lib/api lib/auth` | Wave 0 |
| (cross) | rate limiter skip list covers `/pantry` and `/sync` for valid bearer; refresh limiter | unit | `npx jest tests/rate-limiter.test.ts --coverage=false` | exists, extend |

### Sampling Rate
- **Per task commit:** the single relevant test file (`--coverage=false`, a few seconds each).
- **Per wave merge:** `cd backend && npm test` and `cd frontend && npm test`, plus `npm run type-check` in both.
- **Phase gate:** both full suites green, backend coverage at or above the 80% project rule for new files, `scripts/smoke-prod.sh` additions run only in the separate approved deploy step.

### Wave 0 Gaps
- [ ] `backend/prisma/schema.prisma` models + migration `20261015000000_offline_sync` + `prisma generate` (blocks every other test)
- [ ] `tests/helpers/user-owned-fixtures.ts`: `RefreshToken` and `IdempotencyKey` factories + counters (blocks the DMMF test)
- [ ] New test files listed above (RED first per project TDD rule)
- [ ] Optional helper `tests/helpers/idempotency-helpers.ts` (signup + key-generating request wrapper)
- [ ] Smoke additions in `scripts/smoke-prod.sh` (cheap): replay a pantry create with the same `Idempotency-Key` and assert one row and the `Idempotency-Replayed` header; call `/sync/bootstrap` and assert `serverTime`; `/auth/refresh` round trip. Follow the `req METHOD URL` helper and numbered-check style (`fail`/`pass`).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Rotating opaque refresh tokens, hashed at rest, reuse detection, revoke on logout/password change/delete |
| V3 Session Management | yes | Short access TTL, refresh family revocation, bounded grace window |
| V4 Access Control | yes | Every query scoped by `userId`; shopping items checked through their list's `userId`; idempotency keys scoped `(user_id, key)`; foreign client ids return generic 409 |
| V5 Input Validation | yes | zod for new boundaries (refresh body, cursor, key header), express-validator extensions for pantry/shopping; uuid, decimal, date-window checks |
| V6 Cryptography | yes | `crypto.randomBytes` + sha256; never hand-rolled; no plaintext refresh tokens in DB or logs |
| V7 Error handling/logging | yes | Do not log tokens or request bodies; replay/in-flight errors use coded `AppError` |
| V13 API / CORS | yes | Exact-match origin allow-list incl. `capacitor://localhost`; no wildcard |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stolen refresh token replay | Spoofing | Rotation + family revocation on out-of-grace reuse; 90 d expiry |
| Idempotency key reuse across users/routes | Tampering / Info disclosure | Unique `(user_id,key)`; hash includes method+route+body; 422 on mismatch |
| Key squatting to replay another user's response | Info disclosure | Per-user key scope (a key from user A never matches user B) |
| Idempotency table / token table growth (DoS) | DoS | TTL + daily prune; per-user rate limits; key length cap; body size cap |
| SQL injection in raw reservation insert | Tampering | Tagged-template `$queryRaw` only |
| Cursor tampering in bootstrap | Tampering | zod-validated cursor, user-scoped queries regardless of cursor content |
| Refresh endpoint brute force | Spoofing | 256-bit random tokens + `refreshLimiter`; uniform 401 |
| CORS origin spoof | Spoofing | Exact-match list; `originGuard` 403 for unlisted origins |
| Account deletion leaves tokens | Repudiation / privacy | FK cascade + explicit delete + DMMF test |

## Project Constraints (from CLAUDE.md and user global rules)
- Keep Next.js + Express + Prisma + Postgres; no rewrite; Prisma stays on 5.22.x; Railway Hobby, free-tier mindset.
- Do not add `railway.json`; migrations run via `entrypoint.sh` `prisma migrate deploy`.
- Immutability (new objects, no in-place mutation), many small files (<800 lines, typical 200-400; `pantry.service.ts` 433, `mealplan.service.ts` 788 should not grow), functions <50 lines, no deep nesting, no hardcoded values (constants/config), validate at boundaries, comprehensive error handling, no silent swallowing.
- TDD: write tests first (RED), 80% coverage target; unit + integration (+ E2E for critical flows where practical).
- Security: no secrets in code, validate all input, parameterised SQL, rate limiting on endpoints, errors must not leak sensitive data.
- Secrets via Railway variables; none are new in this phase.
- GSD workflow: edits happen through GSD execute flow; commit format `<type>: <description>`.
- Do not touch `frontend/lib/rules` or recipes UI (Phase 9).
- Production deploy of migrations is a separate approved step.

## Sources

### Primary (HIGH confidence): code read this session
- backend: `src/app.ts`, `config/cors.config.ts`, `config/env.schema.ts`, `middleware/{auth.middleware,rateLimiter,errorHandler}.ts`, `modules/auth/*`, `modules/users/account-deletion.service.ts`, `modules/pantry/*`, `modules/shopping/*`, `modules/cook/cook.service.ts`, `modules/recipe/recipe.format.ts`, `modules/mealplan/mealplan.format.ts`, `prisma/schema.prisma`, latest migration `20261014070000_store_readiness`, `tests/{account-deletion,setup,helpers/user-owned-fixtures}.ts`, `jest.config.js`
- frontend: `lib/api/client.ts`, `lib/api/pantry.ts`, `lib/stores/auth-store.ts`, `lib/auth/{session-cleanup,use-logout}.ts`, `lib/hooks/use-pantry.ts`, `lib/rules/cook-data.ts` (read only)
- `.planning/research-v2/03-offline-sync.md` (prior research, B1-B9 plan; where it differs from CONTEXT, CONTEXT wins)
- Ran `jest tests/account-deletion.test.ts tests/cors.test.ts` against the local Postgres: 27 passed

### Secondary (MEDIUM confidence)
- https://capacitorjs.com/docs/config: iosScheme default `capacitor`, hostname `localhost`, androidScheme default `https` (fetched this session)
- https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation: strict reuse detection, no documented overlap window (fetched this session; informs the grace-window recommendation)

### Tertiary (LOW confidence)
- Stripe-style idempotency semantics (422 on mismatch, 409 in flight) from the prior research doc and general practice; not re-verified against Stripe docs this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages; all verified in package.json
- Architecture: HIGH for integration points (read the code); MEDIUM for refresh grace-window and TTL choices (design decisions flagged ASSUMED)
- Pitfalls: HIGH, each traced to a specific file/line (CORS headers, env schema, rate limiter skip, DMMF test, P2002-in-tx, private formatItem, lib/rules boundary)

**Research date:** 2026-10-10
**Valid until:** 2026-11-10 (stable stack; re-check migration folder ordering before writing the migration if Phase 9 or others add one)
