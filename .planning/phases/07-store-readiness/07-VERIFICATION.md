---
phase: 07-store-readiness
verified: 2026-10-10T00:00:00Z
status: human_needed
score: 5/5 must-haves verified in code (owner decisions and browser pass remain)
overrides_applied: 0
human_verification:
  - test: "Browser pass: consent sheet, withdrawal, delete-account flow, sign-up legal links, AI badge/report (needs AI key)"
    expected: "Per 07-12-SUMMARY human_needed list items 1-5"
    why_human: "No component test infra; visual and flow behaviour"
  - test: "Owner decision on app name (docs/store/NAME-CHECK.md, status not cleared)"
    expected: "Name cleared via App Store + trademark check, or replaced from fallback list"
    why_human: "Roadmap-declared human gate"
  - test: "Owner legal review of draft Privacy/Terms/Support text; set NEXT_PUBLIC_SUPPORT_EMAIL on Vercel; choose public host/domain"
    expected: "Pages final, reachable at public URLs"
    why_human: "Legal review and deployment config"
  - test: "Run reviewer seed against production DB (owner-approved)"
    expected: "Demo account exists in prod; password set in App Store Connect"
    why_human: "Seed deliberately refuses production"
---

# Phase 7: Store Readiness Verification Report

**Goal:** App meets App Store account, AI and legal requirements.
**Status:** human_needed. Re-verification: No.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Delete account with password; data gone | VERIFIED | `backend/src/modules/users/account-deletion.service.ts`: verifies password (403 not 401), single transaction deletes meal plan items (RESTRICT FK), `aiUsage` rows by scope, then user (cascade). Route `DELETE /users/me`. Frontend `delete-account-sheet.tsx` and `danger-zone-card.tsx` exist. `tests/account-deletion.test.ts` passes (incl. DMMF completeness, post-delete login fails). |
| 2 | Consent before AI sends data; withdraw stops AI | VERIFIED | `requireAiConsent` middleware is applied on all 3 AI generation routes in `ai.routes.ts` (403 without consent or below `AI_CONSENT_VERSION`). GET/POST/DELETE `/users/me/ai-consent` present. Frontend `use-ai-consent.ts`, `ai-consent-sheet.tsx`, `ai-privacy-settings.tsx`; all 3 AI modals use consent gating. `tests/ai-consent.test.ts` passes. |
| 3 | AI label, disclaimer, report | VERIFIED | `AiBadge`, `AiDisclaimer`, `ReportSuggestionButton` used in recipe, meal-plan and substitution modals; badge also in `recipe-detail-modal.tsx` for saved AI recipes. `POST /ai/reports` rate-limited, `AiReport` model and migration `20261014070000_store_readiness`. `tests/ai-report.test.ts` passes. |
| 4 | Legal pages public and linked from settings and sign-up | VERIFIED (code) | `frontend/app/{privacy,terms,support}/page.tsx` exist outside the auth group; linked from `signup/page.tsx`, `login/page.tsx`, `settings/legal-links.tsx`. Gate evidence: next build with the 3 pages, curl 200. Pages carry a "Draft: pending owner review" banner. Public hosting URL not yet chosen or deployed. |
| 5 | Reviewer account/notes exist; name cleared or replaced | PARTIAL, human gate | `backend/src/tools/reviewer-seed.ts` (idempotent, refuses NODE_ENV=production, password required and validated), `tests/seed-reviewer.test.ts` passes; `docs/store/REVIEW-NOTES.md` written. `docs/store/NAME-CHECK.md` states "Kitcha (not cleared)" with fallback names. Name decision and prod seed are owner actions. |

**Score:** 5/5 implemented in code; truths 4 and 5 are completed only by owner actions.

## Behavioral Spot-Checks

| Check | Command | Result |
|-------|---------|--------|
| Phase 7 backend suites | `npx jest tests/account-deletion tests/ai-consent tests/ai-report tests/seed-reviewer` | 4 suites, 43 tests pass |
| Gate evidence (from 07-12-SUMMARY, not re-run) | full backend 1285 pass, frontend 821 pass, tsc/lint 0 errors, next build ok | Reported green |

## Requirements Coverage

| Req | Status | Note |
|-----|--------|------|
| STORE-01 | SATISFIED (code) | see truth 1 |
| STORE-02 | SATISFIED (code) | see truth 2 |
| STORE-03 | SATISFIED (code) | see truth 3 |
| STORE-04 | SATISFIED (code) | pages hosted publicly only after deploy |
| STORE-05 | NEEDS HUMAN | seed and notes exist; name not cleared; prod seed not run |

## Anti-Patterns

No blockers found in the verified files. A Phase 9 perf bench (`rank.bench.test.ts`) is flaky and out of scope. REQUIREMENTS.md and ROADMAP.md checkboxes for Phase 7 still show Pending and need updating after sign-off.

## Gaps Summary

No code gaps. Remaining items are the owner decisions and manual browser pass listed in the frontmatter.
