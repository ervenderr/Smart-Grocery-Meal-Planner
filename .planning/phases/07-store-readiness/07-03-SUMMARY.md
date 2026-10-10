---
phase: 07-store-readiness
plan: 03
subsystem: frontend-ai-consent
tags: [consent, ai, zustand, react-query, store-readiness]
requires: [07-02]
provides: [useAiConsent, runWithAiConsent, AiConsentHost, aiConsentApi]
affects: [frontend/lib/api/client.ts, frontend/app/(app)/layout.tsx]
key-files:
  created:
    - frontend/lib/ai/consent-flow.ts
    - frontend/lib/ai/consent-flow.test.ts
    - frontend/lib/ai/consent-store.ts
    - frontend/lib/api/ai-consent.ts
    - frontend/lib/hooks/use-ai-consent.ts
    - frontend/components/ai/ai-consent-sheet.tsx
    - frontend/components/ai/ai-consent-host.tsx
  modified:
    - frontend/app/(app)/layout.tsx
    - frontend/lib/api/client.ts
decisions:
  - Consent state lives in react-query (cleared on logout); zustand store is UI-only and not persisted.
  - Unknown consent state prompts rather than runs.
metrics:
  tasks: 2
  completed: 2026-10-10
---

# Phase 07 Plan 03: Client AI Consent Summary

Client-side AI consent: pure tested decision logic, non-persisted zustand store, react-query hook with `runWithAiConsent`, a single shared "Use AI features?" sheet mounted in the (app) layout, and central handling of 403 `AI_CONSENT_REQUIRED` in the axios client.

## Commits
- 29a2986: consent logic, store, API module, hook (Task 1)
- 27b55de: sheet, host, layout, client wiring (Task 2)

## Verification
- `npx vitest run`: 55 files, 782 tests pass (consent-flow: 15 cases).
- `npx tsc --noEmit`: clean. ESLint on touched files: 0 errors (only pre-existing `any` warnings in client.ts).

## Deviations from Plan
- Provider wording in the sheet uses `AI_PROVIDER_LABEL` from legal-config rather than UI-SPEC "Google Gemini or Groq", because the backend provider is a configurable OpenAI-compatible endpoint (RESEARCH A4), as the plan directed.
- TDD: tests were written first and failed (module missing), but RED and GREEN were committed together in one task commit rather than separately.

## Notes for downstream plans
- Plan 09: wrap AI triggers with `useAiConsent().runWithAiConsent(action)`.
- Plan 10: use `useAiConsent`, `useWithdrawAiConsent` in Settings.
- Server 403 opens the sheet with no pending action; the user re-taps after accepting.
- Backend endpoints `/api/v1/users/me/ai-consent` are built against contract; not verified against a running server here.

## Known Stubs
None.

## Self-Check: PASSED
