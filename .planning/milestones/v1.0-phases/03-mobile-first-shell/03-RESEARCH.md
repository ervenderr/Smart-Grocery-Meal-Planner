# Phase 3: Mobile-First Shell - Research

**Researched:** 2026-10-09
**Domain:** Next.js 16.4 App Router mobile shell, PWA manifest/icons, Intl currency, small additive Prisma/Express change
**Confidence:** HIGH (codebase facts, Next.js docs, Intl behaviour verified locally); MEDIUM (iOS runtime quirks, Vitest recommendation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Navigation (user decision)**
- Bottom bar (below `lg`): Home (dashboard), Pantry, Meals (mealplans), Shopping. A fifth "More" item opens a bottom sheet containing: Recipes, AI features, Budget, Analytics, Alerts/Notifications, Settings, Profile, Help, Logout.
- At `lg` and up keep the existing sidebar; below `lg` hide the sidebar and render the bottom nav. Header becomes compact on mobile; notifications reachable from the header or More.
- Active tab state clear; bottom nav respects iOS safe-area (`env(safe-area-inset-bottom)`); content gets bottom padding so nothing hides behind the bar.

**Look and feel (user decision)**
- Keep current look and branding (colors, type); rework layouts, spacing, touch targets and navigation to be mobile-first. No theme/dark-mode work this phase.

**Mobile usability rules**
- Every screen works at 375px with no horizontal page scroll (tables become cards/stacked lists, modals become full-width bottom sheets on mobile), minimum 44x44px interactive targets, inputs 16px font to avoid iOS zoom, replace the 7 `h-screen`/`min-h-screen` usages with `dvh` equivalents, `viewport-fit=cover` via the Next viewport export, safe-area padding.
- Audit all pages: dashboard, pantry, recipes, mealplans, shopping, budget, analytics, alerts, settings, profile, help, login, signup.

**PWA install (MOB-04)**
- `app/manifest.ts` (name Kitcha, standalone display, theme/background colors from the current palette, start_url `/dashboard`), icons 192/512 + maskable + `apple-touch-icon`, generated from existing branding/favicon (create simple brand icons if none exist; no service worker this phase).
- iOS has no install prompt: show a dismissible "Add to Home Screen" hint (Share icon steps) on iOS Safari when not already standalone; remember dismissal in localStorage (wrapped in try/catch).

**Onboarding and empty states (MOB-05)**
- Short first-run onboarding (max 3 steps): weekly budget + currency, dietary needs (store as the existing frontend values, e.g. `gluten_free`), add first pantry items (or skip). Completion stored server-side via a nullable `onboardingCompletedAt` column on `UserPreference` (additive Prisma migration; applied by the entrypoint on deploy) so it follows the user across devices; existing users must not be forced through it unexpectedly (backfill: treat users who already have pantry items or non-default preferences as completed, or show a skippable prompt).
- Every list screen (pantry, recipes, meal plans, shopping, alerts) uses the shared `EmptyState` component with a clear next action.

**Currency (user decision, MOB-06)**
- Per-user setting using the existing backend `UserPreference.currency` (default PHP). Picker with PHP, USD, EUR, GBP, SGD, JPY, AUD, CAD plus a few more. Replace hard-coded `₱` in all listed files (shopping, dashboard, budget, help, analytics, mealplans, preferences-settings, AI modals, charts, meal-plan card/detail) with a single `formatCurrency(amountCents, currency)` helper (Intl.NumberFormat, correct fraction digits e.g. JPY has 0) fed by the user's preference through a small context/hook; never hardcode symbols.

**Testing and delivery**
- Frontend has no test framework: gates are lint, type-check and production build (`NEXT_PUBLIC_API_URL=https://x.example npx next build`); add focused unit tests only for pure helpers if a lightweight runner (Vitest) is added, otherwise backend Jest tests for any backend change. Optionally Playwright 375px smoke if cheap.
- Backend change (onboarding column + preference endpoint) must stay additive and backward compatible; deploy via `cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`. Frontend deploys by push to main (Vercel auto-builds; `NEXT_PUBLIC_API_URL` is already set). CI must stay green.

### Claude's Discretion
Component structure, icon set (Lucide already used), sheet animation, onboarding copy, icon artwork, breakpoints beyond `lg`, which pages need card layouts.

### Deferred Ideas (OUT OF SCOPE)
- Service worker, offline shell, in-app Android install prompt, update prompt (v2 OFF-01..03).
- Dark mode / visual refresh.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-01 | Bottom bar + More sheet below `lg`; sidebar only at `lg`+ | Shell file-by-file plan (§Architecture), shared `lib/navigation.ts`, Radix Dialog for the sheet, focusin/focusout hide logic |
| MOB-02 | 375px, no horizontal scroll, 44px targets, safe-area padding | Touch-target/16px-input change list, per-page findings, safe-area CSS, Tailwind-4 `@config` pitfall |
| MOB-03 | `dvh` layouts | Exact list of 7 `h-screen` + 4 `90vh` usages (spec missed the 3 AI modals) |
| MOB-04 | Manifest + icons + iOS hint | `app/manifest.ts`, sharp one-off icon script (already installed transitively), `viewport` export, iOS detection helper |
| MOB-05 | Onboarding + empty states | Prisma migration + backfill SQL, `POST /users/onboarding/complete`, pantry enum values, EmptyState file list |
| MOB-06 | Per-user currency | `formatCurrency` design, Intl verified in Node, every `₱` literal with file:line, backend `isIn` validation |
</phase_requirements>

## Summary

The codebase is closer to mobile-ready than the spec implies in some places (Modal is already a bottom sheet, `ui/input` and `ui/select` are `h-11`, no `<table>` exists) and worse in others. The most important new finding is that **Tailwind 4 is not loading `tailwind.config.ts`**: `app/globals.css` has no `@config` directive and the built CSS contains no `slide-up`/`shadow-soft`. So `animate-slide-up`, `animate-fade-in`, `shadow-soft`, the custom `fontSize` scale, and the `18/88/128` spacing do nothing today. The UI contract depends on `animate-slide-up`, `animate-fade-in` and `shadow-soft`, so Wave 0 must move them into an `@theme` block in `globals.css` (Tailwind 4 idiom). Tailwind 4 ships `h-dvh`, `min-h-dvh`, `min-h-11`, `min-w-11`, `h-14` natively, so no config is needed for those.

PWA work is cheap. `app/manifest.ts` and the `viewport` export are documented for Next 16.4.0 [CITED: nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest, /functions/generate-viewport]. PNG icons need no new dependency: `sharp@0.35.5` is already installed in `frontend/node_modules` (Next's optional dependency, `package-lock.json` line 7293) and I rendered `kitcha-logo.svg` to a 192px PNG with it successfully. Commit the generated PNGs under `public/`; keep the script in `frontend/scripts/` and run it with `node` (not a runtime dependency and not added to package.json). No ImageMagick/rsvg/PIL are available locally.

Currency is straightforward. `Intl.NumberFormat` returns 0 fraction digits for JPY/KRW and 2 for PHP/USD/EUR/IDR in Node 24 [VERIFIED: local node run], so no per-currency table is needed. There are 27 `₱` literal lines across 15 files (listed below), plus two `'PHP'` literal fallbacks in `preferences-settings.tsx`. Backend validation uses **express-validator** (not zod; the UI spec's `z.enum` wording is wrong): replace `isLength({min:3,max:3})` with `isIn(SUPPORTED_CURRENCIES)`. Add `onboarding_completed_at TIMESTAMP(3) NULL` with backfill in the same migration, and a dedicated idempotent `POST /api/v1/users/onboarding/complete` that stamps server time.

**Primary recommendation:** Wave 0 = fix Tailwind 4 theme tokens (animations, shadow) + add Vitest and pure helper modules (`lib/currency`, `lib/navigation`, `lib/pwa`) + backend migration/endpoint; then shell, then per-page sweep (currency, touch targets, empty states), then onboarding/PWA. Use `@radix-ui/react-dialog` (already a dependency, currently unused) for the More sheet and to harden `ui/modal.tsx`; add no new runtime dependency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bottom nav / More sheet / responsive shell | Browser / Client | — | Pure client UI; pathname + viewport driven |
| Manifest, icons, viewport meta | Frontend Server (Next metadata routes) | CDN / Static (PNG files in `public/`) | `app/manifest.ts` and `viewport` are rendered by Next; PNGs are static assets |
| iOS install hint | Browser / Client | — | Needs `navigator`, `matchMedia`, localStorage |
| Currency preference storage + validation | API / Backend | Database (`user_preferences.currency`) | Allow-list must be enforced server-side |
| Currency formatting | Browser / Client | — | `Intl` in client components, fed by preference |
| Onboarding completion flag | Database / Storage | API / Backend | Must follow user across devices; server stamps time |
| Onboarding UI flow | Browser / Client | API / Backend (pantry + preferences endpoints) | Reuses existing endpoints |
| Empty states | Browser / Client | — | Presentational |

## Standard Stack

### Core (all already installed; no new runtime deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 | `app/manifest.ts`, `viewport`, icon file conventions | Installed [VERIFIED: frontend/package.json] |
| tailwindcss | ^4 | `h-dvh`, `min-h-11`, `@theme` tokens | Installed; v4 native utilities |
| @radix-ui/react-dialog | ^1.1.15 | Focus trap, Escape, scroll lock, aria for More sheet and Modal | Already a dependency, currently unused in `app/` and `components/` [VERIFIED: grep] |
| lucide-react | ^0.553.0 | Nav icons | Verified exports: `Home`, `Package`, `ShoppingBasket`, `Calendar`, `Menu`, `Ellipsis`, `Share`, `PlusSquare`, `UtensilsCrossed`, `Sparkles`, `BarChart3`, `HelpCircle`, `CheckCircle`, `AlertCircle` all resolve [VERIFIED: node require] |
| @tanstack/react-query | ^5.90.8 | Preferences query shared by CurrencyProvider + OnboardingGate | `QueryClientProvider` already mounted in `Providers` |
| framer-motion | ^12 | EmptyState `useReducedMotion()` | Already used |
| sharp | 0.35.5 (transitive, optional dep of next) | One-off icon generation script | Present in node_modules; not added to package.json [VERIFIED] |

### Supporting (new, dev-only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.3 (npm latest, modified 2026-09-30; engines node `^22.12 || ^24 || >=26`) | Unit tests for pure helpers | `formatCurrency`, navigation matching, iOS detection, keyboard-target predicate. `environment: 'node'`; no jsdom or Testing Library needed. CI uses Node 22 so engines are satisfied. [ASSUMED: package legitimacy, slopcheck unavailable] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Dialog for More sheet | Hand-rolled focus trap hook | More code, more a11y bugs. Radix is already installed |
| Radix Dialog | native `<dialog>` + `showModal()` | Native modal gives focus trap, Escape, inert background, but iOS 15.4+ only, animation of backdrop and `dvh` sizing is fiddly, and `<dialog>` backdrop click needs extra code. Radix is the lower-risk path |
| Vitest | Only lint/type-check/build | Currency rounding and nav matching are the highest-regression logic in this phase and are pure; Vitest is cheap. Recommended: **yes** |
| Playwright 375px smoke in CI | Manual checklist | **No** for CI this phase: authenticated pages need backend + Postgres + seeded user; browser download adds ~150-300 MB and minutes to CI; flaky on a side project. Use a documented manual 375/390px checklist and an optional local-only script using system Chrome |

**Installation:**
```bash
cd frontend && npm install -D vitest@5.0.3
```
Add scripts `"test": "vitest run"` and a `frontend` CI step `- run: npm test` after `type-check`.

**Version verification:** `npm view vitest version` returned `5.0.3`; `scripts.postinstall` empty; repo `github.com/vitest-dev/vitest` [VERIFIED: npm registry].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| vitest | npm | multi-year, v5.0.3 | very high (not measured) | github.com/vitest-dev/vitest | unavailable | `[ASSUMED]`: planner adds a `checkpoint:human-verify` before install |
| sharp | npm (transitive via next) | multi-year | very high | github.com/lovell/sharp | n/a, not installed by this phase | Already in lockfile; used by one-off script only |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck could not be installed in this session, so all new packages are `[ASSUMED]`).
**Packages flagged as suspicious [SUS]:** none identified. No postinstall script on vitest.

## Architecture Patterns

### System Architecture Diagram

```
Browser (phone, 375px)                                  Backend (Express/Prisma)
------------------------------------------------        ------------------------------
app/layout.tsx (viewport: cover, appleWebApp)
   |
   v
Providers (QueryClient, Toaster, CurrencyProvider)
   |                 ^
   |                 | useQuery(['preferences']) --GET /users/preferences--> UserPreference row
   v                 |   (currency, budget, dietary, onboardingCompletedAt)
(app)/layout.tsx  ProtectedRoute
   |-- DashboardSidebar  (hidden lg:flex)
   |-- DashboardHeader   (compact h-14 < lg)
   |-- <main pb-[calc(5rem+safe-area)]>  pages -> useCurrency() -> formatCurrency(cents, code)
   |-- BottomNav (lg:hidden, fixed) --More--> MoreSheet (Radix Dialog) --> routes / logout
   |-- OnboardingGate -- null onboardingCompletedAt? --> OnboardingFlow (3 steps)
   |        Finish: PATCH /users/preferences -> POST /pantry (each) -> POST /users/onboarding/complete
   |        Skip:   POST /users/onboarding/complete
   '-- IosInstallHint (iOS Safari && !standalone && !dismissed && !onboarding)

/manifest.webmanifest <- app/manifest.ts      /apple-touch-icon.png, /icons/*.png <- public/
```

### Recommended Project Structure
```
frontend/
├── app/
│   ├── manifest.ts                      # new
│   ├── layout.tsx                       # + viewport, appleWebApp, icons
│   └── globals.css                      # + @theme animations/shadow, safe-area, 16px inputs, reduced motion
├── components/
│   ├── dashboard/{bottom-nav,more-sheet}.tsx   # new
│   ├── pwa/ios-install-hint.tsx
│   └── onboarding/{onboarding-gate,onboarding-flow,step-*.tsx}
├── lib/
│   ├── navigation.ts                    # NAV_PRIMARY, NAV_MORE, isActive()
│   ├── currency/{currencies,format,currency-provider}.ts(x)
│   └── pwa/{detect-ios,storage}.ts      # pure + try/catch wrappers
├── scripts/generate-icons.mjs           # one-off, uses transitive sharp
├── public/{apple-touch-icon.png,icons/*.png}
└── vitest.config.ts, lib/**/*.test.ts
backend/
├── prisma/migrations/2026101000xxxx_user_onboarding/migration.sql
├── src/constants/currencies.ts          # SUPPORTED_CURRENCIES
└── src/modules/users/{users.validation,users.service,users.controller,users.routes}.ts
```

### Pattern 1: Tailwind 4 theme tokens (REQUIRED fix, Wave 0)
**What:** `tailwind.config.ts` is ignored (no `@config`), so define custom tokens in CSS.
```css
/* app/globals.css  [Tailwind 4 @theme idiom] */
@theme {
  --animate-fade-in: fadeIn 0.3s ease-in-out;
  --animate-slide-up: slideUp 0.3s ease-out;
  --shadow-soft: 0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04);
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
}
```
Note `animate-fadeIn`/`animate-slideInRight` hand-written classes already exist in `globals.css` (used by notification-panel); keep them. Verify after `next build` that `.next/static/chunks/*.css` contains `slide-up`. The UI spec's `text-sm`=14px/`text-base`=16px match Tailwind defaults, so the custom fontSize block does not matter. Do not use `18/88/128` spacing.

### Pattern 2: Shared nav config + active matching
```ts
// lib/navigation.ts
export const NAV_PRIMARY = [
  { label: 'Home', href: '/dashboard', icon: Home, match: 'exact' },
  { label: 'Pantry', href: '/pantry', icon: Package },
  { label: 'Meals', href: '/mealplans', icon: Calendar },
  { label: 'Shopping', href: '/shopping', icon: ShoppingBasket },
] as const;
export function isActive(pathname: string | null, href: string, exact = false) {
  if (!pathname) return false;
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}
```
Sidebar keeps its own 8-item list for `lg` (labels "Dashboard", "Meal Plans", "Shopping Lists" differ from bottom-nav labels); derive from the same hrefs so there is one route truth. Sidebar currently lacks Alerts/Profile/Help links (Help only via "Learn More").

### Pattern 3: More sheet with Radix Dialog
```tsx
// Source: Radix Dialog (installed 1.1.15); API: Root/Portal/Overlay/Content/Title/Close
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-900/50" />
    <Dialog.Content aria-describedby={undefined}
      className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-safe animate-slide-up">
      <Dialog.Title className="text-xl font-semibold px-4 py-4">More</Dialog.Title>
      ...rows (Link onClick -> setOpen(false)), Dialog.Close X
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```
Radix returns focus to the trigger (the More button) on close and traps Tab; Escape is handled. Keep `Modal`'s public props (`isOpen,onClose,title,size,children`) and reimplement internals on Radix, so all 12 Modal callers are untouched. Active-route `usePathname()` change should close the sheet (also close in each link `onClick`).

### Pattern 4: Hide bottom nav while typing
```ts
// lib/dom/is-text-entry.ts (pure, testable with a stub object)
export function isTextEntry(el: { tagName?: string; type?: string } | null) {
  if (!el?.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !['checkbox','radio','button','submit','range','file'].includes((el.type ?? 'text').toLowerCase());
}
```
In `BottomNav`: `useEffect` registers `focusin` -> `setHidden(isTextEntry(e.target))` and `focusout` -> `setHidden(false)` (focusout with a next focus target in another input fires focusout then focusin, so the flicker is one frame; defer the false with `requestAnimationFrame` or check `e.relatedTarget`). Render with `hidden` class (display none) so it leaves the a11y tree.

### Pattern 5: Currency
```ts
// lib/currency/format.ts
export const DEFAULT_CURRENCY = 'PHP';
export function formatCurrency(cents: number, currency: string = DEFAULT_CURRENCY, locale?: string): string {
  const code = isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY; // Intl throws RangeError on bad codes
  const nf = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
  const { maximumFractionDigits } = nf.resolvedOptions();
  return nf.format(Math.round(cents) / 100); // Intl rounds to maximumFractionDigits for JPY
}
export function formatCurrencyCompact(cents: number, currency = DEFAULT_CURRENCY, locale?: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100);
}
export function currencySymbol(code: string, locale = 'en') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0).find(p => p.type === 'currency')?.value ?? code;
}
```
Verified output (Node 24, `undefined` locale): PHP `₱1,234.50` (2/2 digits), JPY `¥1,235` (0/0), KRW `₩1,235`, IDR `IDR 1,234.50` (2/2; CLDR standard digits), USD `$1,234.50`, EUR `€1,234.50`; compact PHP 12500 -> `₱13K`; `narrowSymbol` in `en-US` gives `₱`, `¥`, `₩`, `Rp`. Default `locale` to `undefined` is risky for SSR/hydration mismatches (server locale vs browser locale): since pages are `'use client'` but still SSR-rendered, **pin `locale` to `'en-PH'` or `'en-US'`** for deterministic output (recommend `'en-US'`; PHP then renders `₱` too). `[ASSUMED]` that `en-PH` formats identically.

Provider: `useQuery({ queryKey: ['preferences'], queryFn: () => apiClient.get('/api/v1/users/preferences'), enabled: isAuthenticated, staleTime: 5*60_000 })`. `useCurrency()` returns `{ currency, format: (cents) => formatCurrency(cents, currency), compact }`. `PreferencesSettings` on save must `queryClient.setQueryData(['preferences'], …)` so the shell updates immediately. Mount `CurrencyProvider` inside `Providers` (inside `QueryClientProvider`); it must tolerate unauthenticated state (falls back to `PHP`). `apiClient.get` already returns unwrapped data (see `preferences-settings.tsx` line 66).

Chart components (`components/analytics/*`) receive values in major units (`value` already divided by 100); they define local `formatCurrency = (value) => \`₱${value.toFixed(0)}\``. Convert by calling `useCurrency().format(Math.round(value*100))` and `compact` for axes. Inputs: sliders in `preferences-settings`, `ai-meal-plan-modal`, `ai-substitution-modal` display `₱{x}` labels and min/max labels (`₱100`, `₱10,000`): replace with `format()`. Hard min/max (₱100..₱10,000) are PHP-centric; for JPY/KRW/IDR a 10,000-unit ceiling is far too low. Recommendation: scale slider bounds by a per-currency factor or switch to a numeric input (see Open Questions).

### Anti-Patterns to Avoid
- **Relying on `tailwind.config.ts`:** it is not loaded; use `@theme`.
- **`maximum-scale=1`/`user-scalable=no`:** accessibility failure; 16px inputs instead.
- **Hiding the bar by viewport height:** breaks landscape phones; use focus events only.
- **Putting a hard-coded currency list in three places:** one `currencies.ts` per package (frontend, backend) and a test asserting both contain the same codes.
- **Mutating state:** project rule is immutability; store updates must create new objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog focus trap / Escape / scroll lock / aria | Custom `useFocusTrap` | `@radix-ui/react-dialog` (installed) | Handles iOS scroll lock, focus return, `aria-modal` |
| Currency symbols, fraction digits | Per-currency table | `Intl.NumberFormat` + `resolvedOptions()` | Verified: JPY/KRW 0 digits |
| PNG icons | Hand-drawn canvas code / new dep | Existing `sharp` in `node_modules`, run once, commit PNGs | Zero new deps |
| Manifest JSON | Static JSON file | `app/manifest.ts` typed `MetadataRoute.Manifest` | Typed, served as `/manifest.webmanifest` |
| Preferences fetch/cache | New Zustand store | React Query `['preferences']` | Provider already mounted |
| Install prompt on Android | `beforeinstallprompt` UI | Deferred (v2 OFF-03) | Out of scope; Next docs also advise against it |

## Runtime State Inventory

> Not a rename/refactor phase. However the `₱` to currency change and the additive column do touch stored data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `user_preferences.currency` already exists (default `PHP`); `budget_per_week_cents` default `10000` (₱100). Existing rows may hold any 3-letter string (old validation was length-3 only). | Frontend must fall back to `PHP` for unsupported codes and show the stored value in the picker. Data migration: only the new `onboarding_completed_at` backfill. No amount conversion. |
| Live service config | None. Verified: no external config references `₱`. | None |
| OS-registered state | None | None |
| Secrets/env vars | None new | None |
| Build artifacts | Stale `.next/` locally only; Vercel rebuilds | None |

## Common Pitfalls

### Pitfall 1: Tailwind 4 ignores `tailwind.config.ts`
**What goes wrong:** `animate-slide-up`, `animate-fade-in`, `shadow-soft` render nothing; sheets pop with no animation; spec classes silently missing.
**Why:** v4 needs an explicit `@config "../tailwind.config.ts"`; `globals.css` has only `@import "tailwindcss"` and `@theme`. [VERIFIED: built CSS has no `slide-up`] [CITED: Tailwind v4 upgrade guide — JS config not auto-detected; MEDIUM]
**Avoid:** Define tokens in `@theme` (Pattern 1) and check built CSS.
**Warning signs:** class present in markup, absent in `.next/static/chunks/*.css`.

### Pitfall 2: Spec says `pcs`; backend enum says `pieces`
Onboarding quick-add must send `unit: 'pieces'` (backend `PantryUnit.PIECES`; frontend type `PantryItemUnit` includes `'pieces'`). `lib/constants/units.ts` has a different, divergent list (`piece`, `cup`) that does not match the API; do not use it for onboarding. Categories must be one of `protein|vegetable|fruit|dairy|grains|spices|other` (e.g. Rice grains, Eggs protein, Milk dairy, Onions vegetable, Garlic vegetable, Cooking oil other, Soy sauce spices, Chicken protein, Bread grains, Canned tuna protein).

### Pitfall 3: Dietary value formats are inconsistent
`preferences-settings.tsx` uses `gluten_free` (underscore); `lib/constants/categories.ts` `DIETARY_RESTRICTIONS` uses `gluten-free`. Backend `dietary-filter.ts` normalises via `canonKey` (`[_\s-]+` -> `-`), so both work. Per locked decision, store the underscore values from `DIETARY_OPTIONS` in `preferences-settings.tsx`; extract that array to a shared constant and import it in both Settings and onboarding.

### Pitfall 4: Three AI modals bypass `ui/Modal` and use `90vh`
`ai-recipe-suggestions-modal.tsx:84`, `ai-meal-plan-modal.tsx:158`, `ai-substitution-modal.tsx:102` have `max-h-[90vh]` and hand-rolled overlays (no Escape, no focus trap). The UI spec's dvh table lists only `ui/modal.tsx`. Replace all four with `90dvh`; preferably migrate the AI modals onto `ui/Modal` (they also carry `₱` literals).

### Pitfall 5: `viewport` export in a client component
`viewport` is Server Components only [CITED: nextjs.org generate-viewport]. `app/layout.tsx` is a server component today (no `'use client'`); keep it so. Put `appleWebApp` and `icons` in `metadata`, `themeColor`/`viewportFit` in `viewport`.

### Pitfall 6: `manifest.ts` is cached/static and must be public
`manifest.ts` is a Route Handler cached by default [CITED: manifest docs]. Auth is client-side localStorage with no middleware/proxy file (verified: no `middleware.ts`/`proxy.ts`), so `/manifest.webmanifest` is publicly fetchable. Do not add auth middleware later without excluding it.

### Pitfall 7: `Intl` throws on invalid currency code
`new Intl.NumberFormat(_, {style:'currency', currency:'XXXX'})` throws `RangeError`; a legacy DB row with a bad code would white-screen the dashboard via ErrorBoundary. Guard with allow-list + try/catch fallback.

### Pitfall 8: Existing Button `size="sm"` is `text-xs` / `h-9`
Contract wants `h-11 lg:h-9 text-sm`. Touching it changes every `sm` button site-wide (acceptable, intended). Header search `input` (`dashboard-header.tsx`) is `text-sm` raw input: removed below `lg`.

### Pitfall 9: ProtectedRoute shows `h-screen` loader for ≥100ms
The auth check uses a 100ms `setTimeout`; the loader (`h-screen` -> `h-dvh`) is shown first on every full load. Not a phase blocker; keep. Onboarding gate and iOS hint must render only after `ProtectedRoute` resolves (they are children of it).

### Pitfall 10: Toasts overlap the bottom bar
`Toaster position="top-right"` in `providers.tsx`. Top-right is fine (does not collide with the bottom bar) but the compact header is now `h-14`, and the toast container ignores safe-area-top. Add `containerStyle={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}`. The spec's bottom offset for toasts is unnecessary if toasts stay at the top; recommend keeping top (no change to behaviour).

### Pitfall 11: iPadOS Safari reports as Mac
Use `navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1` in addition to the iPhone/iPad/iPod UA test; exclude `CriOS|FxiOS|EdgiOS|OPiOS` and in-app webviews (`FBAN|FBAV|Instagram|Line|MicroMessenger`). `[ASSUMED]` list of in-app tokens; any false positive just shows a hint with wrong instructions, low risk. Standalone: `(navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches`. localStorage access can throw in iOS Private mode: wrap reads and writes.

### Pitfall 12: Migration backfill must run in the same migration, before the app expects semantics
The entrypoint runs `prisma migrate deploy` before `node dist/index.js`, so column + backfill land atomically before the new code serves traffic; old code (still running during a Railway deploy) ignores the new nullable column. Frontend deploys independently via Vercel, so **the frontend must treat a missing `onboardingCompletedAt` field in the API response (old backend) as "unknown, do not show onboarding"** (fail open). Deploy backend first.

## Code Examples

### app/manifest.ts
```ts
// Source: nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest (v16.4.0)
import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard', name: 'Kitcha', short_name: 'Kitcha',
    description: 'Plan meals, track groceries, and manage your budget with ease',
    start_url: '/dashboard', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#ffffff', theme_color: '#0ea5e9', lang: 'en',
    categories: ['food', 'lifestyle', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```
`start_url: '/dashboard'` with client-side auth: unauthenticated launches go dashboard -> ProtectedRoute -> `/login`. Acceptable.

### app/layout.tsx additions
```ts
import type { Metadata, Viewport } from 'next';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };
export const metadata: Metadata = {
  /* existing */ appleWebApp: { capable: true, title: 'Kitcha', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/kitcha-logo.svg', type: 'image/svg+xml' }, { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
};
```
Remove the hand-written `<link rel="icon">` in `<head>` (duplicate of metadata.icons). Note `app/favicon.ico` already exists (4 sizes, auto-linked by Next); keep. Do NOT also add `app/apple-icon.png`, to avoid duplicate apple-touch-icon tags: choose either public file + `metadata.icons.apple` or the `app/apple-icon.png` convention. **Recommend `app/apple-icon.png` and `app/icon.png`?** No: keep static `public/` files referenced explicitly (manifest needs stable `/icons/*.png` URLs anyway, whereas file-convention URLs get hashed query strings).

### Icon script (one-off; run `node scripts/generate-icons.mjs`)
```js
// sharp resolved from frontend/node_modules (transitive via next). Input: public/kitcha-logo.svg (500x500, fill #0ea5e9)
import sharp from 'sharp';
const svg = await readFile('public/kitcha-logo.svg', 'utf8');
const whiteMark = Buffer.from(svg.replaceAll('#0ea5e9', '#ffffff'));
// any: mark on white at 70%
const mark = (buf, px) => sharp(buf, { density: 400 }).resize(px, px).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ffffff' } })
  .composite([{ input: await mark(Buffer.from(svg), 358), gravity: 'centre' }]).png().toFile('public/icons/icon-512.png');
// maskable: #0ea5e9 full-bleed, white mark within 60% of width; apple-touch: 180px, mark 62%, flatten({background:'#0ea5e9'}) to guarantee opacity
```
The logo is a square viewBox (375x375), so scaling by percentage is safe. Verified that `sharp` rasterises this SVG (192px PNG, 6.9 KB) [VERIFIED: local run]. Add `import { createRequire }` fallback is unnecessary since `frontend/scripts/*.mjs` resolves `sharp` from `frontend/node_modules`. `.gitignore` excludes `node_modules` only; PNGs are committed. Sharp is `optional`: do not make CI or build depend on it.

### Backend migration (additive + backfill)
```sql
-- prisma/migrations/<ts>_user_onboarding/migration.sql
ALTER TABLE "user_preferences" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Existing users who already use the app are treated as onboarded
UPDATE "user_preferences" up
SET "onboarding_completed_at" = NOW()
WHERE EXISTS (SELECT 1 FROM "pantry_items" p WHERE p."user_id" = up."user_id")
   OR up."currency" <> 'PHP'
   OR up."budget_per_week_cents" <> 10000
   OR cardinality(up."dietary_restrictions") > 0;
```
Schema: `onboardingCompletedAt DateTime? @map("onboarding_completed_at")`. Include soft-deleted pantry items in the `EXISTS` (no `deleted_at` filter) since the user did use the app. `npx prisma migrate dev --create-only` then hand-append the UPDATE (use `--create-only` so Prisma generates the ALTER). Note schema default `budget_per_week_cents` is `10000`, while the frontend form default is `200000`: "non-default" means differing from the **DB** default. Risk: an existing user with all-default preferences and no pantry items sees the onboarding once (acceptable per CONTEXT; `Skip setup` stores the flag). Alternative stricter backfill: also mark everyone whose `updated_at > created_at`, or simply all pre-existing rows; see Open Questions.

### Backend endpoint + validation (express-validator, not zod)
```ts
// src/constants/currencies.ts
export const SUPPORTED_CURRENCIES = ['PHP','USD','EUR','GBP','SGD','JPY','AUD','CAD','HKD','INR','KRW','MYR','THB','IDR','NZD','AED'] as const;

// users.validation.ts
body('currency').optional().isString().customSanitizer((v: string) => v.toUpperCase())
  .isIn(SUPPORTED_CURRENCIES).withMessage(`Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`),

// users.service.ts
async completeOnboarding(userId: string) {
  // idempotent: only set if still null
  await prisma.userPreference.updateMany({ where: { userId, onboardingCompletedAt: null }, data: { onboardingCompletedAt: new Date() } });
  return this.getPreferences(userId);
}
// users.routes.ts
router.post('/onboarding/complete', asyncHandler(usersController.completeOnboarding.bind(usersController)));
```
`updatePreferences` in the service whitelists fields explicitly, so a client cannot set `onboardingCompletedAt` through PATCH; keep it that way. Add `onboardingCompletedAt: Date | null` to `UserPreferencesResponse` (`backend/src/types/user.types.ts`). Existing `users.test.ts` patterns (supertest + real DB signup) apply: add tests for (a) new user has `onboardingCompletedAt: null`, (b) `POST /onboarding/complete` sets and is idempotent (timestamp unchanged on second call), (c) PATCH rejects `currency: 'XXX'` and `'ZZZ'` but accepts `'jpy'` -> `'JPY'`, (d) PATCH ignores `onboardingCompletedAt`. Backfill SQL can be tested by one Jest test that inserts a user with a pantry item before... not possible after migration; instead verify manually on a copy (`psql`) and document.

Existing-validation caveat: `body('currency').isLength({min:3,max:3})` currently accepts `abc`; tightening is backward compatible for the UI because the UI only sends supported codes.

### Currency literal map (every location; 27 lines + 2 'PHP')
| File | Lines | Change |
|------|-------|--------|
| `app/(app)/shopping/page.tsx` | 79 (`formatCost`) | use `useCurrency().format` |
| `app/(app)/dashboard/page.tsx` | 50-52 | local `formatCurrency` -> hook |
| `app/(app)/analytics/page.tsx` | 97-99 | same |
| `app/(app)/budget/page.tsx` | 37-39 | same |
| `app/(app)/mealplans/page.tsx` | 126 | `Estimated: ${format(...)}` |
| `app/(app)/help/page.tsx` | 93 | FAQ text "₱100 to ₱10,000": make generic ("set your weekly budget in Settings > Preferences") or render with the formatter |
| `components/settings/preferences-settings.tsx` | 14 (zod message "at least ₱1"), 49 (comment), 50/69 (`'PHP'` fallbacks), 139, 150-151; add currency `<select>` + helper text | use `DEFAULT_CURRENCY`; message generic |
| `components/ai/ai-substitution-modal.tsx` | 35 (comment), 126, 138-139 | hook |
| `components/ai/ai-meal-plan-modal.tsx` | 72 (comment), 197, 208-209, 268, 346 | hook |
| `components/analytics/category-spending-chart.tsx` | 31, 111 | hook (major units -> cents) |
| `components/analytics/weekly-comparison-chart.tsx` | 26, 35, 95, 101, 107 | hook; axis uses compact |
| `components/analytics/spending-trends-chart.tsx` | 21, 30 | hook |
| `components/mealplans/meal-plan-detail-modal.tsx` | 24, 151 | hook |
| `components/mealplans/meal-plan-card.tsx` | 22 | hook |
| `backend/prisma/schema.prisma` | 88 (comment `// ₱100`) | comment only; leave |
Verification: `grep -rn "₱" frontend/app frontend/components` returns zero, `grep -rn "'PHP'" frontend/app frontend/components` returns zero (only `lib/currency/` may contain `'PHP'`). Two comment-only hits (`// ₱2000`, `// ₱500 default`) must be reworded or the grep gate will fail.

### h-screen / vh map (complete)
`h-screen`/`min-h-screen` (7, matches spec): `app/(app)/layout.tsx:17`, `app/page.tsx:15`, `app/(auth)/signup/page.tsx:26`, `app/(auth)/login/page.tsx:26`, `components/auth/protected-route.tsx:38`, `components/common/error-boundary.tsx:37`, `components/common/loading-spinner.tsx:43`. `vh` (4, **spec lists only 1**): `components/ui/modal.tsx:46` (`90vh` + `sm:85vh`), `components/ai/ai-substitution-modal.tsx:102`, `ai-meal-plan-modal.tsx:158`, `ai-recipe-suggestions-modal.tsx:84`. No `100vh` or `w-screen` elsewhere.

### File-by-file change list (concise)
- `app/layout.tsx`: viewport, appleWebApp, icons; drop manual icon link.
- `app/(app)/layout.tsx`: remove `sidebarOpen` state; `h-dvh`; `main` padding class; mount `BottomNav`, `OnboardingGate`, `IosInstallHint`, skip-link, `<main id="main">`.
- `components/dashboard/dashboard-sidebar.tsx`: drop props `isOpen/onClose`, drawer, backdrop, X; `hidden lg:flex lg:w-64`.
- `components/dashboard/dashboard-header.tsx`: drop `onMenuClick`/hamburger; `h-14 lg:h-16`, `pt-safe`; avatar menu `hidden lg:block`; search `hidden lg:block`; extract `handleLogout` into `lib/auth/logout.ts` or a hook shared with MoreSheet.
- `components/notifications/notification-bell.tsx`: `min-h-11 min-w-11`, badge `text-sm`? (badge is 20px `text-xs` bold; spec forbids 12px, use `text-sm` with `h-5 min-w-5`); share unread count with the More-tab dot (lift into React Query `['notification-stats']` with `refetchInterval: 30000` so there is one poll, not two).
- `components/notifications/notification-panel.tsx:130`: add safe-area padding, 44px buttons.
- `components/ui/{button,input,select,modal}.tsx`, `components/common/empty-state.tsx`: per spec; `Input`/`Select` add `aria-invalid`, `aria-describedby`, `role="alert"`.
- Empty states: `pantry/page.tsx:169`, `recipes/page.tsx:180`, `mealplans/page.tsx:163`, `shopping/page.tsx:199`, `alerts/page.tsx:18`. `budget/page.tsx:165` and `profile/page.tsx:56` also use the same `p-12` Card but are not in the spec list; leave unless trivial. EmptyState is currently imported **nowhere** (verified grep: only its own file).
- `recipes/page.tsx`: `useSearchParams` for `?ai=suggestions` -> must be wrapped in `<Suspense>` for production build (Next requires a Suspense boundary around `useSearchParams` in statically prerendered client pages; missing it fails `next build` with "Missing Suspense boundary with useSearchParams"). `[CITED: Next.js docs behaviour; MEDIUM]` Then `router.replace('/recipes')`.
- Auth pages: `login/page.tsx:26`, `signup/page.tsx:26` `min-h-dvh`; left brand panel is inside `lg:` (verify classes `hidden lg:flex`-style; `p-12` at line 60 is inside the brand panel).
- `globals.css`: `@theme` tokens (Pattern 1), `.pb-safe`/`.pt-safe`, 16px input media query, `touch-action: manipulation`, reduced-motion block.
- `components/providers.tsx`: `CurrencyProvider`, Toaster safe-area offset.
- Per-page 375px review items: dashboard grid, pantry/recipes chips, mealplan-card action row (`text-xs` buttons), settings/help `lg:grid-cols-4` collapse, charts `height` 240 below `sm` (needs a small `useMediaQuery`/CSS approach: recharts `height` is a prop; use a `h-60 sm:h-[300px]` wrapper div with `ResponsiveContainer height="100%"`), add/edit-recipe-modal ingredient grid (7 raw inputs each).

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `100vh` / `h-screen` | `100dvh` / `h-dvh` (Tailwind 4 native) | Fixes iOS toolbar clipping |
| `tailwind.config.js` auto-load | `@theme` in CSS (or explicit `@config`) | Custom animations currently dead |
| `next-pwa` | Native `app/manifest.ts` (+ Serwist in v2 OFF phase) | Out of this phase |
| `viewport` inside `metadata` | Separate `viewport` export (since Next 14) | Required for `viewportFit` |
| iOS install prompt via script | Instructions UI only; `beforeinstallprompt` not on Safari | Matches decision |

**Deprecated/outdated:** `lib/constants/units.ts` unit values (`piece`, `cup`, `fl-oz`) do not match the API enum; do not reuse for onboarding.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vitest@5.0.3` is legitimate (slopcheck could not run) | Standard Stack | Low; widely used. Planner gates install behind `checkpoint:human-verify` |
| A2 | Pinning formatter locale to `en-US`/`en-PH` gives the same symbols as `undefined` locale | Pattern 5 | Cosmetic differences only |
| A3 | Tailwind 4 requires `@config` for JS config (docs not re-fetched; supported by local build evidence) | Pitfall 1 | If wrong, spec classes would already work; verify with built CSS grep |
| A4 | `useSearchParams` without Suspense fails the production build in this setup | File list | Build fails; trivial fix by wrapping in Suspense |
| A5 | iOS in-app-browser UA token list | Pitfall 11 | Hint shown in wrong browsers; low |
| A6 | Backfill rule (pantry items OR non-default prefs) is acceptable vs "mark all existing users complete" | Migration | Some existing users see onboarding once; skippable |
| A7 | Radix Dialog behaves correctly under iOS Safari with `dvh` sheets (needs real-device check) | Pattern 3 | Scroll-lock glitches; verify on iPhone |

## Open Questions (RESOLVED)

> All four were resolved by the orchestrator on 2026-10-09; see 03-CONTEXT.md "Resolved research questions".

1. **Backfill breadth**
   - RESOLVED (03-CONTEXT.md, Resolved research questions): mark complete for users with any pantry item (incl. soft-deleted), non-default preferences (PHP / 10000 cents), or preferences ever updated; everyone else sees onboarding once, skippable. Implemented in 03-02.
   - Known: CONTEXT permits "pantry items or non-default preferences" or a skippable prompt.
   - Unclear: should every pre-existing user (this is a personal side project, few users) simply be marked complete?
   - Recommendation: use the specified rule; additionally treat `user_preferences.created_at < migration time` AND `updated_at > created_at` as completed. Confirm with user only if they have real users beyond themselves.
2. **Budget slider range for non-PHP currencies**
   - RESOLVED (03-CONTEXT.md): numeric input in major units (min 1, sensible max) replaces PHP-scaled sliders in Settings and the AI modals; amounts stay value x 100. Implemented in 03-06 and 03-10.
   - ₱100-₱10,000 slider is meaningless for JPY/KRW/IDR (10,000 JPY ≈ ₱3,800 but 10,000 IDR ≈ ₱35).
   - Recommendation: switch the Settings budget control to a numeric `inputMode="decimal"` field (as onboarding already specifies) and keep the slider only for the AI modals with bounds scaled by a per-currency multiplier table `{ JPY: 50, KRW: 500, IDR: 5000, ... }`; or drop the slider range limits. Decide in planning; flagged as a design call.
3. **Stored amounts after currency change**
   - RESOLVED (03-CONTEXT.md): amounts are NOT converted when currency changes; helper text explains it. Implemented in 03-06.
   - Not converted (locked by spec). Note `budget_per_week_cents` default 10000 means "100.00" in any currency. Document in helper text only.
4. **"AI features" More item** routes to `/recipes?ai=suggestions` per spec: requires recipes page change (Suspense). Alternative of a dedicated page is out of scope.
   - RESOLVED (03-CONTEXT.md): route to `/recipes?ai=suggestions` with `useSearchParams` inside `<Suspense>`, verified by `next build`. Implemented in 03-07.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/tests | yes | v24.9.0 local; CI Node 22 | — |
| sharp (transitive) | icon script | yes | 0.35.5 | commit PNGs; script is one-off |
| ImageMagick / rsvg-convert / PIL | icons | no | — | not needed (sharp) |
| sips / qlmanage (macOS) | alt icon resize | yes | system | not needed |
| Google Chrome | manual 375px/Lighthouse checks | yes (/Applications) | — | DevTools device mode |
| slopcheck | package audit | no | — | all new packages `[ASSUMED]` |
| PostgreSQL (local) | backend Jest | CI provides postgres:16 | — | — |
| Railway CLI | backend deploy | yes (per STACK.md 5.45.10) | — | — |
| Physical iPhone | iOS install/safe-area/keyboard checks | unknown | — | Manual checkpoint; cannot be automated |

**Missing dependencies with no fallback:** a real iOS device for the final standalone/safe-area/keyboard verification (human checkpoint).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | Vitest 5.0.3 (new, node environment, pure helpers only) |
| Frontend config | `frontend/vitest.config.ts` (alias `'@': path.resolve(__dirname, '.')`) — Wave 0 |
| Backend framework | Jest 29 + supertest + real Postgres (existing; `backend/tests/users.test.ts` pattern) |
| Quick run | frontend `npx vitest run`; backend `cd backend && npx jest tests/users.test.ts` |
| Full suite | frontend `npm run lint && npm run type-check && npm test && NEXT_PUBLIC_API_URL=https://x.example npm run build`; backend `npm test -- --ci` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOB-01 | `isActive()` active-tab matching incl. More highlight for `/budget`; nav config has 4 primary + expected More items | unit | `npx vitest run lib/navigation.test.ts` | Wave 0 |
| MOB-01 | `isTextEntry()` hides bar for input/textarea/select, not checkbox/radio | unit | `npx vitest run lib/dom/is-text-entry.test.ts` | Wave 0 |
| MOB-01 | Bottom nav visible `<1024`, sidebar `>=1024`, More sheet traps focus | manual (375px + 1280px, Chrome DevTools) | checklist | manual-only: layout/focus needs a browser; Playwright in CI rejected |
| MOB-02 | No horizontal scroll / 44px targets / 16px inputs | manual DevTools snippet: `document.documentElement.scrollWidth <= innerWidth`, and a console script listing `button,a,input,select` with height <44 | checklist script in 03-VERIFICATION | manual-only |
| MOB-02 | Raw inputs ≥16px below lg | static grep + CSS rule presence | `grep -n "max-width: 1023px" frontend/app/globals.css` | Wave 0 |
| MOB-03 | Zero `h-screen`/`min-h-screen`/`[0-9]vh` | static | `! grep -rnE "h-screen\|min-h-screen\|[0-9]vh" frontend/app frontend/components` | n/a |
| MOB-04 | `/manifest.webmanifest` generated with 3 icons; PNG sizes (192/512/180) and 180px opaque | build + script | `npm run build` then `ls .next/server/app/manifest.webmanifest.body`; `node -e` with sharp `metadata()` asserting sizes/`hasAlpha` | Wave 0 (script) |
| MOB-04 | iOS detection logic (iPhone Safari yes; CriOS no; iPadOS MacIntel+touch yes; standalone no) | unit | `npx vitest run lib/pwa/detect-ios.test.ts` | Wave 0 |
| MOB-04 | Hint dismissal survives throwing localStorage | unit (stub storage that throws) | `npx vitest run lib/pwa/storage.test.ts` | Wave 0 |
| MOB-05 | `onboardingCompletedAt` null for new user; complete endpoint idempotent; PATCH cannot set it | backend integration | `cd backend && npx jest tests/users.test.ts -t onboarding` | Wave 0 (extend existing file) |
| MOB-05 | Backfill SQL marks users with pantry/non-default prefs | manual SQL check on disposable DB | psql script in plan | manual-only |
| MOB-05 | Empty states render on 5 list screens | manual + `grep -rln "EmptyState" frontend/app` shows ≥5 | static | n/a |
| MOB-06 | `formatCurrency`: PHP 2 digits, JPY 0 digits, invalid code falls back to PHP, compact notation, symbol derivation | unit | `npx vitest run lib/currency` | Wave 0 |
| MOB-06 | Backend rejects unsupported currency, uppercases `jpy` | backend integration | `npx jest tests/users.test.ts -t currency` | Wave 0 |
| MOB-06 | Frontend and backend currency lists identical | unit (reads backend constants file path via fs in Vitest) | `npx vitest run lib/currency/parity.test.ts` | Wave 0 |
| MOB-06 | Zero `₱` / `'PHP'` literals outside `lib/currency` | static | `! grep -rn "₱\|'PHP'" frontend/app frontend/components` | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run` + `npm run type-check` (frontend), `npx jest tests/users.test.ts` (backend tasks).
- **Per wave merge:** lint + type-check + vitest + production build; backend full suite.
- **Phase gate:** CI green; manual 375px/390px/1280px checklist across the 13 pages; one real-iPhone pass (install via Share, standalone launch, safe-area, keyboard hides bar, More sheet focus).

### Wave 0 Gaps
- [ ] `frontend/vitest.config.ts`, `package.json` `test` script, CI step in `.github/workflows/ci.yml` frontend job.
- [ ] `lib/currency/*.test.ts`, `lib/navigation.test.ts`, `lib/dom/is-text-entry.test.ts`, `lib/pwa/*.test.ts` (written RED first per project TDD rule).
- [ ] Backend tests added to `backend/tests/users.test.ts` for onboarding + currency.
- [ ] `@theme` token fix verified in built CSS.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | existing JWT; onboarding endpoint sits behind `authenticate` (router-level) |
| V3 Session Management | no | localStorage Bearer token unchanged; do not add cookies |
| V4 Access Control | yes | New endpoint acts only on `req.user.userId`; no id parameter, so no IDOR |
| V5 Input Validation | yes | express-validator `isIn(SUPPORTED_CURRENCIES)` + uppercase sanitizer; service whitelists writable fields; pantry quick-add uses fixed enums; item name length-limited by existing pantry validation |
| V6 Cryptography | no | — |
| V12/V13 Files & API | low | `manifest.webmanifest` and icons are public static |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass assignment of `onboardingCompletedAt` via PATCH | Tampering | Explicit field whitelist in `updatePreferences` (already so); dedicated endpoint stamps server time |
| Invalid currency string causing `Intl` RangeError (client DoS of own UI) | Denial of service | Allow-list server-side and guard on client |
| XSS via pantry item names added in onboarding | Tampering | React escapes; no `dangerouslySetInnerHTML` |
| localStorage throwing (Safari private mode) | Availability | try/catch wrappers |
| Rate limiting on new endpoint | DoS | Covered by existing global limiter (rate-limiter tests exist); verify the users router is under it |

## Sources

### Primary (HIGH confidence)
- nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest (v16.4.0, updated 2026-03-03): `manifest.ts`, `MetadataRoute.Manifest`, cached route handler.
- nextjs.org/docs/app/api-reference/functions/generate-viewport (v16.4.0): `viewport` export is Server Components only; fields.
- nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons: `favicon.ico`, `icon`, `apple-icon` conventions; `icon.tsx` + `ImageResponse` option.
- nextjs.org/docs/app/guides/progressive-web-apps (v16.4.0): manifest guide, iOS install-prompt example, `beforeinstallprompt` not recommended / not on Safari iOS.
- Codebase: files named above, `backend/prisma/schema.prisma`, `backend/src/modules/users/*`, `.github/workflows/ci.yml`, `frontend/package.json`.
- Local runs: `Intl.NumberFormat` digit behaviour (Node 24.9), `sharp` SVG rasterisation, lucide export checks.

### Secondary (MEDIUM)
- `.planning/research/PITFALLS.md` (iOS safe-area, `viewport-fit`, 16px inputs).
- `npm view vitest` metadata.

### Tertiary (LOW)
- iOS in-app browser UA token list, Tailwind v4 `@config` statement (training knowledge plus local build evidence).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new runtime deps; only Vitest is new and tagged `[ASSUMED]`.
- Architecture: HIGH, based on direct reading of every touched file.
- Pitfalls: MEDIUM-HIGH, Tailwind `@config` finding is evidence-backed but should be confirmed by a build in Wave 0; iOS runtime behaviour needs a device.

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (stable stack; Next 16.x minor releases are the main drift risk)
