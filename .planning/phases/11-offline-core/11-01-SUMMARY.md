---
phase: 11-offline-core
plan: 01
subsystem: offline-storage
tags: [sqlite, migrations, uuid, tdd]
requires: []
provides: [SqlDb seam, offline schema + migrations, node:sqlite test adapter, newId]
affects: [11-02+]
tech-stack:
  added: []
  patterns: [SqlDb interface seam, forward-only outbox migrations, cache-only wipe]
key-files:
  created:
    - frontend/lib/offline/sql/types.ts
    - frontend/lib/offline/sql/schema.ts
    - frontend/lib/offline/sql/migrations.ts
    - frontend/lib/offline/sql/migrations.test.ts
    - frontend/lib/offline/sql/node-sqldb.test-helper.ts
    - frontend/lib/offline/sql/node-sqldb.test.ts
    - frontend/lib/offline/ids.ts
    - frontend/lib/offline/ids.test.ts
decisions:
  - Cache tables wiped on version bump; outbox and pending_scan never dropped; downgrade throws OutboxDowngradeError
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 01: SqlDb seam, schema, migrations, ids Summary

SqlDb interface with versioned SQLite schema (cache wipe on bump, outbox forward-only), a node:sqlite test adapter, and a getRandomValues-backed UUID v4 generator.

## Commits
- dda2f99 test: SqlDb adapter and newId (RED)
- 414432c feat: node adapter and newId (GREEN)
- test: migration tests (RED)
- feat: schema and migrations (GREEN)

## Verification
- 20 tests passing (ids 6, node-sqldb 6, migrations 8)
- Coverage lib/offline/sql + ids.ts: 96.72% lines, 91.3% branches
- `tsc --noEmit` exit 0; lint 0 errors (125 pre-existing warnings)
- No DROP TABLE on outbox/pending_scan; no Math.random in ids.ts; test helper not imported by app code
- No ambient node:sqlite declaration needed (@types/node ships it)

## Deviations from Plan
None.

## Self-Check: PASSED
