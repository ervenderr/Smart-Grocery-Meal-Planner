---
phase: 3
slug: mobile-first-shell
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-09
---

# Phase 3 — Validation Strategy

> Per-requirement test map lives in `03-RESEARCH.md` under "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend pure helpers, added in Wave 0) + Jest/supertest (backend) + lint/type-check/build |
| **Quick run command** | `cd frontend && npx vitest run` ; `cd backend && npx jest tests/users.test.ts --coverage=false` |
| **Full suite command** | `cd backend && npm test` and `cd frontend && npm run lint && npm run type-check && npx vitest run && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~150 seconds |

## Sampling Rate

- After every task commit: quick run + type-check
- After every wave: full suite
- Before verification: full suite green; deploy backend first, then frontend

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-iPhone standalone, safe-area, keyboard, More sheet | MOB-01..04 | Needs a device; may be deferred | Add to Home Screen, open, check nav/safe-area, focus an input (bar hides), open More |
| 375/390/1280px page walkthrough | MOB-02, MOB-03 | Visual | Check each page for horizontal scroll and 44px targets |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 150s

**Approval:** approved 2026-10-09
