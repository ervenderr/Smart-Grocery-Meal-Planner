---
phase: 11
slug: offline-core
status: approved
reviewed_at: 2026-10-11
shadcn_initialized: false
preset: none
created: 2026-10-11
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the offline status surfaces: connectivity/pending indicator, Pending changes sheet, failure/conflict messaging. Scope is limited to OFF-05 (status UI) plus the user-visible outcomes of OFF-03/OFF-04. No new screens beyond one sheet; no redesign of existing pages. Sources: 11-CONTEXT.md (decisions), existing frontend code (`components/ui/modal.tsx`, `components/ui/button.tsx`, `components/dashboard/bottom-nav.tsx`, `components/common/empty-state.tsx`, `app/globals.css`, `components/platform/native-shell.tsx`).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (not a shadcn project; no `components.json`). Existing in-repo components are the system. |
| Preset | not applicable |
| Component library | Radix primitives (`@radix-ui/react-dialog` via `components/ui/modal.tsx`), in-repo `Button` (variants incl. `primary`, `danger`), `EmptyState`, `react-hot-toast` for transient toasts |
| Icon library | `lucide-react` (use `WifiOff`, `CloudUpload`, `RefreshCw`, `AlertTriangle`, `Check`, `Trash2`) |
| Font | Inter via `var(--font-inter)`, system-ui fallback (already global) |

Reuse rules: the Pending changes sheet MUST use the existing `Modal` (bottom sheet below `sm`, centered from `sm`, safe-area bottom padding, 44px close target). Do not add a new dialog or sheet library. Light mode only (dark mode is globally forced off).

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gap inside indicator pill, badge inner padding |
| sm | 8px | Pill padding, gap between row meta lines |
| md | 16px | Sheet row padding, sheet horizontal padding, banner horizontal padding |
| lg | 24px | Gap between sheet sections (Needs attention / Waiting to sync) |
| xl | 32px | Empty-state vertical padding |
| 2xl | 48px | not used this phase |
| 3xl | 64px | not used this phase |

Exceptions: interactive targets (indicator pill hit area, Retry, Discard, row actions) have min height/width 44px via the existing `.touch-target` class (visual pill may be smaller, 32px high, with the 44px hit area extended). Bottom nav is 64px (existing `h-16`); the offline banner sits above it and never overlaps it.

---

## Typography

Up to 4 sizes, 2 weights, reusing the existing Tailwind scale.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label (indicator text, badges, row meta, timestamps) | 12px (`text-xs`) | 600 | 1.33 (16px) |
| Body (row descriptions, banner text, button text 14px) | 14px (`text-sm`) | 400 (600 for button/emphasis) | 1.43 (20px) |
| Heading (sheet title via `Modal`, section headings) | 20px (`text-xl`) | 600 | 1.4 (28px) |
| Display | not used this phase | n/a | n/a |

Weights: regular 400 and semibold 600 only. Inputs stay at 16px below `lg` (existing global rule); none are added here.

---

## Color

Reuse the existing palette (`primary` sky, gray neutrals, `budget`/`expiry` semantic hues). No new brand colors.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` | Page and sheet background |
| Secondary (30%) | gray-50 `#f9fafb` / gray-100 `#f3f4f6`, border gray-200 `#e5e7eb`, text gray-900/gray-600 | Sheet rows, section headers, synced-state indicator |
| Accent (10%) | primary-500 `#0ea5e9` (text/icon primary-700 `#0369a1` for contrast) | See reserved list below |
| Status: Offline / Pending (warning) | bg amber-100 `#fef3c7`, text amber-900 `#78350f`, icon `#f59e0b` | Offline banner, pending count pill |
| Status: Failed / Destructive | red-500 `#ef4444` (button, existing `danger` variant); bg red-50 `#fef2f2`, text red-800 `#991b1b` | Failed row badge, Discard confirmation, needs-attention count |

Accent reserved for: (1) the "Retry all" / "Retry" primary button in the sheet, (2) the transient "Syncing" spinner/icon in the indicator, (3) focus rings (existing `ring-primary-500`). Accent is NOT used for the offline banner, pending badge, or row backgrounds.

Contrast: all status text/background pairs must meet WCAG AA 4.5:1 (amber-900 on amber-100 and red-800 on red-50 do). State must never be conveyed by color alone: each state has an icon and a text label.

---

## Components and Interaction Contract

### 1. Connectivity / pending indicator (persistent, OFF-05)

- Component: `SyncStatusIndicator` (a button). Placed in `DashboardHeader` trailing area, left of the notifications bell. Visible on every `(app)` route on mobile and desktop. Hidden only when state is `synced` AND no pending/failed ops (see below); when hidden it renders nothing (no layout shift: the header slot is flex-reserved only when visible).
- Shape: pill, 32px high, `rounded-full`, `px-2` (8px), icon 16px + label 12px/600, 4px gap. Hit area 44px.
- States (priority high to low, only one shown):

| State | Condition | Icon | Label | Colors |
|-------|-----------|------|-------|--------|
| attention | any op status `failed` or `conflict` | `AlertTriangle` | `{n} need attention` | red-50 / red-800 |
| syncing | drain worker active | `RefreshCw` (spin, disabled under reduced motion; then static) | `Syncing {n}` | primary-50 / primary-700 |
| offline | no connectivity | `WifiOff` | `Offline` plus ` · {n} pending` when n>0 | amber-100 / amber-900 |
| pending | online, n>0 queued, not draining (backoff wait) | `CloudUpload` | `{n} pending` | amber-100 / amber-900 |
| synced | online, nothing queued | none (hidden) | n/a | n/a |
| just-synced | transition from syncing to synced | `Check` | `All synced` | gray-100 / gray-700, auto-hides after 2s |

- Tap: opens the Pending changes sheet (also when offline with n=0: opens sheet showing the offline explainer + empty state). Native: fires light haptic (existing `lib/native/haptics`).
- A11y: `aria-label` = full sentence (e.g. "Offline, 3 changes waiting to sync. Open pending changes"). State changes announced via a visually hidden `role="status"` `aria-live="polite"` region (not assertive). Count updates debounced 500ms to avoid chatter.

### 2. Offline banner (transient context)

- Component: `OfflineBanner`. Full-width strip fixed above `BottomNav` on mobile (`bottom: calc(64px + env(safe-area-inset-bottom))`), at the top of main content on `lg` (static, not fixed). Height 40px, `px-4`, amber-100 bg, amber-900 14px/400 text with `WifiOff` icon 16px.
- Shows when connectivity is lost for more than 2s (debounce flicker); dismisses itself 1s after connectivity returns (replaced by the syncing indicator). Not user-dismissible; non-blocking (content below it gets matching bottom padding via CSS var `--offline-banner-h`).
- Copy: `You're offline. Changes are saved on this device and will sync later.`
- Slide in/out using existing `animate-slide-up`; instant under `prefers-reduced-motion`.
- Online-only features (AI suggestions, meal plan generation, recipe import, account actions): their entry buttons are `disabled` while offline with an inline helper line under/next to them: `Needs a connection`. Do not hide them.
- Stale data: no per-screen "stale" banner in v1; pages that show cached data while offline rely on the global banner. When a cold-start hydrate completed offline, the indicator shows `Offline` as normal.

### 3. Pending changes sheet

- Opens in the existing `Modal` (title `Pending changes`, size `md`). Scrollable, max 90dvh, safe-area bottom padding (already provided by `Modal`).
- Layout, top to bottom:
  1. Status summary line (14px/400, gray-600): e.g. `Offline. 3 changes will sync when you're back online.` / `Syncing 2 changes...` / `All changes are synced.`
  2. Section `Needs attention` (20px/600 heading, red count badge) listing failed/conflict ops. Hidden when empty.
  3. Section `Waiting to sync` listing queued/in-flight ops, oldest first (matches drain order). Hidden when empty.
  4. Footer actions (sticky bottom within sheet): primary `Retry all` (accent, shown only if any failed or queued-in-backoff and online) and secondary `Discard all failed` (text button, red, only if any failed).
- Row (min height 64px, `px-4 py-3`, divider gray-200): left icon 20px by op type; line 1 14px/600 human description (`Added "Milk" to shopping list`, `Used 2 of "Eggs" in pantry`, `Marked "Pasta night" as cooked`, `Finished shopping trip`); line 2 12px/400 gray-600 relative time (`Saved 5 min ago`) plus status label; for failed rows a third line 12px/400 red-800 with the readable reason. Right side: `Retry` (ghost, 44px) and `Discard` (ghost red, 44px) for failed rows only; queued rows show a gray `Waiting` badge (12px/600) and no actions in v1 except swipe-free `Discard` via row overflow is NOT provided (queued ops cannot be discarded individually; avoids data loss).
- Row status badges (icon + text): `Waiting` (gray), `Syncing` (primary), `Retrying in {s}s` (amber, shows backoff), `Failed` (red), `Conflict` (red).
- Retry: row goes to `Syncing`; on success the row animates out (fade 200ms, reduced-motion: instant) and a haptic success fires on native; on failure it returns to `Failed` with updated reason and attempt count (`Tried {n} times`).
- Discard (single failed op): confirmation inline within the row (no second modal): row swaps to `Discard this change? It won't be saved.` with `Keep` (ghost) and `Discard` (danger). Discard also rolls back the optimistic change in the cache (visible immediately in the underlying list). `Discard all failed` uses a confirm step in the footer: `Discard {n} failed changes? They won't be saved.` with `Keep` and `Discard {n}`.
- Empty state (uses `EmptyState`, icon `Check`, headingLevel `h3`): heading `Nothing waiting`, body `Everything you changed is saved and synced.`; when offline: heading `You're offline`, body `You can keep using Kitcha. New changes will show up here and sync when you're back online.`
- Focus: on open focus moves to the sheet title (Radix default); on closing returns to the indicator.

### 4. Failure and conflict outcomes (mapping from server codes)

Failed ops are parked after definitive failure (409/404/410/422) or after max retry attempts for transient errors; never retried forever. Network errors/timeouts/5xx stay `Waiting` with backoff (not shown as failed). 401 never marks an op failed and never clears the outbox (token refresh on reconnect).

| Server outcome | Row reason copy (12px, red-800 or gray for info) | Actions |
|----------------|--------------------------------------------------|---------|
| 404 / 410 (target deleted elsewhere; delete wins) | `This item was already removed, so the change wasn't applied.` | Discard only (Retry hidden) |
| 409 (conflict, e.g. already cooked/finished) | `This was already updated elsewhere. Your change wasn't applied.` | Retry, Discard |
| 422 (invalid data) | `The server couldn't accept this change. Edit the item and try again.` | Discard only |
| Quantity clamped at 0 (info, not failure) | Toast: `{item} was used up. Quantity set to 0.` | none |
| Cooked-it / finish-trip applied late | Toast on success: `Synced: marked "{recipe}" as cooked.` / `Synced: your shopping trip was recorded.` | none |
| Max attempts exceeded (transient) | `Couldn't reach the server after {n} tries. Check your connection and retry.` | Retry, Discard |

Toasts reuse the existing `react-hot-toast` setup (top, safe-area offset, 4s default, 5s error). Only one aggregated toast per drain for successes (`{n} changes synced`); failures toast once per drain: `{n} changes need attention` with tap-through to the sheet (toast is a button with 44px height). Never toast per op during a large drain.

### 5. Optimistic UI feedback in lists

- Pending items in shopping/pantry/meal plan lists show a 12px `CloudUpload` icon (gray-500, `aria-hidden`) trailing the item name plus `sr-only` text `Waiting to sync`. No row dimming, no spinner (keeps list readable offline).
- Failed items show a 12px `AlertTriangle` red-500 with `sr-only` text `Change failed`; tapping it opens the Pending changes sheet.
- Rolled-back optimistic changes restore previous values with a toast: `Couldn't save that change. It was undone.`

### 6. Cold start and bootstrap

- Hydration before first render is silent when it succeeds (splash already covers it per Phase 10 `NativeShell`). If cache is missing or schema version mismatched and device is offline: full-page `EmptyState`, icon `WifiOff`, heading `Connect once to get started`, body `Kitcha needs an internet connection the first time to download your data.`, action `Try again`.
- During initial bootstrap with progress: indicator shows `Syncing` and the sheet summary reads `Downloading your data...` (no percentage in v1).

### 7. Native and web rules

- Respect safe areas (`pt-safe`, `pb-safe`); the banner and sheet never sit under the status bar, home indicator, or keyboard (hide banner while `html.keyboard-open`).
- Haptics (native only, via existing wrapper): light on opening the sheet, success on retry success, warning on a row becoming `Failed`. No haptics for background state changes.
- Web build: components render identically but offline features feature-detect; with no outbox support the indicator never renders. No service-worker dependency.
- Motion: framer-motion/CSS transitions at 200-300ms max; all honor `prefers-reduced-motion`.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (sheet) | `Retry all` (row: `Retry`) |
| Empty state heading | `Nothing waiting` (offline variant: `You're offline`) |
| Empty state body | `Everything you changed is saved and synced.` (offline variant: `You can keep using Kitcha. New changes will show up here and sync when you're back online.`) |
| Offline banner | `You're offline. Changes are saved on this device and will sync later.` |
| Indicator labels | `Offline`, `Offline · {n} pending`, `{n} pending`, `Syncing {n}`, `{n} need attention`, `All synced` |
| Online-only helper | `Needs a connection` |
| Error state | `Couldn't reach the server after {n} tries. Check your connection and retry.` |
| Destructive confirmation (single) | Discard change: `Discard this change? It won't be saved.` buttons `Keep` / `Discard` |
| Destructive confirmation (bulk) | Discard all failed: `Discard {n} failed changes? They won't be saved.` buttons `Keep` / `Discard {n}` |
| First-launch offline | heading `Connect once to get started`, body `Kitcha needs an internet connection the first time to download your data.`, action `Try again` |

Tone: plain, second person, no jargon (never "outbox", "idempotency", "409"). Quote item names in row descriptions.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (shadcn not initialized) | not applicable |
| Third-party | none | not applicable |

No new UI dependencies are added by this phase; all UI uses existing Radix, lucide-react, framer-motion, and react-hot-toast packages.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

## Checker Recommendations (accepted)

- Copy: row-level actions read `Retry change`, `Discard change`, `Keep change`; bulk stays `Retry all` / `Discard {n}`.
- Visual anchor: the indicator pill is the only persistent chrome element; `Needs attention` leads the sheet; `Try again` anchors the first-launch offline screen.
- Accent: primary also used for the `syncing` indicator state (primary-50/primary-700) and the row `Syncing` badge; add to the reserved list.
- Spacing exceptions (justified): row `py-3` (12px) and banner height 40px are compact-density exceptions for touch-list rows; 20px icon is an icon size, not spacing; 64px row min height is the existing bottom-nav height token.
