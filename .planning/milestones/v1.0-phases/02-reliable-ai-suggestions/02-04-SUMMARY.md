---
phase: 02-reliable-ai-suggestions
plan: 04
subsystem: api
tags: [postgres, prisma, quota, cache, express]
requires: [02-01]
provides:
  - ai_usage and ai_cache tables (additive migration)
  - buildCacheKey (versioned sha256, canonicalized inputs, no userId)
  - generic getCached/setCached/pruneExpired (reusable for food lookups)
  - atomic reserveQuota/refundQuota (per-user and global UTC-day)
  - runAiFeature with cache -> quota -> provider -> validate -> cache, refund on failure
affects: [02-03, 02-05]
tech-stack:
  added: []
  patterns: [single-statement INSERT ON CONFLICT WHERE count < limit, transactional rollback of global increment]
key-files:
  created:
    - backend/prisma/migrations/20261009120000_ai_usage_and_cache/migration.sql
    - backend/src/modules/ai/ai-cache-key.ts
    - backend/src/modules/ai/ai-cache.repository.ts
    - backend/src/modules/ai/ai-quota.repository.ts
    - backend/tests/ai-cache.test.ts
    - backend/tests/ai-quota.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/modules/ai/ai.orchestrator.ts
key-decisions:
  - "Cache TTL: recipes 24h, meal_plan 24h, substitutions 7d"
  - "Pruning of expired cache and usage older than 14 days runs on ~1 in 20 cache writes, fire-and-forget"
requirements-completed: [AI-03, AI-04, AI-05]
completed: 2026-10-09
---

# Phase 2 Plan 04: AI cache and daily quota Summary

Identical AI requests are now served from Postgres with no provider call and no quota use, and a per-user (20) and global (100) UTC-day cap is enforced atomically with a clear 429; failures refund the reservation and are never cached.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1 RED: cache and quota tests | e4576f9 | failed on missing modules |
| 2 Models, additive migration, key, repositories | 06b6291 | migration is 2 CREATE TABLE + 2 CREATE INDEX |
| 3 Orchestrator wiring (GREEN) | 7f7dc26 | full suite 344/344, tsc clean, lint 0 errors |

## Deviations from Plan

**1. [Test adaptation] Shared-cache test.** The plan's "same pantry names, different extra pantry items, different matchPercentage" scenario cannot share a cache key (the recipe cache key is the pantry name set). The test instead asserts two users with identical pantry names share one provider call, the second gets cached:true, matchPercentage is computed per user, and the second user's quota is untouched.

Otherwise the plan was executed as written. No auth gates.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (tagged-template SQL only, no *Unsafe calls; migration has no DROP/ALTER).

## Notes

- Cache read errors are not swallowed (a DB outage surfaces as a 500, same as the rest of the API).
- Test Postgres 16 was a temporary local cluster on port 5604, stopped and removed.

## Self-Check: PASSED
