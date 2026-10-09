---
phase: 04-persistent-shopping-list
plan: 10
subsystem: frontend
tags: [shopping, wake-lock, shopping-mode, mobile-ui]
requires: [04-05, 04-09]
provides:
  - createWakeLockController (pure, injectable navigator/document)
  - useWakeLock(enabled) -> { supported, active }
  - ShoppingModeToggle, AislePriceInput, large mode on ShoppingItemRow
key-files:
  created:
    - frontend/lib/shopping/wake-lock.ts
    - frontend/lib/shopping/wake-lock.test.ts
    - frontend/lib/hooks/use-wake-lock.ts
    - frontend/components/shopping/shopping-mode-toggle.tsx
    - frontend/components/shopping/aisle-price-input.tsx
  modified:
    - frontend/components/shopping/shopping-item-row.tsx
    - frontend/app/(app)/shopping/page.tsx
requirements: [SHOP-04]
completed: 2026-10-09
---

# Phase 4 Plan 10: Shopping mode Summary

Shopping mode switch keeps the screen awake via the Screen Wake Lock API (silent when unsupported or rejected), switches rows to 56px whole-row check targets, and adds an inline aisle price entry that saves actualCostCents optimistically.

## Commits
- 13b30a3 test(04-10): add failing tests for wake lock controller
- 5ef2bc3 feat(04-10): add screen wake lock controller and hook
- 295f212 feat(04-10): add shopping mode with wake lock and large check rows

## Decisions
- Controller tracks a `wanted` flag, so a request resolving after `stop()` is released at once and visibility changes after stop are ignored.
- `supported` is set after `start()` resolves, not synchronously in the effect (avoids the set-state-in-effect lint warning, keeps SSR/hydration safe).
- Shopping mode is component state only, never persisted.
- In shopping mode QuickAdd, GenerateFromPlan and ShoppingHistory are hidden; SummaryBar stays sticky; grouping already sinks checked items.
- The large row's container is an `li` (children of the section list) carrying `data-shopping-mode="large"` and `data-testid="shopping-row-large"`, not a `div`, to keep valid list markup.
- The price chip is a sibling of the checkbox button, so there are no nested interactive elements. The edit sheet is not reachable in large mode.
- The toggle does not take a `wakeLockSupported` prop: it would be unused, since an unsupported browser shows nothing extra.

## Deviations
None beyond the notes above.

## Verification
Vitest 174/174 (8 new wake-lock tests, RED first), lint 0 errors (warnings pre-existing), type-check clean, `next build` succeeds, static grep empty. Real-device wake lock behavior and sticky bar position are not exercised here (04-12). Not run against a live backend.

## Known Stubs
None.

## Self-Check: PASSED
