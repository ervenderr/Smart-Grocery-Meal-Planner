# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Kitcha v2 production-ready

**Shipped:** 2026-10-10
**Phases:** 6 | **Plans:** 62 executed of 66 (4 real-device checkpoints deferred)

### What Was Built
- Patched Next.js 16.4.0 frontend and a live Railway API with CI, healthcheck, CORS allowlist and per-IP limits
- Env-configured OpenAI-compatible AI pipeline with validation, cache, quotas and diet/allergen enforcement
- Mobile-first shell with bottom nav, onboarding, currency and PWA install metadata
- Persistent shopping lists, pantry-aware list generation, "Cook this first", barcode scan, bought-it and cooked-it loops

### What Worked
- Vertical-slice phases with tests-first plans and smoke checks extended each phase, deploying backend to Railway before pushing the frontend
- Pure, well-tested helpers (units, quantity, grouping) made later phases mostly wiring
- A pre-close milestone audit surfaced bookkeeping debt without blocking the ship

### What Was Inefficient
- Real-device checkpoints were deferred in every phase, so five human_needed verifications piled up at close
- SUMMARY frontmatter (`requirements-completed`, `one_liner`) was inconsistent, so auto-extracted accomplishments were unusable
- VALIDATION.md files were left in `draft` after compliance was reached

### Patterns Established
- Backend deploy first, then push main (CI + Vercel), with a numbered smoke check per phase
- Pure logic modules mirrored between backend and frontend with a shared fixture
- Additive API responses and additive migrations to keep deploys safe on a single replica

### Key Lessons
1. Schedule one consolidated device pass instead of per-phase deferrable checkpoints, or the debt compounds.
2. Enforce SUMMARY frontmatter at plan close so milestone tooling can summarize accurately.
3. Frontend component tests are the main remaining coverage gap.

### Cost Observations
- Model mix: not tracked
- Sessions: not tracked
- Notable: 3 calendar days, 410 commits

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Deferred checks | Audit result |
|-----------|--------|-------|-----------------|--------------|
| v1.0 | 6 | 62 | 5 | tech_debt |
