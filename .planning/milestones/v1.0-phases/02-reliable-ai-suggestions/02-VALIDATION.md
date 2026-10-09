---
phase: 2
slug: reliable-ai-suggestions
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
---

# Phase 2 — Validation Strategy

> Detailed per-requirement test map lives in `02-RESEARCH.md` under "Validation Architecture". All provider/OFF/USDA calls are mocked in tests; no network in CI.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 + ts-jest + supertest (backend); frontend lint + type-check + build |
| **Config file** | `backend/jest.config.js` |
| **Quick run command** | `cd backend && npx jest tests/<file>.test.ts --coverage=false` |
| **Full suite command** | `cd backend && npm test` and `cd frontend && npm run lint && npm run type-check && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~120 seconds |

## Sampling Rate

- **After every task commit:** quick run of touched tests + `npx tsc --noEmit`
- **After every plan wave:** full suite
- **Before verification:** full suite green; live smoke call only after the user sets `AI_API_KEY`

## Wave 0 Requirements

- Tests for provider adapter, JSON extractor/repair, quota (atomic), cache, dietary filter, OFF/USDA clients are written first (red) in their plans.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live suggestion via Dahl | AI-01..03 | Needs user's API key and token allocation | After user sets `AI_API_KEY` (Railway) and allocates tokens in Dahl: request a recipe suggestion in the app |
| Attribution visible | AI-07 | Visual check | Look up a barcode number in add-pantry modal; see OFF attribution |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 120s

**Approval:** approved 2026-10-09
