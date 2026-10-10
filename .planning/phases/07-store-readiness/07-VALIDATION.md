---
phase: 7
slug: store-readiness
status: automated-green-manual-pending
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract. Source of truth: the Validation Architecture section of 07-RESEARCH.md.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend jest 29 + ts-jest + supertest (real Postgres); frontend vitest (lib/**/*.test.ts) |
| **Config file** | backend/jest.config.js, frontend/vitest.config.ts |
| **Quick run command** | `cd backend && npx jest <file> --coverage=false` ; `cd frontend && npx vitest run lib` |
| **Full suite command** | `cd backend && npm test` ; `cd frontend && npm test && npx tsc --noEmit && npm run lint && npx next build` |
| **Estimated runtime** | ~120 seconds |

## Sampling Rate

- **After every task commit:** quick run of the task's test file
- **After every plan wave:** full suites
- **Before verify-work:** full suites green, next build green
- **Max feedback latency:** 120 seconds

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | Status |
|-----|----------|-----------|-------------------|--------|
| STORE-01 | Hard delete incl. RESTRICT FK case, wrong password non-401, DMMF coverage | integration | `npx jest tests/account-deletion.test.ts` | green (2026-10-10) |
| STORE-02 | AI consent gate 403, grant/withdraw, versioning | integration + unit | `npx jest tests/ai-consent.test.ts`; `npx vitest run lib/ai` | green (2026-10-10) |
| STORE-03 | AI report store/validate/rate-limit | integration | `npx jest tests/ai-report.test.ts` | green (2026-10-10) |
| STORE-04 | Public legal pages render | build + curl | `cd frontend && npx next build` | green (2026-10-10) |
| STORE-05 | Reviewer seed idempotent and prod-guarded; docs exist | integration + file check | `npx jest tests/seed-reviewer.test.ts` | green (2026-10-10) |

## Wave 0 Requirements

- [x] Local Postgres 16 running, backend/.env from .env.example (not committed), `prisma migrate deploy`
- [x] backend/tests/account-deletion.test.ts, ai-consent.test.ts, ai-report.test.ts, seed-reviewer.test.ts
- [x] tests/helpers/ai-test-helpers.ts grants consent by default
- [x] frontend/lib/ai/*.test.ts for consent helper

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consent sheet, delete flow, badge/report UI | STORE-01/02/03 | No component test infra (no new deps) | Run app locally, exercise flows |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No 3 consecutive tasks without automated verify
- [x] nyquist flag set in frontmatter

**Approval:** automated gate green 2026-10-10; manual browser checks (consent sheet, delete flow, badge/report) human_needed
