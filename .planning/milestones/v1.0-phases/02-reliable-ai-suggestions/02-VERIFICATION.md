---
phase: 02-reliable-ai-suggestions
verified: 2026-10-09T00:00:00Z
status: human_needed
score: 5/5 roadmap truths verified (7/7 requirements satisfied in code)
overrides_applied: 0
human_verification:
  - test: "Open the deployed frontend, log in, and run recipe suggestions, a meal plan and a substitution"
    expected: "Results render; repeating the same request is fast; with a diet set, the diet notice appears when items are filtered; barcode lookup shows Open Food Facts attribution"
    why_human: "User has not tried AI in the browser UI; visual and UX behaviour cannot be verified by grep"
---

# Phase 2: Reliable AI Suggestions Verification Report

**Phase Goal:** Users get dependable, safe AI suggestions that stay within free-tier limits and degrade gracefully with a clear message when the provider fails.
**Status:** human_needed (all automated checks pass; one browser check outstanding)
**Re-verification:** No, initial

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Well-formed result or nothing (malformed output repaired or rejected) | VERIFIED | `ai.orchestrator.ts` callProviderWithRepair: tolerant extract, Zod parse, exactly one repair call, else ProviderError then AI_UNAVAILABLE. Cache read also re-validates with schema. Live suggest-recipes 200 (orchestrator smoke). |
| 2 | Identical request served from cache, no provider call | VERIFIED | runAiFeature checks `getCached` before quota reserve or provider; `ai_cache` table in migration `20261009120000_ai_usage_and_cache`. Live repeat returned cached=true. |
| 3 | Per-user and global daily cap with clear quota message | VERIFIED | `ai-quota.repository.ts` atomic UTC-day upsert; defaults `AI_USER_DAILY_LIMIT=20`, `AI_GLOBAL_DAILY_LIMIT=100` in `env.schema.ts`; `aiQuotaExceededError` carries scope, limit and resetsAt; `ai_usage` table (scope, day) migrated. |
| 4 | Provider failure gives "unavailable" message, quota refunded, app keeps working | VERIFIED | `generate()` refunds via `safeRefund` then throws `aiUnavailableError`; missing key returns unavailable before any quota use; no failover per CONTEXT; /health live 200. |
| 5 | Diet/allergen safe; OFF/USDA attribution in UI | VERIFIED (UI visuals pending) | Restrictions loaded in controller and applied post-provider via `filter*` in `apply-dietary.ts`; feature files state filters never enter messages or cacheInputs; `tests/ai-dietary.test.ts` asserts restriction words not sent. Frontend has `food-data-attribution.tsx`, `barcode-lookup.tsx`, `diet-filter-notice.tsx`. Live barcode lookup returned ODbL attribution; nutrition 503 without USDA key (graceful). |

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| AI-01 | SATISFIED | `providers/llm-provider.ts` + `openai-compatible.provider.ts`, env-driven; `@google/generative-ai` absent from package.json and git grep; `backend/src/services` deleted; old `ai.service.ts` gone |
| AI-02 | SATISFIED | Zod + one repair in orchestrator, before cache write |
| AI-03 | SATISFIED | Postgres `ai_cache`, live cached=true |
| AI-04 | SATISFIED | `ai_usage`, 20/user and 100/global per UTC day defaults |
| AI-05 | SATISFIED | refund + unavailable contract; startup/health independent of key |
| AI-06 | SATISFIED | `prompt-sanitize.ts`, `dietary-filter.ts`, filters applied after cache/provider (so cached payloads are re-filtered per user) |
| AI-07 | SATISFIED | `food` module (OFF/USDA clients, throttle, attribution); live barcode OK; USDA needs `USDA_API_KEY` (optional) |

## Cross-checks

| Check | Result |
|-------|--------|
| No secrets: `git grep dahl_` | none; `AI_API_KEY=` hits are only plan/research text with placeholders |
| ERR_ERL_KEY_GEN_IPV6 | `rateLimiter.ts` uses `ipKeyGenerator(req.ip ?? '')` for burst limiter (10/min); no raw req.ip fallback |
| Production health | `/health` returned 200 ok |
| CI | Last completed runs success on main; latest docs-only run in progress at time of check |
| Local `npm test` | Not runnable locally (env/DB vars absent: parseEnv fails in tests/setup); CI provides DATABASE_URL/JWT_SECRET and is green. Not counted as a defect |

## Anti-Patterns

None blocking. No TBD/FIXME/XXX checked beyond targeted greps; none surfaced in inspected files.

## Notes

- Frontend still sends a `dietaryRestrictions` field to the backend (user choice); backend uses it only for in-code filtering, never in provider prompts.
- Dietary filtering is a keyword check, disclosed in UI as not a medical guarantee.
- Nutrition (USDA) lookups remain 503 until `USDA_API_KEY` is set; intended graceful degradation.

## Human Verification Required

1. **Browser AI pass** — Run recipe suggestions, meal plan and substitution in the deployed UI. Expected: results render, repeat is instant, diet notice shows when filtering occurs, barcode lookup shows attribution. Why human: UI not yet exercised by the user.

## Gaps Summary

No gaps. Phase goal is met in code and by live API evidence; only the user's browser check remains.

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_
