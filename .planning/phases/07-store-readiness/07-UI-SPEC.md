---
phase: 7
slug: store-readiness
status: approved
shadcn_initialized: false
preset: none
created: 2026-10-10
---

# Phase 7 — UI Design Contract

> Visual and interaction contract for Phase 7 (STORE-01..05). Reuses the existing frontend design system (Tailwind v4 `@theme` tokens in `frontend/app/globals.css`, `components/ui/*`). No new design system, no new tokens. Sources: 07-CONTEXT.md (decisions), existing codebase scan (defaults).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled components on Radix primitives; shadcn not initialized, gate answered N by autonomous default: existing system is established) |
| Preset | not applicable |
| Component library | radix (`@radix-ui/react-dialog` via `components/ui/modal.tsx`), plus `Button`, `Input`, `Card`, `Select`, `Switch` in `components/ui/` |
| Icon library | lucide-react |
| Font | Inter (`--font-inter`, system-ui fallback) |

Reuse rules:
- All sheets/confirmations use `Modal` (bottom sheet below `sm`, centered from `sm`; already handles safe-area inset). Do not create a second dialog primitive.
- Buttons use `Button` variants: `primary`, `secondary`, `outline`, `danger`. Touch targets stay 44px (`h-11`).
- No new dependencies.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge inner gap |
| sm | 8px | Compact spacing, badge padding-y, link rows gap |
| md | 16px | Default element spacing, sheet padding (mobile) |
| lg | 24px | Sheet padding (sm+), section padding in legal pages |
| xl | 32px | Gaps between legal page sections |
| 2xl | 48px | Legal page top/bottom padding |
| 3xl | 64px | Not used this phase |

Exceptions: 44px minimum touch targets for all buttons, links in Settings rows, and the report action (matches existing `h-11`). Bottom sheet bottom padding uses `max(16px, env(safe-area-inset-bottom))` (existing Modal behavior).

---

## Typography

Matches existing app usage (Tailwind text scale).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px (`text-base`; 14px `text-sm` allowed only inside badges/disclaimers) | 400 | 1.5 |
| Label | 14px (`text-sm`) | 600 | 1.5 |
| Heading | 20px (`text-xl`, sheet titles and legal section headings) | 600 | 1.2 |
| Display | 28px (`text-[28px]`, legal page H1 only; do not use `text-3xl`, which is 30px) | 600 | 1.2 |

Sizes in use: 14, 16, 20, 28. Weights: 400 and 600 only. Legal pages: body copy 16px, max line width `max-w-prose` (about 65ch).

---

## Color

Existing tokens; no changes.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` (white) | Page, sheets, legal pages |
| Secondary (30%) | `gray-50/100` (`#f9fafb` / `#f3f4f6`) | Settings cards, disclaimer strip, AI badge background neutral variant |
| Accent (10%) | `primary-500` `#0ea5e9` (hover `primary-600`) | See reserved list |
| Destructive | `red-500` `#ef4444` (hover `red-600`) | Delete account only (button, warning icon, error text on password field) |

Accent reserved for:
1. "Accept and continue" button in the AI consent sheet
2. "Turn off" button in the AI consent withdrawal confirm (`primary` variant)
3. "Send report" button in the Report sheet (`primary` variant)
4. "AI-generated" badge icon and text (`primary-700` text on `primary-50` background for contrast)
5. Links in legal pages and in consent sheet (privacy link)
6. Focus rings (existing `focus-visible:ring-primary-500`)

Not accent: "Report suggestion" (trigger), "Withdraw consent", "Not now", "Keep on", "Keep my account", "Discard report" (use `outline`/`secondary` variants). Delete account uses `danger` variant only. These are the only `primary` variant buttons in this phase; each sheet has exactly one.

---

## Screens and Interaction Contract

Focal point per screen (the one element the eye lands on first, and where initial focus goes unless noted):

| Screen | Focal point |
|--------|-------------|
| Settings additions | "AI features" switch row at the top of the AI and privacy card |
| Delete account sheet | Password field (initial focus; danger button is never auto-focused) |
| AI consent sheet | Title "Use AI features?" plus primary CTA "Accept and continue" |
| Withdrawal confirm | Title plus primary "Turn off" button |
| AI badge and disclaimer | "AI-generated" badge at the top of each result |
| Report sheet | Reason `Select` (initial focus), then "Send report" |
| Legal pages | H1 (28px) |
| Sign-up addition | Existing submit button remains focal; legal sentence is subordinate (14px gray-600) |

### 1. Settings additions (`app/(app)/settings/page.tsx`, new components in `components/settings/`)
New sections appended below existing ones, each a `Card`:
- **AI and privacy** card: row "AI features" with `Switch` reflecting consent state (on = consented). Turning on opens the consent sheet (does not enable until accepted). Turning off opens a small confirm: "Turn off AI features? Kitcha will stop sending data to AI providers." Buttons "Turn off" (`primary`) / "Keep on" (`secondary`). Below: consented-date caption (14px, gray-600), e.g. "Accepted on Oct 10, 2026".
- **Legal and support** card: three link rows (Privacy Policy, Terms of Use, Support), each 44px min height with chevron icon, open `/privacy`, `/terms`, `/support`.
- **Danger zone** card (red-200 border): heading "Delete account", body copy, `danger` button "Delete account".

### 2. Delete account confirm sheet (`Modal`, size `sm`)
- Title: "Delete your account?"
- Body lists what is removed (pantry, recipes, meal plans, shopping lists, budget, AI usage) and states it cannot be undone.
- Password `Input` (type password, `autoComplete="current-password"`, label "Enter your password to confirm"). This is the focal point and receives initial focus.
- Buttons stacked on mobile: `danger` "Delete account permanently" (disabled until password non-empty; `loading` while submitting), `secondary` "Keep my account".
- States: idle, submitting (inputs disabled, button loading), wrong password (inline error under field, `role="alert"`, focus returns to field, sheet stays open), network/server error (inline error banner, retry allowed), success (close sheet, clear localStorage token and local state, redirect to `/login?deleted=1`; login page shows a one-line green notice "Your account has been deleted.").
- Escape/overlay close allowed except while submitting.

### 3. AI consent sheet (`Modal`, size `sm`, shared component `components/ai/ai-consent-sheet.tsx`)
- Shown when the user triggers any AI entry point (AI recipe suggestions, AI meal plan, AI substitution) without consent, and when toggling AI on in Settings. On accept, the original action continues automatically; on decline, sheet closes and the action does not run.
- Title: "Use AI features?"
- Body (16px) in short list: what is sent ("Pantry item names and your diet tags"), what is not sent ("Your name, email or account details"), who receives it ("A third-party AI provider (Google Gemini or Groq) that processes it to generate suggestions"), you can withdraw anytime in Settings. Link "Read the Privacy Policy" (opens `/privacy` in a new tab, `rel="noopener"`).
- Buttons: `primary` "Accept and continue" / `secondary` "Not now". Accept shows loading; failure shows inline error "Couldn't save your choice. Check your connection and try again."
- Backend 403 `AI_CONSENT_REQUIRED` from any AI call must also open this sheet (handled centrally, not per-modal).
- Existing AI modals show the consent sheet instead of their content when consent is missing; no AI request fires before acceptance.

### 4. AI-generated badge and disclaimer (`components/ai/ai-badge.tsx`, `ai-disclaimer.tsx`)
- Badge: pill, `Sparkles` icon 16px + text "AI-generated", 14px/600, `primary-50` bg, `primary-700` text, `px-2 py-1` (8/4), `rounded-full`. Includes `aria-label="AI-generated content"`.
- Placement: top of every AI recipe card, AI suggestion result, AI meal plan header, and AI substitution result, and on saved recipes that originated from AI (if flagged).
- Disclaimer: below AI results, `gray-50` strip, `Info` icon 16px, 14px/400 text: "AI suggestions may be inaccurate. Check ingredients for allergies and don't treat this as medical or nutrition advice." Always visible (not collapsed).
- Report action: ghost `Flag` icon button with visible text "Report suggestion" (44px target) next to each AI item. Opens a `Modal` size `sm`: title "Report this suggestion", `Select` reason (Inaccurate or unsafe, Offensive, Doesn't match my diet or allergies, Other), optional textarea (max 500 chars with counter), buttons `primary` "Send report" / `secondary` "Discard report". Success: sheet closes, toast "Thanks, we've received your report." Rate-limited (429) error: "You've sent several reports recently. Try again later." Other error: "Couldn't send your report. Try again."

### 5. Legal pages (public, no auth: `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/support/page.tsx`)
- Outside the `(app)` and `(auth)` groups; no app nav, no auth redirect. Server components.
- Layout: centered `max-w-prose`, `px-4 sm:px-6`, `py-12` (48px), white background. Header row: "Kitcha" wordmark linking to `/`, then H1 (28px, focal point), "Last updated: {date}" caption (14px gray-600). Sections as H2 (20px/600) with 32px gap between sections. Footer cross-links to the other two legal pages and back to the app.
- Draft banner at top of each legal page, amber (`budget-warning` tone) strip: "Draft: pending owner review." Controlled so it is easy to remove (single constant), and documented as not legal advice.
- Privacy content sections: data collected, how it is used, AI processing and providers, third-party data (Open Food Facts attribution, ODbL), retention and account deletion, your choices (withdraw AI consent), children, contact.
- Terms content sections: acceptance, account, acceptable use, AI content disclaimer, third-party data, termination, liability, contact.
- Support: contact via `mailto:` link built from `NEXT_PUBLIC_SUPPORT_EMAIL` (if env missing, render a visible "Contact email not configured" fallback in dev and hide the mailto in prod build with a plain text note), FAQ for: delete account, withdraw AI consent, reset password, report AI content.
- Accessibility: one H1 per page, landmark `main`, link underline on hover and always underlined within body copy, contrast AA.
- Metadata: unique `title` and `description` per page; `robots` index allowed.

### 6. Sign-up screen (`app/(auth)/signup/page.tsx`)
- Add under the submit button, 14px gray-600 centered: "By creating an account you agree to our Terms of Use and Privacy Policy." Both are links (open in same tab). Optional login screen footer shows the same links plus Support.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (consent) | Accept and continue |
| Primary CTA (destructive) | Delete account permanently |
| Primary CTA (report) | Send report |
| Primary CTA (withdrawal confirm) | Turn off |
| Dismiss (delete sheet) | Keep my account |
| Dismiss (report sheet) | Discard report |
| Dismiss (consent sheet) | Not now |
| Dismiss (withdrawal confirm) | Keep on |
| Report trigger (per AI item) | Report suggestion |
| Empty state heading | not applicable this phase (no new list views); AI surfaces keep their existing empty states |
| Empty state body | not applicable |
| Error state (consent save) | Couldn't save your choice. Check your connection and try again. |
| Error state (wrong password) | That password is incorrect. Try again. |
| Error state (delete failed) | We couldn't delete your account. Check your connection and try again. |
| Error state (report failed) | Couldn't send your report. Try again. |
| Error state (consent required, from API) | AI features are turned off. Accept to continue. (opens consent sheet) |
| Destructive confirmation | Delete account: "This permanently deletes your pantry, recipes, meal plans, shopping lists, budget and AI usage. This can't be undone." Requires password entry. |
| AI disclaimer | AI suggestions may be inaccurate. Check ingredients for allergies and don't treat this as medical or nutrition advice. |
| AI badge | AI-generated |
| Consent withdrawal confirm | Turn off AI features? Kitcha will stop sending data to AI providers. |

No generic "Cancel" labels are used anywhere in this phase.

---

## Accessibility and Mobile

- All sheets: focus trapped (Radix), initial focus on first field or primary safe action (for Delete: password field; never auto-focus the danger button), `Dialog.Title` present.
- Errors announced with `role="alert"`; success toasts with `role="status"`.
- Inputs 16px font minimum to prevent iOS zoom.
- Respect safe-area insets in sheets and legal page footer (works inside the later Capacitor shell).
- Legal links in Settings and sign-up must be real `<a href>` (crawlable by App Review), not JS handlers.
- Color is never the only signal: danger zone also uses an icon (`AlertTriangle`) and text.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (shadcn not initialized) | not applicable |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
