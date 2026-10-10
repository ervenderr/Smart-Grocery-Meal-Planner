# Phase 9: Offline Rules Engine - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Autonomous

<domain>
## Phase Boundary
OFF-08: pure TypeScript, no network, no model: "what can I cook" ranking from the pantry and ingredient substitutions. Shared by the web app and the future iPhone app. No Xcode.
</domain>

<decisions>
## Implementation Decisions
- Pure, deterministic, side-effect-free module under `frontend/lib/` (e.g. `lib/rules/`), fully unit-tested with vitest; reuse the v1.0 pantry-aware matching/unit-family/Decimal-style logic where it exists on the server (research it; keep client and server results consistent, add parity tests on shared fixtures).
- Ranking: score recipes by ingredient coverage from pantry (quantity-aware, unit families), expiring-soon boost (use-it-up), missing-count penalty, optional diet/exclusion filters. Returns explainable result (have / missing / expiring-used) so UI can show why.
- Substitutions: curated static table (JSON) of common swaps with ratios/notes and dietary tags, lookup by normalized ingredient name with fuzzy/alias matching; works offline; sourced from the app's own data only.
- Surface in the web app now: a "Cook from what you have" ranked list and a "Substitute" affordance for missing ingredients, usable with the network off (data comes from React Query cache / existing recipes list). UI hint: yes - follow existing design system.
- Performance budget: ranking 500 recipes x 200 pantry items under ~100 ms on a mid phone.

### Claude's Discretion
File names, alias matching algorithm, table contents (aim for 150+ common swaps), UI placement.
</decisions>

<code_context>
Research: `.planning/research-v2/02-ondevice-ai.md` (rules first, no model). Existing recipes/pantry hooks in frontend/lib/hooks.
</code_context>

<specifics>
Must not depend on Capacitor APIs. Cooking itself (apply deduction) remains Phase 11.
</specifics>

<deferred>
- AI-generated plans offline (Phase 13), offline cook apply (Phase 11).
</deferred>
