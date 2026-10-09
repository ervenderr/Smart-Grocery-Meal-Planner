# Phase 2: Reliable AI Suggestions - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users get dependable, safe AI suggestions that stay within free-tier limits and survive provider hiccups with a clear message. Covers AI-01..AI-07 (with the user decisions below modifying AI-01 and AI-05). Backend-focused; existing AI UI keeps working.

</domain>

<decisions>
## Implementation Decisions

### Provider (user decision, supersedes research default of Gemini + Groq)
- Primary provider: Dahl Inference (https://inference.dahl.global/v1/chat/completions), an OpenAI-compatible API operated by FROMZERO OÜ (Estonia). Advertises first 100M tokens free (terms say free allocations can change or end). Models listed: DeepSeek Flash, MiniMax M2.7, GLM 5.3 Flash, Qwen 3.8 Flash. Exact model ID strings, rate limits and JSON-mode support are UNVERIFIED: the executor must call `GET /v1/models` (once the user has put the key in Railway) and confirm response_format behaviour before relying on it.
- Implement ONE generic `OpenAiCompatibleProvider` configured by env: `AI_PROVIDER` (label), `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`. Defaults point to Dahl. This also supports DeepSeek's own API, Groq or Gemini's OpenAI-compatible endpoint with no code change. Keep an `LlmProvider` interface so a native Gemini adapter can be added later.
- NO automatic fallback provider for now (user decision). When the provider errors, times out, or returns unusable output after one repair retry, return a clear user-facing message ("AI suggestions are unavailable right now, try again later"). AI-05 is reinterpreted accordingly: graceful degradation, not failover.
- Drop `@google/generative-ai` usage from the request path (deprecated). Remove the dead duplicate `backend/src/services/ai.service.ts`.
- API key is a server-side Railway variable only; the user sets it themselves (never in repo, logs or chat). Missing key must not crash startup: AI endpoints return the "unavailable" message and /health stays green.

### Quotas and caching (user-chosen)
- Per-user 20 AI requests/day and global 100/day, DB-backed (Postgres tables `AiUsage`, `AiCache`, additive Prisma migration), day boundary UTC. Cache hits do not consume quota. Cache key = hash of normalized inputs + feature + schema version; only Zod-validated payloads are cached.
- Quota exceeded returns HTTP 429 with a clear message showing remaining/reset time.

### Safety and quality
- Zod schema for every AI response with one repair retry; invalid output is never shown or cached.
- Prompt hygiene: pantry/recipe text is delimited as data in prompts; dietary/allergen filters enforced in code on the AI output (drop violating items), not only in the prompt.
- Send the provider only food-related data (ingredient names, cuisine/meal-type hints, budget); never emails, names, tokens, allergies, medical or religion-linked dietary flags (Dahl terms forbid special-category data). Dietary/allergen restrictions (saved `UserPreference.dietaryRestrictions` plus request-level) are enforced ONLY in code on the AI output, via a pure keyword filter applied after the cache read.
- OFF User-Agent contact: use the public repo URL `https://github.com/ervenderr/Smart-Grocery-Meal-Planner` via `OFF_CONTACT` env default (not the user's email).
- Attribution: reusable attribution UI component plus a minimal barcode-number text lookup in the add-pantry modal (camera scanning stays in Phase 6).
- Frontend error contract: AI error responses carry `message`, `error` and `code`; update AI modals to show server messages.
- Fix the pre-existing `ERR_ERL_KEY_GEN_IPV6` warning in `backend/src/middleware/rateLimiter.ts` (AI limiter keyGenerator) as part of this phase.
- Open Food Facts and USDA FoodData lookups (AI-07): server-side only, required User-Agent, respect 15 req/min OFF limit, cache results, show attribution (ODbL for OFF) in the UI. USDA needs a free key from api.data.gov (user sets `USDA_API_KEY` later; code must degrade gracefully without it).

### Deploy and testing
- Backend redeploys with `railway up --service kitcha-api` from `backend/` after linking to project `kitcha` (verify `railway status` shows `kitcha`; never touch other projects).
- Tests first (TDD) with mocked provider; no real calls in CI. A single manual live smoke call happens only after the user sets the key.

### Claude's Discretion
Module layout under `backend/src/modules/ai/`, prompt wording, schema shapes (keep existing response shapes the frontend uses), quota table design, error codes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/modules/ai/` (controller + service, Gemini-hard-wired, regex JSON parsing), `backend/src/services/ai.service.ts` (dead duplicate), `backend/src/middleware/rateLimiter.ts`, `backend/src/config/env.schema.ts` (Zod env, extend with AI_* vars), `frontend/components/ai/`.

### Established Patterns
- Zod env validation at startup (Phase 1); Jest + supertest with temp Postgres; Prisma 5.22 migrations applied by entrypoint on deploy.

### Integration Points
- Prisma schema (new AiUsage, AiCache), env schema, ai routes/controller, frontend AI components (attribution, quota messages).

</code_context>

<specifics>
## Specific Ideas

User asked for free options; Dahl offers 100M free tokens. Keep cost zero; if Dahl free tokens disappear the user can switch provider by env vars alone.

</specifics>

<deferred>
## Deferred Ideas

- Automatic multi-provider failover (user said none for now).
- Native Gemini SDK adapter.

</deferred>
