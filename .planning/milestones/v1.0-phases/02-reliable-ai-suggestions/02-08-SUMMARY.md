---
phase: 02-reliable-ai-suggestions
plan: 08
status: complete
completed: 2026-10-09
requirements: [AI-01, AI-02, AI-03, AI-07]
---

# Plan 02-08 Summary: Live key and smoke test

## What happened
- User supplied a Dahl key; it was set on Railway as `AI_API_KEY` for `kitcha-api` (project `kitcha`) via `railway variable set --stdin` by the orchestrator with the user's explicit permission (key was a free account key). It is not stored in any repo file. The user first used an anonymous key (HTTP 429 `model_concurrency` for all models: anonymous keys are admitted last), then created a Dahl account, allocated tokens, and the account key was set instead.
- Live smoke (`scripts/smoke-prod.sh --api-only --ai-live`) passes all checks: signup/login/pantry CRUD, AI status available=true (provider dahl), live `suggest-recipes` 200 with suggestions, identical repeat served from cache (`cached=true`), barcode lookup 200 with ODbL attribution, nutrition lookup 503 `LOOKUP_UNAVAILABLE` (no USDA key, accepted).

## Findings
- Dahl latency is erratic: the same ~1,000-token request took 71s once and 0.26s on repeat (Dahl caches identical prompts). The first live attempts timed out at 40s and 90s server-side before a rerun passed.
- Railway config set (non-secret): `AI_TIMEOUT_MS=80000` (below the frontend's 90s AI timeout so users get the clean "unavailable" message first), `AI_MAX_TOKENS=4000`. Default model `MiniMaxAI/MiniMax-M2.7` (reply is `<think>...</think>` + JSON; extractor strips it).
- Tuning knobs if latency hurts: switch `AI_MODEL` to `deepseek-ai/DeepSeek-V4-Flash-0731` (tested 8-39s) or `zai-org/GLM-5.3-Flash` (33s).

## Follow-ups for the user
- The first (anonymous) key and the account key were both pasted into the chat history; rotate them in the Dahl dashboard when convenient.
- Optional: set `USDA_API_KEY` (free, api.data.gov) to enable nutrition lookups.
