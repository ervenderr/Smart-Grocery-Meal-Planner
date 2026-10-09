---
phase: 03-mobile-first-shell
plan: 04
subsystem: ui
tags: [mobile, tailwind, auth, settings, dvh, touch-targets]
requires: []
provides:
  - dvh landing/login/signup, 44px auth links and checkbox row
  - settings section chips below lg, contract labels on profile/password forms
affects: [03-13]
key-files:
  modified:
    - frontend/app/page.tsx
    - frontend/app/(auth)/login/page.tsx
    - frontend/app/(auth)/signup/page.tsx
    - frontend/components/auth/login-form.tsx
    - frontend/components/auth/signup-form.tsx
    - frontend/app/(app)/settings/page.tsx
    - frontend/app/(app)/profile/page.tsx
    - frontend/components/settings/profile-settings.tsx
    - frontend/components/settings/password-settings.tsx
    - frontend/components/settings/data-settings.tsx
requirements-completed: [MOB-02, MOB-03]
duration: 20min
completed: 2026-10-09
---

# Phase 3 Plan 04: Entry and account screens at 375px Summary

Landing, auth, settings, profile and data settings now follow the UI-SPEC mobile rules: dvh heights, 44px links/rows, stacked full-width CTAs and settings section chips.

## Commits
- 40de876: landing, login, signup
- 4d16eab: settings chips, profile, password, data settings

## Changes
- `min-h-screen` replaced with `min-h-dvh` in the three page files. The auth brand panel was already `hidden lg:block`, so it is unchanged.
- Landing CTAs stack full width below `sm` (the Link wrappers now carry `w-full sm:w-auto`).
- Login and signup text links are `inline-flex min-h-11 items-center`. The remember-me row is a `min-h-11` label with an `h-5 w-5` box.
- Settings: `role="group"` chip row (`h-11`, `aria-pressed`, `overflow-x-auto scrollbar-hide`) shown below lg. The side nav card is `hidden lg:block`. The content column is `min-w-0`.
- Profile and password forms: submit labels are now "Save Profile" and "Update Password" (previously "Save Changes" and "Change Password"). Action rows are `flex-col-reverse` below `sm`, with `w-full sm:w-auto` buttons. Inputs are `min-h-11 text-base lg:text-sm`.
- Data settings: buttons are `min-h-11 w-full sm:w-auto`, the confirm input is 16px, and confirm flows are untouched.
- Profile page title row stacks, and the email and name use `break-words`.

## Deviations from Plan
None for scope. Only classes and two button labels changed. Validation, API calls and auth logic are untouched (T-03-13 diff reviewed).

## Notes
- Gates: lint reports 0 errors (141 existing warnings). type-check and `NEXT_PUBLIC_API_URL=https://x.example npx next build` exit 0. Earlier runs failed only because of plan 03-01's in-progress vitest install (files outside this plan), and passed on rerun.
- Settings icons from the old side nav (`text-xs` descriptions) are unchanged because that nav is desktop-only now.
- STATE.md was not updated: `gsd-sdk state.advance-plan` could not parse the Current Plan lines, and STATE.md still shows phase 3 as not started. Left for the orchestrator to avoid conflicting with sibling plans.
- Not done: the password-visibility toggle icons in the auth forms and settings password form are still small (`tabIndex=-1`, secondary controls). They are outside the plan's listed targets.

## Self-Check: PASSED
