---
phase: 03-mobile-first-shell
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - backend/src/constants/currencies.ts
  - backend/src/modules/users/users.routes.ts
  - backend/src/modules/users/users.controller.ts
  - backend/src/modules/users/users.service.ts
  - backend/src/modules/users/users.validation.ts
  - backend/src/types/user.types.ts
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/20261010000000_user_onboarding/migration.sql
  - backend/prisma/migrations/20261010010000_zapier_webhooks/migration.sql
  - frontend/app/(app)/layout.tsx
  - frontend/app/layout.tsx
  - frontend/app/manifest.ts
  - frontend/app/globals.css
  - frontend/app/(app)/recipes/page.tsx
  - frontend/components/dashboard/bottom-nav.tsx
  - frontend/components/dashboard/more-sheet.tsx
  - frontend/components/onboarding/onboarding-flow.tsx
  - frontend/components/onboarding/onboarding-gate.tsx
  - frontend/components/onboarding/step-budget.tsx
  - frontend/components/onboarding/step-dietary.tsx
  - frontend/components/onboarding/step-pantry.tsx
  - frontend/components/pwa/ios-install-hint.tsx
  - frontend/components/providers.tsx
  - frontend/components/ui/modal.tsx
  - frontend/components/ui/input.tsx
  - frontend/components/ui/select.tsx
  - frontend/components/ui/button.tsx
  - frontend/components/common/empty-state.tsx
  - frontend/components/settings/preferences-settings.tsx
  - frontend/components/ai/ai-meal-plan-modal.tsx
  - frontend/lib/currency/currencies.ts
  - frontend/lib/currency/currency-provider.tsx
  - frontend/lib/currency/format.ts
  - frontend/lib/navigation.ts
  - frontend/lib/pwa/detect-ios.ts
  - frontend/lib/pwa/storage.ts
  - frontend/lib/hooks/use-preferences.ts
  - frontend/lib/auth/use-logout.ts
  - frontend/lib/notifications/use-notification-stats.ts
  - frontend/lib/onboarding/onboarding.ts
  - frontend/lib/api/preferences.ts
  - frontend/lib/dom/is-text-entry.ts
  - scripts/smoke-prod.sh
findings:
  critical: 1
  warning: 8
  info: 6
  total: 15
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 38 non-test source files (the 03 diff touches more; presentational page edits were not examined line by line)

## Summary

The backend onboarding path is sound. The endpoint takes the user id from the auth token, so there is no IDOR. `updateMany ... WHERE onboardingCompletedAt IS NULL` is idempotent and keeps the first timestamp. `updatePreferences` maps an explicit field whitelist, so `PATCH /preferences` cannot set `onboardingCompletedAt`. The currency allow-list is applied after trim and uppercase. Registration creates the preferences row, so `completeOnboarding` will not 404 for normal users. The backfill SQL is NULL-safe.

The frontend has one real correctness and privacy defect. The `['preferences']` cache is never cleared on logout, so the next user in the same tab inherits the previous user's onboarding state and currency. Beyond that, several input-bounds gaps can turn user input into a 500 or leave the user stuck, and one iOS keyboard-handling state can leave the bottom nav hidden.

## Critical Issues

### CR-01: `['preferences']` (and all) React Query cache survives logout, leaking the previous user's onboarding state and currency

**File:** `frontend/lib/auth/use-logout.ts:17,23` (also `frontend/lib/hooks/use-preferences.ts:8-17`, `frontend/lib/react-query.ts`)
**Issue:** `useLogout` calls `clearAuth()` and redirects, but never clears the shared `queryClient`. The cache key `['preferences']` is not user-scoped and `staleTime` is 5 minutes (`gcTime` 10 minutes). Sequence: user A logs out, then user B signs up or logs in within the stale window without a full page reload. `usePreferences()` returns A's cached row immediately and does not refetch.
- A new signup B gets A's `onboardingCompletedAt` (non-null), so onboarding is never shown.
- B sees A's currency and budget formatting through `CurrencyProvider`. Settings also initialises from A's data.
- Any other user-scoped keys (`pantry`, `budget`, and so on) leak the same way.

This is a cross-account data exposure and breaks the onboarding gate the phase introduces. The 03-13 smoke test cannot catch it because it uses curl.
**Fix:**
```ts
// use-logout.ts
const queryClient = useQueryClient();
...
clearAuth();
queryClient.clear();   // do this in both the success and catch paths
```
Apply the same in any 401-interceptor logout path. Alternatively, key `PREFERENCES_QUERY_KEY` by `user.id`.

## Warnings

### WR-01: `budgetPerWeekCents` has no upper bound, so huge input overflows Postgres Int and returns a 500

**File:** `backend/src/modules/users/users.validation.ts:51`; `frontend/lib/currency/format.ts:68-76`; `frontend/components/onboarding/onboarding-flow.tsx:78-83`
**Issue:** The Prisma column is `Int` (32-bit). The validator is `isInt({ min: 0 })` with no max. `parseMajorToCents` accepts any finite number (for example `99999999999`), and onboarding has no cap (settings caps at 1e9 and the AI modal at 1e8). The result is a Prisma/DB error, surfaced as a 500. In onboarding that lands in the generic `SAVE_ERROR` ("check your connection"), and every retry fails identically. The user's only way out is "Skip setup", which discards their choices.
**Fix:** Backend: `.isInt({ min: 0, max: 2_000_000_000 })`. Frontend: share a `MAX_BUDGET_CENTS` constant and have `budgetError`/`parseMajorToCents` reject values above it.

### WR-02: `parseMajorToCents` accepts hex, exponent, and other `Number()` syntax, and uses float rounding

**File:** `frontend/lib/currency/format.ts:73-75`
**Issue:** `Number("0x1F")` is 31, `Number("1e3")` is 1000, `Number("0b11")` is 3, and `Number("1_000")` is NaN. A user typing `1e3` silently gets 1000. `Math.round(n*100)` on binary floats mis-rounds some values (for example `1.005*100` is 100.49999... and gives 100, not 101), and inputs with more than 2 decimals are silently rounded. `"12,5"` (a common decimal comma) is rejected, though that at least errors.
**Fix:** Validate with a strict regex before converting, and parse integer and fraction parts as strings:
```ts
const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(trimmed);
if (!m) return null;
return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
```

### WR-03: BottomNav can stay hidden with no keyboard open, and misses already-focused inputs

**File:** `frontend/components/dashboard/bottom-nav.tsx:60-73`
**Issue:** Visibility depends only on focusin/focusout of text-entry elements, which is a proxy for "keyboard open".
- On iOS Safari, tapping the keyboard's "Done" does not blur the input, so `keyboardOpen` stays true. The nav stays hidden until the user taps a non-focusable area.
- If the focused input is unmounted (a modal closes after submit, a route change, or a step swap in onboarding), no `focusout` is reliably dispatched. The nav then stays hidden and `keyboardOpen` is stuck until the next focus event.
- An `autoFocus` input that is focused before the effect subscribes is never seen, because there is no initial `document.activeElement` check.
- `SELECT` counts as text entry, but on iOS it opens a picker rather than a keyboard.

**Fix:** Also listen to `visualViewport.resize` (keyboard open means `visualViewport.height` is well below `innerHeight`). Re-evaluate `document.activeElement` on `pathname` change and `visibilitychange`, and on mount.

### WR-04: AI meal-plan modal submits a stale budget while the field shows an invalid value

**File:** `frontend/components/ai/ai-meal-plan-modal.tsx:97-106`
**Issue:** On invalid input, `handleBudgetChange` calls `setError('budgetCents', ...)` but leaves the form's `budgetCents` at the last valid value. `handleSubmit` re-runs the zod resolver, which replaces manual errors. It validates the old, valid number, so the form submits the previous budget while the visible text is `abc` or `0`. The user generates a plan with a budget they did not enter.
**Fix:** Set the form value to `NaN`/`0` on invalid input (`setValue('budgetCents', cents ?? 0, { shouldValidate: true })`) so the resolver fails. Alternatively, validate `budgetInput` in `handleGenerate` and abort.

### WR-05: AI meal-plan modal is a hand-rolled dialog with no focus trap, no initial focus, and a global Escape listener

**File:** `frontend/components/ai/ai-meal-plan-modal.tsx:164-185`
**Issue:** `role="dialog" aria-modal="true"` is declared, but there is no focus trap, no focus restoration, and no `inert`/`aria-hidden` on the background. Tab walks into the page behind the overlay, and background scrolling is not locked. The document-level Escape handler (with `react-hooks/exhaustive-deps` suppressed) will also close this modal when Escape was meant for a nested Radix dialog or popover. Every other modal in the phase moved to Radix.
**Fix:** Migrate to the shared `Modal` (Radix Dialog), as the phase did for the other modals.

### WR-06: Onboarding "finish" has no recovery from non-retryable failures and can duplicate pantry items

**File:** `frontend/components/onboarding/onboarding-flow.tsx:71-98`
**Issue:** Both `catch {}` blocks discard the error and always show "Check your connection and try again". A 400 (see WR-01) or a rejected pantry item (duplicate, validation) fails every retry, and the full-screen, non-dismissable dialog gives only "Skip setup". `createdNames` tracks successful creates, so a retry mostly avoids duplicates. If `pantryApi.create` succeeded server-side but the response was lost (a timeout), the retry creates a duplicate. The `PATCH` also re-runs on every retry. The error is never logged, which conflicts with the "never silently swallow errors" rule.
**Fix:** Log the error, show `getApiErrorMessage(err)` when it is a 4xx, and treat per-item failures as non-fatal (continue and report). Optionally move pantry seeding server-side behind an idempotency key.

### WR-07: Currency code overlay is mispositioned when the budget input shows an error

**File:** `frontend/components/settings/preferences-settings.tsx:176-182`; `frontend/components/onboarding/step-budget.tsx:56-60`
**Issue:** In settings the overlay uses `bottom-0 h-11` relative to a wrapper that also contains the `<Input>` error paragraph (new `role="alert"` `<p>` with `mt-1`). When an error shows, the currency label moves down beside the error text instead of the field. The onboarding step uses the magic `top-[calc(1.25rem+0.5rem+0.75rem)]`, which breaks if the label wraps or the font scales. `Input` already has an `icon` prop for adornments.
**Fix:** Render the code through `Input`'s adornment support, or wrap only the `<input>` in the `relative` container.

### WR-08: Settings form schema disagrees with the backend, and a silent unit downgrade

**File:** `frontend/components/settings/preferences-settings.tsx:37,39,73-74`
**Issue:**
- `mealsPerDay` allows up to 10 on the client, but the backend allows 1-5 (`users.validation.ts`, plus a service check). Submitting 6-10 passes client validation and then gets a 400 shown as a toast.
- `preferredUnit` is `z.enum(['kg','lb'])` and the loader coerces anything other than `lb` to `kg`. A user whose stored unit is `g` or `oz` (both valid on the backend) gets it silently rewritten to `kg` on the next unrelated save.

**Fix:** Align the client schema with the validator (max 5; keep all four units or handle them explicitly).

## Info

### IN-01: Migration is not re-runnable and its timestamps are ahead of the date

**File:** `backend/prisma/migrations/20261010000000_user_onboarding/migration.sql:2`
**Issue:** `ADD COLUMN` lacks `IF NOT EXISTS`, unlike the sibling zapier migration, which was made idempotent for `db push` databases. On a partial or manual re-run, it fails. The `UPDATE` is unguarded (`... AND onboarding_completed_at IS NULL` would be safe). Both migration names use 2026-10-10 while today is 2026-10-09, so any migration generated before that date sorts earlier and could apply out of order. The backfill heuristic `updated_at > created_at + 1 second` is a guess for "has used the app". Users with default settings and an empty pantry will see onboarding once (acceptable, but intentional?).
**Fix:** Use `ADD COLUMN IF NOT EXISTS` and add `AND "onboarding_completed_at" IS NULL` to the backfill.

### IN-02: `formatCurrency*` do not guard NaN/undefined/non-finite cents

**File:** `frontend/lib/currency/format.ts:48-58`
**Issue:** `undefined`/`NaN` from an API field yields "₱NaN". There is no guard for `Infinity` either. Unsupported codes already fall back safely to PHP.
**Fix:** `if (!Number.isFinite(cents)) cents = 0` (or return an em dash).

### IN-03: Onboarding seeds an unsupported currency

**File:** `frontend/components/onboarding/onboarding-flow.tsx:46`
**Issue:** `initial?.currency || DEFAULT_CURRENCY` does not check `isSupportedCurrency`. A legacy stored value (such as `XXX`) is not in the `<select>` options but would be sent in the PATCH and rejected with a 400, stuck as in WR-06. `CurrencyProvider` does validate, so this is inconsistent.
**Fix:** `isSupportedCurrency(c) ? c : DEFAULT_CURRENCY`.

### IN-04: Manifest and metadata inconsistencies

**File:** `frontend/app/manifest.ts:12,14`; `frontend/app/layout.tsx` viewport
**Issue:** `orientation: 'portrait'` locks tablets and landscape use (a WCAG 1.3.4 concern) and affects desktop-installed PWAs. `theme_color` is `#0ea5e9` in the manifest but `#ffffff` in the `viewport` export, so the browser chrome colour differs between browser tab and installed app.
**Fix:** Drop `orientation` (or use `any`); unify the theme colour.

### IN-05: Backend import style and duplicated `any` access

**File:** `backend/src/modules/users/users.validation.ts:8`; `users.controller.ts` (`(req as any).user.id`)
**Issue:** The validation file uses a relative `../../constants/currencies` while neighbours use the `@/` alias. `(req as any).user.id` is consistent with the module but is an untyped access on a security-relevant path. The frontend parity test relies on regex-matching every `'XXX'` literal in the backend file, so a comment containing a quoted 3-letter uppercase token would break it.
**Fix:** Use the alias; type the request via an `AuthenticatedRequest` interface; anchor the regex to the array body.

### IN-06: Minor recipes and AI-modal logic

**File:** `frontend/app/(app)/recipes/page.tsx` (`handleClearFilters`); `ai-meal-plan-modal.tsx` (`defaultSaveDates`)
**Issue:** `handleClearFilters` calls `fetchRecipes(cleared, '')` and also changes `filters`, so the `[filters]` effect fires a second identical request (an out-of-order response race is possible). `defaultSaveDates` uses `toISOString().split('T')[0]` (UTC), so for UTC+8 users before 08:00 local the default start date is the previous day. `defaultSaveDates()` is also re-evaluated on every render for a value that is only read on the first render.
**Fix:** Drop the manual fetch and rely on the effect; build the local date with `toLocaleDateString('en-CA')`; pass a lazy default.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
