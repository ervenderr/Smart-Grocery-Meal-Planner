---
phase: 07-store-readiness
plan: 02
subsystem: frontend-legal
tags: [privacy, terms, support, app-store, ai-disclosure]
requires: []
provides:
  - "Public /privacy, /terms, /support pages"
  - "Shared AI disclosure module (lib/legal/legal-config.ts) for the consent sheet in plan 03"
affects: [07-03]
tech-stack:
  added: []
  patterns: ["Server-component legal pages, single DRAFT_BANNER_ENABLED switch, build-time NEXT_PUBLIC env"]
key-files:
  created:
    - frontend/lib/legal/legal-config.ts
    - frontend/lib/legal/legal-config.test.ts
    - frontend/components/legal/legal-shell.tsx
    - frontend/app/privacy/page.tsx
    - frontend/app/terms/page.tsx
    - frontend/app/support/page.tsx
  modified:
    - "frontend/app/(auth)/signup/page.tsx"
    - frontend/.env.example
key-decisions:
  - "AI_DATA_SENT reflects the backend prompt builders, so diet and allergen settings are listed as NOT sent"
  - "Provider shown via configurable AI_PROVIDER_LABEL (default Dahl Inference), not Gemini/Groq as in UI-SPEC"
requirements-completed: [STORE-04, STORE-02]
duration: ~15min
completed: 2026-10-10
---

# Phase 7 Plan 02: Legal Pages Summary

Public draft Privacy Policy, Terms of Use and Support pages, linked from sign-up, with a tested shared module for AI disclosures and support-email validation.

**IMPORTANT FOR OWNER:** All legal text is a DRAFT and is not legal advice. Review it, then set `DRAFT_BANNER_ENABLED = false` in `frontend/lib/legal/legal-config.ts`. `NEXT_PUBLIC_SUPPORT_EMAIL` must be set in Vercel before store submission (otherwise /support shows "Contact email not configured.").

## Commits
- 79ffcf0: legal config (TDD, 8 tests) and LegalShell
- 7ef1c67: privacy, terms, support pages, sign-up links, .env.example

## Deviations from Plan

**1. [Rule 1 - Accuracy bug] Diet tags removed from AI_DATA_SENT**
- Plan/behavior listed "Your diet tags" as sent. Backend recipes.ts, meal-plan.ts and substitutions.ts state diet and allergen filters are never put in prompts or cache inputs. Listing them would make the privacy policy false.
- Fix: AI_DATA_SENT lists pantry names/quantities, shopping-list ingredients for substitutions, meal-plan days/budget, prep time; AI_DATA_NOT_SENT mentions diet and allergen settings. Tests assert this.
- Plan 03 consent sheet should reuse these constants.

**2. Provider label** uses the configurable default (Dahl Inference) per the plan's own interface note rather than UI-SPEC's "Gemini or Groq".

**3. Lint fix:** wordmark uses `next/link` (ESLint no-html-link-for-pages).

## Verification
- vitest lib/legal: 8/8 pass (RED confirmed before implementation)
- eslint on all touched files: clean
- tsc: no errors in my files. Existing errors only in Phase 9's in-progress `lib/rules/substitutions.test.ts` (out of scope).
- `next build` NOT run (avoids collision with parallel plans per orchestrator). Pages are server components with no dynamic APIs, so they should be static; confirm in the next full build.

## Known Stubs
None.

## Self-Check: PASSED
All files exist; commits 79ffcf0 and 7ef1c67 present.
