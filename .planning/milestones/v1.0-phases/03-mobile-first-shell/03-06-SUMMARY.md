---
phase: 03-mobile-first-shell
plan: 06
subsystem: ui
tags: [currency, intl, react-query, settings, vitest]
requires: [03-01, 03-02]
provides:
  - formatCurrency / formatCurrencyCompact / currencySymbol / parseMajorToCents helpers
  - preferencesApi, usePreferences, PREFERENCES_QUERY_KEY
  - CurrencyProvider / useCurrency
  - DIETARY_OPTIONS shared constant
affects: [03-08, 03-09, 03-10, 03-11]
key-files:
  created:
    - frontend/lib/currency/currencies.ts
    - frontend/lib/currency/format.ts
    - frontend/lib/currency/format.test.ts
    - frontend/lib/currency/parity.test.ts
    - frontend/lib/currency/currency-provider.tsx
    - frontend/types/preferences.types.ts
    - frontend/lib/api/preferences.ts
    - frontend/lib/hooks/use-preferences.ts
    - frontend/lib/constants/dietary.ts
  modified:
    - frontend/lib/utils.ts
    - frontend/components/providers.tsx
    - frontend/components/settings/preferences-settings.tsx
decisions:
  - Compact format uses Intl default rounding (no maximumFractionDigits) to match the planned PHP 1250000 -> "₱13K"
metrics:
  tasks: 3
  completed: 2026-10-09
---

# Phase 3 Plan 06: Currency Summary

Per-user currency end to end on the frontend: Intl-based formatters with allow-list fallback, preferences API/hook, app-wide CurrencyProvider, and a Settings currency picker plus numeric budget input.

## Commits
- test(03-06): failing currency helper tests
- feat(03-06): currency helpers
- feat(03-06): preferences api, hook and CurrencyProvider
- feat(03-06): settings currency picker, numeric budget input (role=switch toggle, 44px)

## Verification
13 currency tests (including backend parity) pass; full suite 44 passed; type-check clean; lint 0 errors; `next build` succeeds.

## Deviations from Plan

**1. [Rule 1 - Bug] Compact formatter option**
- Plan specified `maximumFractionDigits: 1` but the plan's own expected value `₱13K` is produced only with Intl's default; with the option the result is `₱12.5K`. Removed the option so the tested behavior holds.
- Commit: feat(03-06) currency helpers.

**2. Settings file length**: preferences-settings.tsx is exactly 320 lines (limit 320).

## Known Stubs
None.

## Notes
`lib/utils.ts` now re-exports `formatCurrency` (signature adds an optional currency, default PHP); no existing callers broke. Cancel in Settings also resyncs the budget text field.

## Self-Check: PASSED
