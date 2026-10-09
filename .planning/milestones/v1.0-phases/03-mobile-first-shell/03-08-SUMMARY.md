---
phase: 03-mobile-first-shell
plan: 08
subsystem: ui
tags: [currency, recharts, mobile, dashboard]
requires: [03-03, 03-06]
provides:
  - budget-related screens and charts rendered via useCurrency
key-files:
  modified:
    - frontend/components/analytics/spending-trends-chart.tsx
    - frontend/components/analytics/weekly-comparison-chart.tsx
    - frontend/components/analytics/category-spending-chart.tsx
    - frontend/components/analytics/pantry-analytics.tsx
    - frontend/components/analytics/recipe-analytics.tsx
    - frontend/app/(app)/dashboard/page.tsx
    - frontend/app/(app)/analytics/page.tsx
    - frontend/app/(app)/budget/page.tsx
    - frontend/app/(app)/help/page.tsx
requirements: [MOB-06, MOB-02, MOB-05]
metrics:
  tasks: 2
  completed: 2026-10-09
---

# Phase 3 Plan 08: Budget screens in user currency Summary

Dashboard, analytics, budget, help and the three charts now use `useCurrency()` (full format in cards/tooltips, compact on axes) with no peso literal left, and fit 375px.

## Commits
- feat(03-08): analytics charts use user currency and fit 375px
- feat(03-08): dashboard, analytics, budget, help in user currency at 375px

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Dashboard had no expiring-soon widget**
- The plan assumed an existing widget. I added an "Expiring Soon" card fed by `pantryApi.getExpiringSoon(7)` (failure falls back to an empty list), showing `EmptyState` ("Nothing expiring soon" / "Your pantry looks good.", h3) when empty.
- Stat tile icons are hidden below sm so the 2-up tiles fit at 375px.

**2.** pantry-analytics and recipe-analytics contain no charts or money, so they only got `min-w-0`, truncation, 44px rows and tighter padding.

## Verification
lint 0 errors, type-check clean, 57 tests pass, `next build` succeeds. `grep ₱` over the touched areas returns nothing.

## Known Stubs
None.

## Self-Check: PASSED
