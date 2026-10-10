---
phase: 07-store-readiness
fixed_at: 2026-10-10T00:00:00Z
review_path: .planning/phases/07-store-readiness/07-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Scope:** Critical + Warning (WR-01..WR-05). Info findings (IN-01..IN-04) intentionally not addressed.
**Method:** worked directly on `main` with explicit-path commits (no worktree, per orchestrator instruction). No push, no migrations, no prod actions.

## Fixed Issues

### WR-01: Report snapshot size measured in characters on client
**Files:** `frontend/lib/ai/report.ts`, `frontend/lib/ai/report.test.ts` | **Commit:** 9cb7a09
Client now measures UTF-8 bytes via `TextEncoder`, matching the server's `Buffer.byteLength`. New test uses multi-byte text that is under 8192 chars but over 8192 bytes.

### WR-02: Reviewer seed could wipe a real account
**Files:** `backend/src/tools/reviewer-seed.ts`, `backend/tests/seed-reviewer.test.ts`, `docs/store/REVIEW-NOTES.md`
`seedReviewer` now throws before any write when `REVIEWER_EMAIL` belongs to an existing user that is not named "App Reviewer". Test proves the real account's data and password are untouched. `REVIEW-NOTES.md` documents the production procedure. Not done: the `@kitcha-demo.com` domain restriction (existing tests use example.com; the name guard covers the destructive case) and the NODE_ENV-unset hardening (ALLOW_SEED stays an explicit, documented override). Status: fixed, requires human verification of the production-procedure wording.

### WR-03: Account deletion unsafe under concurrency
**Files:** `backend/src/modules/users/account-deletion.service.ts`, `backend/tests/account-deletion.test.ts`
Transaction now takes `SELECT ... FOR UPDATE` on the user row first (concurrent FK inserts take FOR KEY SHARE and wait), and uses `user.deleteMany` so a losing duplicate request is a no-op instead of P2025/500. Chose row lock over Serializable isolation to avoid serialization-failure retries. New service-level race test failed before the fix and passes after; HTTP double-delete test added. Status: fixed, requires human verification (concurrency logic).

### WR-04: Store-submission blockers not enforced
**Files:** `frontend/next.config.ts`, `frontend/lib/legal/release-checks.ts` (+ test), `frontend/.env.example`
Per owner decision the draft banner default is unchanged and builds never fail. Production build and `next start` now log non-fatal `[store-readiness]` warnings when `NEXT_PUBLIC_SUPPORT_EMAIL` is missing/invalid or `DRAFT_BANNER_ENABLED` is true. Verified with a real `next build` (warnings appear; build succeeds). Warnings print twice during build because Next loads the config in two processes.

### WR-05: Server stored arbitrary report content
**Files:** `backend/src/modules/ai/ai-report.schema.ts`, `backend/tests/ai-report.test.ts`
Schema now strips PII keys (`email`, `firstName`, `lastName`, `userId`), control characters (incl. NUL, which Postgres JSONB rejects) and nesting beyond depth 8 before the byte-size check. `refId` is trimmed with min length 1; `note` has control characters removed. Tests cover stripping and empty refId rejection.

## Test Results
- Backend jest (`ai-report`, `account-deletion`, `seed-reviewer`): 3 suites, 36 tests pass.
- Frontend vitest (excluding `lib/rules/rank.bench.test.ts`): 63 files, 833 tests pass.
- `tsc --noEmit` clean (frontend and backend); frontend eslint clean on touched files; backend eslint 0 errors (121 pre-existing warnings).
- `next build` succeeds with warnings.

## Re-review of own diffs
- WR-05: server sanitiser mirrors client depth/PII rules, so legitimate client snapshots are unchanged. Behavior change: empty/whitespace `refId` now returns 400; the only caller (`report-suggestion.tsx`) passes an optional id, so an empty string is unlikely but worth a glance.
- WR-03: lock uses a parameterised `$queryRaw` (no injection). A concurrent create of owned rows now fails its FK after the delete commits, which is the desired outcome.
- WR-02: guard runs before password hashing and any write; no regression in the existing idempotency tests.
- WR-04: `release-checks.ts` is imported from `next.config.ts` and evaluated successfully in a real build.
- Unrelated working-tree changes (Phase 9 files, `.planning/STATE.md`) were not touched or committed.

_Fixer: Claude (gsd-code-fixer)_
