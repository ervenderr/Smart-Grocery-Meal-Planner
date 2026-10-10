# Phase 7: Store Readiness - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Autonomous (decisions derived from research-v2/04 + user-approved defaults)

<domain>
## Phase Boundary
Meet App Store account, AI and legal requirements (STORE-01..05). No Xcode needed. Backend (Express/Prisma) + web frontend only.
</domain>

<decisions>
## Implementation Decisions
- **Account deletion (STORE-01):** add a real hard-delete route (the existing `DELETE /users/account` only deactivates; `deleteAccount()` in users.service.ts has no route; route validation requires a password the frontend never sends - fix end to end). Re-auth by password in body. Delete in ONE transaction: all user-owned rows (pantry+lots, recipes, meal plans, shopping lists/items, budget, notifications, etc.) AND `AiUsage` rows (no FK today - delete explicitly). Verify via a test that enumerates every Prisma model with a userId. Frontend: Settings "Delete account" with confirm sheet + password, then clear local state and redirect to login.
- **AI consent (STORE-02):** nullable `aiConsentAt` + `aiConsentVersion` on User (additive migration). `POST/DELETE /users/me/ai-consent` (or equivalent). All AI endpoints return 403 `AI_CONSENT_REQUIRED` without consent. Frontend consent sheet shown before any AI entry point sends data; names the provider category, what is sent (pantry item names, diet tags; no email/name), and links to privacy policy; withdraw in Settings.
- **AI labels + report (STORE-03):** "AI-generated" badge and a short health/nutrition disclaimer on every AI recipe/plan surface; "Report" action stores an `AiReport` row (userId, kind, refId/snapshot, reason, createdAt) via authenticated endpoint; rate limited.
- **Legal pages (STORE-04):** public Next routes `/privacy`, `/terms`, `/support` in the existing frontend (hosted on Vercel), no auth, linked from Settings and the sign-up screen. Draft real content covering data collected, AI providers, Open Food Facts attribution (ODbL), deletion, contact. Support email from env `NEXT_PUBLIC_SUPPORT_EMAIL`. Mark clearly in the summary that the text is a draft for the owner to review (not legal advice).
- **Name (STORE-05):** keep "Kitcha" as working name (a similar app "Kitcha: Save, Plan, Cook" by Kamp Inc exists - flagged). Produce `docs/store/NAME-CHECK.md` (App Store search, USPTO/WIPO/IPOPHL checklist) and 5+ fallback names. Do NOT rename code.
- **Reviewer account (STORE-05):** idempotent seed script `backend/scripts/seed-reviewer.ts` (demo user + sample pantry/recipes/shopping/plan), plus `docs/store/REVIEW-NOTES.md`. Script is tested locally only; running it against production is a later human-approved step.

### Claude's Discretion
Table/route names, UI placement within Settings, copy wording, test layout - follow existing codebase conventions (zod validation at boundaries, small files, immutable updates, additive migrations only).
</decisions>

<code_context>
## Existing Code Insights
Backend `users` module has soft-delete route + unused hard-delete service. AI usage rows live in `AiUsage` without a user relation. Frontend token in localStorage. Research: `.planning/research-v2/04-monetization-appstore.md`.
</code_context>

<specifics>
Apple guidelines: 5.1.1(v) deletion, 5.1.2(i) AI consent, 1.2/AI-content reporting. UI hint: yes (settings, consent sheet, badges, legal pages).
</specifics>

<deferred>
- Actual trademark clearance / final name (human). Production seeding of the reviewer account. Sign in with Apple (only if third-party login is added).
</deferred>
