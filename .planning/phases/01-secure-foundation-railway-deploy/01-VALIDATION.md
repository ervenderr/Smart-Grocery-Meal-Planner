---
phase: 1
slug: secure-foundation-railway-deploy
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract. Detailed per-requirement commands live in `01-RESEARCH.md` under "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 + ts-jest + supertest (backend); lint + type-check + next build (frontend, no test framework) |
| **Config file** | `backend/jest.config.js` |
| **Quick run command** | `cd backend && npx jest tests/<file>.test.ts --coverage=false` |
| **Full suite command** | `cd backend && npm test` and `cd frontend && npm run lint && npm run type-check && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~120 seconds |

## Sampling Rate

- **After every task commit:** quick run of the touched test file / type-check
- **After every plan wave:** full suite command
- **Before `/gsd:verify-work`:** full suite green (backend 163+/163+, frontend lint exit 0) and production smoke script passes
- **Max feedback latency:** 120 seconds

## Per-Task Verification Map

See `01-RESEARCH.md` → "Phase Requirements -> Test Map" (DEP-01..DEP-09). Planner fills task IDs into each PLAN.md `<verify>` blocks.

## Wave 0 Requirements

- [x] `backend/tests/health.test.ts` — DEP-03
- [x] `backend/tests/trust-proxy.test.ts` — DEP-04
- [x] `backend/tests/env.schema.test.ts` — DEP-05
- [x] `backend/tests/cors.test.ts` — DEP-05
- [x] `scripts/smoke-prod.sh` — DEP-02, DEP-07
- [x] Pantry test uses relative dates (baseline fix) — DEP-09

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel env var set (Production + Preview) | DEP-07 | `vercel` CLI not installed/logged in | Dashboard: Settings → Environment Variables → `NEXT_PUBLIC_API_URL` |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-08
