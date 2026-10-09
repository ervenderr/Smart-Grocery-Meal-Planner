---
phase: 06-capture-loops
plan: 02
subsystem: frontend-deps
tags: [barcode-detector, zxing-wasm, dependency, supply-chain]
requires: []
provides: ["barcode-detector 3.2.2 exact-pinned (not yet imported)"]
affects: [06-11]
tech-stack:
  added: ["barcode-detector@3.2.2", "zxing-wasm@3.1.3 (transitive)"]
key-files:
  modified: [frontend/package.json, frontend/package-lock.json]
requirements: [CAP-01]
completed: 2026-10-09
---

# Phase 6 Plan 02: barcode-detector install Summary

barcode-detector 3.2.2 installed with an exact pin and `--ignore-scripts`, after a human legitimacy approval, with a hand-merged lockfile that removes nothing.

## Task 1: Human legitimacy gate (done before this executor ran)

The user was shown the npm registry evidence and answered "Approve install":
- license MIT; maintainer sec-ant; repository github.com/Sec-ant/barcode-detector
- last modified 2026-08-16
- sole dependency zxing-wasm@3.1.3 (MIT, same maintainer)
- no preinstall/install/postinstall scripts
- Nothing was installed before the verdict.

## Task 2: Install (commit see below)

- Commit: `chore(06-02): add barcode-detector 3.2.2 (exact pin)`
- package.json: `"barcode-detector": "3.2.2"` (no caret).
- Lockfile diff: 56 insertions, 0 deletions, 0 removed `node_modules/` entries. Added: barcode-detector, zxing-wasm, @types/emscripten, type-fest, tagged-tag, plus the root dependency line.
- `exports` include `./ponyfill` (also `.`, `./polyfill`, `./pure`, `./side-effects`).
- No source file imports the package (06-11 adds the lazy import).
- `npm ci --ignore-scripts --dry-run` passed; a real `npm ci --ignore-scripts` also passed.
- Lint: 0 errors (115 pre-existing warnings). Tests: 34 files, 433 tests passed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Lockfile churn on plain install.** `npm install` rewrote the lockfile (57 insertions, 516 deletions, 26 removed entries, the platform-binding problem from 03-13). Restored the saved lockfile and hand-merged only the new entries in sorted position plus the root dependency line.

**2. [Rule 3 - Blocking] Local node_modules lost the rolldown darwin binding** after the first install, so vitest failed. Resynced with `npm ci --ignore-scripts` from the clean lockfile; tests then passed. node_modules is untracked.

## Deferred Issues

- `npm run type-check` and `next build` fail with `app/(app)/shopping/page.tsx(72,27): TS2345` (string vs `FinishShoppingVariables`). This is not from this plan: another executor's uncommitted in-progress work (06-04 finish-shopping hook/types changes) is in the shared checkout. The build with a dummy `NEXT_PUBLIC_API_URL` therefore could not be confirmed green here; re-run once that plan lands. This plan changes no source files.

## Self-Check: PASSED
