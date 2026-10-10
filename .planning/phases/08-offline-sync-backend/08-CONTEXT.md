# Phase 8: Offline Sync Backend - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Autonomous (decisions from research-v2/03-offline-sync.md)

<domain>
## Phase Boundary
Make the Express API safe for flaky-network clients (SYNC-01..07). Backend plus the small frontend changes for pantry fetch cap and 401 handling. All migrations additive. No Xcode.
</domain>

<decisions>
## Implementation Decisions
- **Idempotency (SYNC-01):** `Idempotency-Key` header on mutating routes (pantry, shopping, mealplan, cook, finish). New `idempotency_keys` table (userId, key, route, requestHash, status, responseStatus, responseBody, createdAt, expiresAt ~24-48h). Replay returns the stored response; same key + different body returns 422; in-flight duplicate handled safely. Implemented as middleware, not per-route copy-paste. Cleanup of expired keys.
- **Pantry adjust (SYNC-02):** `POST /pantry/:id/adjust` with `{delta, unit?}`; Decimal math, clamp at 0, uses existing pantry lock; combined with idempotency.
- **Client ids (SYNC-03):** pantry and shopping item create accept optional client-generated UUID `id` (validated, conflict -> idempotent return of existing for same user).
- **CORS + refresh tokens (SYNC-04):** allow origins `capacitor://localhost` and `ionic://localhost` (confirm exact set in research) in addition to current; refresh token flow (rotating, hashed at rest, revocable, long-lived) with short-lived access token; logout and account delete revoke. Keep web app working unchanged (backwards compatible login response additive).
- **Finish trip (SYNC-05):** accept `occurredAt`; widen receipt-date window (offline trips may be days old); move pantry merge into the SAME transaction as finish; a retried finish must be idempotent (no `SHOPPING_LIST_EMPTY` surprise).
- **Bootstrap (SYNC-06):** `GET /sync/bootstrap` paged/cursored returning pantry, shopping list, recipes, meal plans (+ server time); fix the pantry list fetch cap of 50 rows on the web client so all rows load (paging).
- **401 handling (SYNC-07):** frontend 401 no longer wipes unsynced local state; try refresh first; only clear on definitive refresh failure.

### Claude's Discretion
Names, file layout, exact limits/TTLs - follow existing module patterns, zod at boundaries, tests (unit + integration against real DB as in v1.0), smoke checks added to scripts/smoke-prod.sh where cheap.
</decisions>

<code_context>
Research: `.planning/research-v2/03-offline-sync.md` lists problems found (50-row cap, 401 wipe, receiptDate UTC window, finish retry, second-transaction merge) and backend steps B1-B9. Phase 7 may add User columns/migrations concurrently-ordered earlier - keep migration timestamps later than Phase 7's.
</code_context>

<specifics>
Production deploy of this phase's migrations is a separate approved step (additive only).
</specifics>

<deferred>
- Delta-pull sync endpoints, queued finish on the client (Phase 11).
</deferred>
