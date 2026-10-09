---
phase: 03-mobile-first-shell
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/03-mobile-first-shell/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/03-mobile-first-shell/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, WR-01..WR-08)
- Fixed: 9
- Skipped: 0
- Info findings: not attempted (IN-01 deliberately skipped, see below)

Gates run in an isolated worktree: frontend lint (0 errors), type-check, Vitest (116 passed), `next build` (ok); backend tsc, lint (0 errors), full Jest 438/439 against a temporary Postgres 16. The one failure, `tests/food-lookup.test.ts` "status 0 negative-cache", is a timing flake that passes when the file is run alone and is unrelated to these changes.

## Fixed Issues

### CR-01: React Query cache survived logout

**Files modified:** `frontend/lib/auth/session-cleanup.ts` (new), `frontend/lib/auth/session-cleanup.test.ts` (new), `frontend/lib/stores/auth-store.ts`, `frontend/lib/api/client.ts`
**Commit:** 5babafc
**Applied fix:** A pure `clearUserSessionState` helper clears the whole query cache and per-user storage keys (`current-shopping-list`). It runs from the auth store's `clearAuth` (covers `useLogout` success and catch paths) and `setAuth` (login/signup never inherit a prior user's cache), and from the 401 handler in the API client.

### WR-02: parseMajorToCents accepted hex/exponent and used float math

**Files modified:** `frontend/lib/currency/format.ts`, `frontend/lib/currency/format.test.ts`
**Commit:** 21ce9d6
**Applied fix:** Strict decimal-string parsing with a regex sized to the currency's fraction digits (JPY/KRW 0), cents built from integer and fraction strings. Rejects 0x1F, 1e3, 0b11, separators, signs, whitespace inside, `.5`, `5.`, and too many decimals (so 1.005 and 12.345 are now rejected rather than silently rounded). Tests cover all of these plus large values.

### WR-01: budgetPerWeekCents had no upper bound (500 on Int4 overflow)

**Files modified:** `backend/src/modules/users/users.validation.ts`, `backend/src/modules/auth/auth.validation.ts`, `backend/tests/users.test.ts`, `frontend/lib/currency/budget.ts` (new), `frontend/lib/currency/budget.test.ts` (new), plus onboarding, settings, and both AI modals
**Commit:** fe4cde8
**Applied fix:** Backend `isInt({ min: 0, max: 2_000_000_000 })` with a clear message; the shared `validate` middleware now includes field messages in its 400 (`Validation failed: field: message`) so the message reaches the client. Frontend `parseBudgetInput` enforces the same ceiling (20,000,000 in major units) and is used by onboarding, settings and the AI meal plan modal; the substitution modal passes the currency to the stricter parser. Backend tests added for over-limit (400) and at-limit (200). Onboarding retry on 400 is handled in WR-06.

### WR-03: BottomNav could stay hidden

**Files modified:** `frontend/lib/dom/keyboard-open.ts` (new), `frontend/lib/dom/keyboard-open.test.ts` (new), `frontend/lib/hooks/use-keyboard-open.ts` (new), `frontend/components/dashboard/bottom-nav.tsx`
**Commit:** 8e16d75
**Applied fix:** Keyboard state is now derived, not event-driven: a text field must be the connected active element AND the visual viewport must be shrunk versus a measured baseline (iOS "Done" keeps focus but restores the viewport). Re-evaluated on mount, route change, focusin/out, pointerdown, visibilitychange, pageshow, window and visualViewport resize, and DOM mutations (unmounted focused input). Cleanup removes all listeners and the observer. `isTextEntry` is unchanged and still tested. Logic change: requires human verification on a real iOS and Android device.

### WR-04: AI modal submitted a stale budget

**Files modified:** `frontend/components/ai/ai-meal-plan-modal.tsx`
**Commit:** 02ad92c
**Applied fix:** Invalid text now sets the form value to 0 (fails the schema) and shows its specific error; `handleGenerate` also guards on the text error. Schema messages made user-friendly.

### WR-05: AI meal plan modal was hand-rolled

**Files modified:** `frontend/components/ai/ai-meal-plan-modal.tsx`
**Commit:** 571c7e0
**Applied fix:** Rewrapped in the shared Radix `Modal` (size xl): focus trap, scoped Escape, aria, scroll lock. The global Escape listener and the suppressed exhaustive-deps comment are gone. Form, save and result views are unchanged; the header icon and tagline moved into the body since `Modal` takes a string title. File is 392 lines.

### WR-06: Onboarding error handling and duplicate pantry creates

**Files modified:** `frontend/lib/onboarding/errors.ts` (new), `frontend/lib/onboarding/errors.test.ts` (new), `frontend/components/onboarding/onboarding-flow.tsx`
**Commit:** c853b52
**Applied fix:** `classifyOnboardingError` separates retryable (network, timeout, 408/425/429, 5xx; connection copy) from non-retryable 4xx (server message shown, no connection claim). Errors are logged. Non-retryable errors show a "Continue without saving" exit. Preferences PATCH is not repeated once saved (reset if the user edits earlier steps). Per-item 4xx failures are skipped and reported in a toast. Items whose create outcome is unknown after a retryable failure are looked up by name on retry before re-creating.

### WR-07: Currency code overlay misplaced with an error

**Files modified:** `frontend/components/ui/input.tsx`, `frontend/components/onboarding/step-budget.tsx`, `frontend/components/settings/preferences-settings.tsx`
**Commit:** 92127e1
**Applied fix:** Added a `suffix` adornment to `Input`, positioned inside the wrapper that contains only the `<input>`. Both call sites use it and the magic-offset overlays are removed.

### WR-08: Settings schema vs backend

**Files modified:** `frontend/lib/preferences/units.ts` (new), `frontend/lib/preferences/units.test.ts` (new), `frontend/components/settings/preferences-settings.tsx`
**Commit:** a7c1a1c
**Applied fix:** `mealsPerDay` capped at 5 (schema and input `max`). `preferredUnit` supports kg, lb, g, oz with options for each, and `normalizePreferredUnit` preserves stored values instead of rewriting to kg.

## Skipped Issues

None in scope. Out of scope and deliberately not touched:

- IN-01 (migration `IF NOT EXISTS`): the migration is already applied in production, and editing it would change its checksum. Skipped per instruction.
- IN-02..IN-06: Info findings, not attempted.

## Notes

- Fixes were committed on `main` by fast-forward from an isolated worktree branch; nothing was pushed and no Railway or Vercel resources were touched.
- The temporary Postgres 16 (port 5612) was stopped and its data directory removed.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
