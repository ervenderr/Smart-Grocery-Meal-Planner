---
phase: 07-store-readiness
plan: 09
subsystem: frontend-ai
tags: [consent, ai-labeling, store-readiness]
requires: [07-03, 07-04]
provides: [consent-gated AI triggers, AI badge/disclaimer/report on all AI surfaces]
affects: [ai-recipe-suggestions-modal, ai-substitution-modal, ai-meal-plan-modal, recipe-detail-modal]
key-files:
  created:
    - frontend/lib/ai/ai-origin.ts
    - frontend/lib/ai/ai-origin.test.ts
  modified:
    - frontend/components/ai/ai-recipe-suggestions-modal.tsx
    - frontend/components/ai/ai-substitution-modal.tsx
    - frontend/components/ai/ai-meal-plan-modal.tsx
    - frontend/components/recipes/recipe-detail-modal.tsx
decisions:
  - Saved meal plans get no AI badge (no AI-origin flag, no new columns)
metrics:
  completed: 2026-10-10
---

# Phase 7 Plan 09: Consent gate and AI labels on all AI surfaces Summary

Every AI generate trigger (recipe suggestions incl. refresh, substitutions, meal plan form after validation) now runs through `runWithAiConsent`, and every AI result carries AiBadge, AiDisclaimer and a ReportSuggestionButton; saved recipes tagged "AI Generated" show badge and disclaimer.

## Commits
- 225eef2: feat(07-09): gate recipe/substitution AI behind consent and label results (ai-origin helper + 5 tests)
- 1457681: feat(07-09): gate meal plan AI behind consent; label AI plans and saved AI recipes

## Deviations from Plan
None. No extraction files were needed (meal plan modal is 402 lines, under 480).

## Verification
- tsc clean; eslint 0 errors (2 pre-existing warnings: `any` cast, `<img>`)
- vitest: 822/823 pass. The one failure is `lib/rules/rank.bench.test.ts` (Phase 9, untracked, timing budget under parallel load), unrelated to this plan.
- Grep gates: no ungated `handleGenerateSuggestions`/`handleSubmit(handleGenerate)` triggers remain.

## Known Stubs
None.

## Self-Check: PASSED
