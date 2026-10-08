# Phase 3: Mobile-First Shell - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Someone with a phone can install Kitcha and use every screen comfortably with a thumb. Covers MOB-01..MOB-06: bottom navigation + "More" sheet below `lg`, usable at 375px with 44px touch targets and safe-area padding, `dvh` viewport units, web manifest + icons with an iOS install hint, onboarding + empty states, configurable per-user currency. Offline service worker and in-app install prompt are v2 (not this phase). Frontend-heavy; small additive backend change allowed for onboarding state.

</domain>

<decisions>
## Implementation Decisions

### Navigation (user decision)
- Bottom bar (below `lg`): Home (dashboard), Pantry, Meals (mealplans), Shopping. A fifth "More" item opens a bottom sheet containing: Recipes, AI features, Budget, Analytics, Alerts/Notifications, Settings, Profile, Help, Logout.
- At `lg` and up keep the existing sidebar; below `lg` hide the sidebar and render the bottom nav. Header becomes compact on mobile; notifications reachable from the header or More.
- Active tab state clear; bottom nav respects iOS safe-area (`env(safe-area-inset-bottom)`); content gets bottom padding so nothing hides behind the bar.

### Look and feel (user decision)
- Keep current look and branding (colors, type); rework layouts, spacing, touch targets and navigation to be mobile-first. No theme/dark-mode work this phase.

### Mobile usability rules
- Every screen works at 375px with no horizontal page scroll (tables become cards/stacked lists, modals become full-width bottom sheets on mobile), minimum 44x44px interactive targets, inputs 16px font to avoid iOS zoom, replace the 7 `h-screen`/`min-h-screen` usages with `dvh` equivalents, `viewport-fit=cover` via the Next viewport export, safe-area padding.
- Audit all pages: dashboard, pantry, recipes, mealplans, shopping, budget, analytics, alerts, settings, profile, help, login, signup.

### PWA install (MOB-04)
- `app/manifest.ts` (name Kitcha, standalone display, theme/background colors from the current palette, start_url `/dashboard`), icons 192/512 + maskable + `apple-touch-icon`, generated from existing branding/favicon (create simple brand icons if none exist; no service worker this phase).
- iOS has no install prompt: show a dismissible "Add to Home Screen" hint (Share icon steps) on iOS Safari when not already standalone; remember dismissal in localStorage (wrapped in try/catch).

### Onboarding and empty states (MOB-05)
- Short first-run onboarding (max 3 steps): weekly budget + currency, dietary needs (store as the existing frontend values, e.g. `gluten_free`), add first pantry items (or skip). Completion stored server-side via a nullable `onboardingCompletedAt` column on `UserPreference` (additive Prisma migration; applied by the entrypoint on deploy) so it follows the user across devices; existing users must not be forced through it unexpectedly (backfill: treat users who already have pantry items or non-default preferences as completed, or show a skippable prompt).
- Every list screen (pantry, recipes, meal plans, shopping, alerts) uses the shared `EmptyState` component with a clear next action.

### Currency (user decision, MOB-06)
- Per-user setting using the existing backend `UserPreference.currency` (default PHP). Picker with PHP, USD, EUR, GBP, SGD, JPY, AUD, CAD plus a few more. Replace hard-coded `₱` in all listed files (shopping, dashboard, budget, help, analytics, mealplans, preferences-settings, AI modals, charts, meal-plan card/detail) with a single `formatCurrency(amountCents, currency)` helper (Intl.NumberFormat, correct fraction digits e.g. JPY has 0) fed by the user's preference through a small context/hook; never hardcode symbols.

### Testing and delivery
- Frontend has no test framework: gates are lint, type-check and production build (`NEXT_PUBLIC_API_URL=https://x.example npx next build`); add focused unit tests only for pure helpers if a lightweight runner (Vitest) is added, otherwise backend Jest tests for any backend change. Optionally Playwright 375px smoke if cheap.
- Backend change (onboarding column + preference endpoint) must stay additive and backward compatible; deploy via `cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`. Frontend deploys by push to main (Vercel auto-builds; `NEXT_PUBLIC_API_URL` is already set). CI must stay green.

### Resolved research questions (orchestrator decisions, 2026-10-09)
- Onboarding backfill: mark complete for users who have any pantry item (including soft-deleted), non-default preferences (DB defaults PHP and 10000 cents), or whose preferences were ever updated; everyone else sees onboarding once, skippable.
- Budget input: replace fixed PHP-scaled sliders with a numeric input (major units, min 1, sensible max) so JPY/KRW/IDR work; stored amounts stay value x 100 and are NOT converted when the currency changes.
- `/recipes?ai=suggestions` via `useSearchParams` must be wrapped in `<Suspense>` (verify `next build` passes).
- Real-iPhone verification (standalone mode, safe-area, keyboard hiding the bar, More sheet) is a final manual checkpoint for the user and may be deferred; use a 375/390/1280px manual checklist, no Playwright in CI.
- Add Vitest (node env, pure helpers only) with a CI step; backend Jest for the onboarding endpoint and migration. Deploy backend first, frontend after (frontend treats a missing `onboardingCompletedAt` field as "don't show onboarding").
- Wave 0 must define the missing Tailwind 4 `@theme` tokens (animations, shadow-soft) in `globals.css` because `tailwind.config.ts` is not loaded.

### Claude's Discretion
Component structure, icon set (Lucide already used), sheet animation, onboarding copy, icon artwork, breakpoints beyond `lg`, which pages need card layouts.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/components/dashboard/dashboard-sidebar.tsx`, `dashboard-header.tsx`, `notifications-dropdown.tsx`; `frontend/components/common/empty-state.tsx` (barely used), `components/ui/modal.tsx`; `frontend/lib/utils.ts` (existing currency formatting with ₱), `frontend/components/settings/preferences-settings.tsx`.
- Backend `UserPreference` already has `currency` (default "PHP"), `budgetPerWeekCents`, `dietaryRestrictions`.

### Established Patterns
- Next.js 16 App Router with route groups `(app)` and `(auth)`; `app/(app)/layout.tsx` hosts the shell; Tailwind 4; Zustand; Axios client with Bearer token.

### Integration Points
- `app/(app)/layout.tsx` (shell), `app/layout.tsx` (viewport/manifest metadata), preferences API (`/api/v1/users/...`), pantry page for onboarding step.

</code_context>

<specifics>
## Specific Ideas

Primary use is on a phone in the kitchen or grocery aisle; thumb reach matters. Philippine peso is the default currency.

</specifics>

<deferred>
## Deferred Ideas

- Service worker, offline shell, in-app Android install prompt, update prompt (v2 OFF-01..03).
- Dark mode / visual refresh.

</deferred>
