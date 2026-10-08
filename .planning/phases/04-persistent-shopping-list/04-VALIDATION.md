---
phase: 4
slug: persistent-shopping-list
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
---

# Phase 4 — Validation Strategy

> Per-requirement test map lives in `04-RESEARCH.md` under "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + supertest (backend, temp Postgres 16); Vitest (frontend pure helpers under lib/); lint/type-check/build |
| **Quick run command** | `cd backend && npx jest tests/shopping*.test.ts --coverage=false` ; `cd frontend && npx vitest run` |
| **Full suite command** | `cd backend && npm test` and `cd frontend && npm run lint && npm run type-check && npm test && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~180 seconds |

## Sampling Rate

- After every task commit: quick run + type-check
- After every wave: full suite
- Before verification: full suite green; backend deployed and smoke-tested BEFORE the frontend is pushed

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shopping mode on a real phone (wake lock, thumb reach, sinking checked rows) | SHOP-04 | Needs a device; deferrable | Open Shopping on phone, toggle shopping mode, leave idle, check screen stays on, check off items |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 180s

**Approval:** approved 2026-10-09
