# Phase 11: Offline Core - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning
**Mode:** Autonomous (decisions from research-v2/03-offline-sync.md; Phases 7-10 done and deployed; user wants "works with no internet" broadly)

<domain>
## Phase Boundary
OFF-01..07, OFF-09. The installed iPhone app (and, where cheap, the web app) works with no signal: everything readable from a local cache, every edit queued and synced exactly once. Builds on Phase 8 API (Idempotency-Key, client ids, pantry adjust deltas, finish occurredAt, /sync/bootstrap, refresh tokens), Phase 9 rules engine, Phase 10 shell. OFF-08 already done in Phase 9.
</domain>

<decisions>
## Implementation Decisions
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
</decisions>

<code_context>
Research: .planning/research-v2/03-offline-sync.md (problems, phases, estimates). Frontend hooks in frontend/lib/hooks (React Query), API client with refresh in lib/api, Phase 10 native storage adapter and plugin wrappers in frontend/lib/native, rules engine in frontend/lib/rules, mobile/ has Capacitor project and e2e scripts (mobile/scripts: build-ios.sh, sim-run.sh, e2e).
</code_context>

<specifics>
Real iPhone confirmation (airplane mode, kill, reboot) is human_needed. Do not push backend deploys. May push to origin main only if all tests are green and the web build is unaffected.
</specifics>

<deferred>
- Delta-pull incremental sync, household sharing, offline AI (Phase 13), purchase gating (Phase 12).
</deferred>
