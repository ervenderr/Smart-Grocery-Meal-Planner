---
phase: 5
slug: pantry-aware-intelligence
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
---

# Phase 5 — Validation Strategy

> Per-requirement test map and the concrete table-driven cases live in `05-RESEARCH.md` under "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + supertest (backend, temp Postgres 16); Vitest (frontend pure helpers under lib/); lint/type-check/build |
| **Quick run command** | `cd backend && npx jest tests/intelligence*.test.ts --coverage=false` ; `cd frontend && npx vitest run` |
| **Full suite command** | `cd backend && npm test` and `cd frontend && npm run lint && npm run type-check && npm test && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~200 seconds |

## Sampling Rate

- After every task commit: quick run + type-check
- After every wave: full suite
- Before verification: full suite green; backend deployed and smoke-tested BEFORE the frontend is pushed

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Already in your pantry" note and dashboard "Cook this first" on a phone | INT-03, INT-05 | Visual/device; deferrable | Generate a list from a meal plan with pantry stock; see the note; check the dashboard card and Recipes sort |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 200s

**Approval:** approved 2026-10-09
