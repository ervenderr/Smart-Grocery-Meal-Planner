---
phase: 10-capacitor-ios-shell
plan: 09
subsystem: ui
tags: [capacitor, local-notifications, reminders, haptics, settings, pantry]
requires:
  - phase: 10-01
    provides: isNative, loadPlugin, usePlatform
  - phase: 10-03
    provides: reminder scheduler, prefs, route allowlist
  - phase: 10-04
    provides: haptic(), haptic prefs
provides:
  - useReminders hook (permission, prefs, enable, snooze)
  - Opt-in explainer sheet with denied state, dashboard prompt card
  - Settings > Device tab (reminders and haptics, native only)
  - ReminderRuntime (sync on pantry/prefs change and resume, tap deep link, clear on logout)
  - Pantry ?filter=expiring deep-link target with filterExpiring helper
affects: [10-10]
tech-stack:
  added: []
  patterns:
    - Prefs changes announced via window event so independent hook instances and the runtime stay in sync
key-files:
  created:
    - frontend/lib/reminders/use-reminders.ts
    - frontend/components/reminders/reminder-explainer-sheet.tsx
    - frontend/components/reminders/reminder-prompt-card.tsx
    - frontend/components/reminders/reminder-runtime.tsx
    - frontend/components/settings/native-settings.tsx
    - frontend/lib/pantry/expiring-filter.ts
    - frontend/lib/pantry/expiring-filter.test.ts
  modified:
    - frontend/app/(app)/settings/page.tsx
    - frontend/app/(app)/dashboard/page.tsx
    - frontend/app/(app)/pantry/page.tsx
    - frontend/app/(app)/layout.tsx
key-decisions:
  - "After opt-in, immediate scheduling relies on the runtime reacting to a prefs-changed window event (REMINDER_PREFS_EVENT); no onEnabled prop."
  - "Open Settings uses window.location.assign('app-settings:') because @capacitor/app 8.1.2 has no openSettings API; needs real-device verification."
requirements-completed: [SHELL-04, SHELL-05]
duration: 25min
completed: 2026-10-11
---

# Phase 10 Plan 09: Reminders UI and runtime Summary

Opt-in expiry reminders (explainer sheet, denied handling, Settings > Device, runtime keeping the OS schedule in sync with pantry data) plus the native Haptics switch and the Pantry expiring deep link.

## Tasks
1. Hook, explainer sheet, prompt card, Device settings: c851493
2. filterExpiring tests 94cdcd2, impl 577f2a1; runtime, layout mount, Pantry filter: e9e9572

## Verification
- type-check clean, lint 0 errors (warnings only, including react-hooks/set-state-in-effect on hydration-safe reads).
- Vitest: lib/pantry and lib/reminders 162 passed. Full run: 1069 pass, 1 failure in lib/rules/rank.bench.test.ts (perf budget, flaky under parallel build load, unrelated to this plan).
- Native export builds and out/pantry/index.html exists; web build passes.
- requestOptIn is called only from useReminders.enable, reachable only from the explainer's button.

## Deviations from Plan
- [Rule 3] `App.openSettings` does not exist in @capacitor/app 8.1.2 (and plan 07 has not recorded an alternative). Used the `app-settings:` URL scheme via location.assign; WKWebView should hand it to the OS. Needs device verification.
- [Rule 1] Pantry empty state shows "No matching items" (not "Your pantry is empty") when the expiring filter yields nothing; Clear filters also clears the param.
- The filterExpiring implementation was written before the RED run, so the failing-test state was not observed; commits are ordered test then feat.
- Dashboard and layout mount reminder UI only when native, so web makes no extra pantry query.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (T-10-39..42 mitigations implemented: allowlisted tap routes via plan 03, literal 'expiring' only, clear on logout including unmount path, opt-in gated).

## Self-Check: PASSED
