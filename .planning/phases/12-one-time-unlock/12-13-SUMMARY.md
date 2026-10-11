---
phase: 12-one-time-unlock
plan: 13
subsystem: docs
tags: [iap, docs, app-store, env]
requires: [12-03, 12-06, 12-07, 12-08, 12-09, 12-11, 12-12]
provides:
  - docs/store/IAP.md as-built reference (testing guide, owner steps, review screenshot)
  - Updated privacy labels, review notes, submission checklist
  - IAP and paid-AI keys in backend/.env.example
affects: [12-14, 12-15]
key-files:
  modified:
    - docs/store/IAP.md
    - docs/store/PRIVACY-LABELS.md
    - docs/store/REVIEW-NOTES.md
    - docs/store/SUBMISSION-CHECKLIST.md
    - backend/.env.example
key-decisions:
  - "IAP.md describes the shipped custom StoreKit 2 plugin; RevenueCat appears only as not used"
requirements-completed: [SUB-01, SUB-02, SUB-03]
completed: 2026-10-11
---

# Phase 12 Plan 13: Store docs for the one-time unlock Summary

IAP.md now documents what was built (custom KumaunStore plugin, verify/me/webhook endpoints, limits 25 items, AI 40/day + 600/month, trip-finish gating) with a testing guide, an 8-step owner checklist and review-screenshot instructions; privacy, review, checklist docs and `.env.example` match.

## Commits
- b22ceae: IAP.md (120 lines)
- f3fe5d9: PRIVACY-LABELS, REVIEW-NOTES, SUBMISSION-CHECKLIST, backend/.env.example

## Verification
Both task grep verify commands pass; IAP.md under 300 lines; RevenueCat mentioned once, as "NOT used"; `IAP_ALLOW_XCODE_ENV` documented as never in production; `.env.example` has no secrets (APPLE_APP_APPLE_ID empty).

## Deviations from Plan
- Docs state Xcode scheme StoreKit wiring and the privacy manifest entry as "pre-wired by 12-15 if it ran, else manual / pending", because 12-15 had not run when this plan executed.
- IAP.md also records the 12-03 CLI probe as SKIPPED (URLError -1008), so real StoreKit checks are human_needed.
- The old Paid Apps Agreement checklist was kept but marked done per the phase context (agreement, bank, tax ACTIVE).
- No code changes; nothing deployed; STATE.md and ROADMAP.md intentionally not touched (per orchestrator).

## Known Stubs
None.

## Self-Check: PASSED
