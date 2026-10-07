# Roadmap: Kitcha v2

## Overview

Kitcha already works locally. This milestone makes it real: patch the vulnerable Next.js and put the API on Railway, harden the AI layer on free tiers, make the app a phone-first installable experience, give shopping lists a real backend, make lists and recipes pantry-aware, and close the capture loops (barcode, bought it, cooked it) so the pantry stays accurate with little effort. Offline service worker and URL import are deferred to v2.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Secure Foundation & Railway Deploy** - Patched Next.js, live Railway API + Postgres, deployed frontend working end to end, CI
- [ ] **Phase 2: Reliable AI Suggestions** - Validated, cached, quota-guarded AI with Gemini primary and Groq fallback, plus food data lookups
- [ ] **Phase 3: Mobile-First Shell** - Bottom nav, 375px-ready screens, home-screen install, onboarding, empty states, currency
- [ ] **Phase 4: Persistent Shopping List** - Backend-stored lists with manual items, check-off, grouping, shopping mode, spend tracking
- [ ] **Phase 5: Pantry-Aware Intelligence** - Ingredient parsing, merged and pantry-subtracted lists, staples, "Cook this first"
- [ ] **Phase 6: Capture Loops** - Barcode scan, bought-it and cooked-it pantry updates, quick pantry edits

## Phase Details

### Phase 1: Secure Foundation & Railway Deploy
**Goal**: A patched frontend talks to a live, correctly configured Railway API so register, login and pantry CRUD work in production
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06, DEP-07, DEP-08, DEP-09
**Success Criteria** (what must be TRUE):
  1. The frontend builds cleanly on Next.js 16.4.0+ with matching React, and the production build fails if `NEXT_PUBLIC_API_URL` is missing
  2. User can open the deployed frontend, register, log in and create, edit and delete pantry items against the Railway API
  3. The Railway healthcheck passes on `/health` (200, no DB access, no HTTPS redirect) and the service restarts and shuts down cleanly on deploy
  4. Requests from non-allowlisted origins are rejected, the API refuses to start on missing or invalid env vars, and rate limits count per real client IP
  5. Every push runs lint, type-check and tests for backend and frontend in CI; `render.yaml` is gone, the seed script refuses production, and `.env.example` documents every variable
**Plans**: 6 plans
Plans:
- [ ] 01-01-PLAN.md — Backend CI baseline + deploy artefacts (lint config, pantry date fix, prisma pin, entrypoint exec, Dockerfile PORT, seed guard, render.yaml removed)
- [ ] 01-02-PLAN.md — Next.js 16.4.0 / React 19.3.0 upgrade, warn-level lint, frontend .env.example
- [ ] 01-03-PLAN.md — Tests-first backend hardening: Zod env, CORS allowlist + 403 guard + preview regex, trust proxy, early DB-free /health
- [ ] 01-04-PLAN.md — GitHub Actions CI (backend, frontend, docker-build), push, green on main
- [ ] 01-05-PLAN.md — Smoke test first, minimum Railway spend cap, provision `kitcha` + deploy kitcha-api, live API verified
- [ ] 01-06-PLAN.md — Vercel NEXT_PUBLIC_API_URL (checkpoint), production build guard, full smoke + browser pass
**UI hint**: yes

### Phase 2: Reliable AI Suggestions
**Goal**: Users get dependable, safe AI suggestions that stay within free-tier limits and survive provider failures
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Success Criteria** (what must be TRUE):
  1. User requests recipe suggestions, a meal plan or a substitution and receives a well-formed result every time (malformed AI output is repaired or rejected, never shown)
  2. Repeating an identical request returns instantly from cache without a provider call
  3. A user past the daily cap sees a clear quota message instead of an error, and a global daily cap protects the free tier
  4. When Gemini is rate-limited or down, the same request still succeeds via Groq without user action
  5. Suggestions never include ingredients that violate the user's dietary or allergen settings, and product and nutrition lookups from Open Food Facts and USDA show their attribution in the UI
**Plans**: TBD
**UI hint**: yes

### Phase 3: Mobile-First Shell
**Goal**: Someone with a phone can install Kitcha and use every screen comfortably with a thumb
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06
**Success Criteria** (what must be TRUE):
  1. On a phone, user navigates with a bottom bar and a "More" sheet; the sidebar appears only on large screens
  2. Every screen works at 375px width with no horizontal scroll, 44px touch targets, safe-area padding, and no content clipped by mobile browser chrome
  3. User can add Kitcha to the home screen on Android and iOS, and iOS users see a hint explaining how
  4. A new user completes a short onboarding (budget, dietary needs, first pantry items), and every list screen shows a useful empty state
  5. User can choose their currency and all amounts display in it
**Plans**: TBD
**UI hint**: yes

### Phase 4: Persistent Shopping List
**Goal**: Users keep real shopping lists that survive reloads and device changes and are easy to use in the store
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05
**Success Criteria** (what must be TRUE):
  1. User creates a list, reloads or switches device, and finds it intact
  2. User can add, edit, remove and check off items manually, and check-offs persist
  3. User can generate a list from a meal plan and it is saved as a list
  4. Items appear grouped by store category, and shopping mode keeps the screen awake with large check targets
  5. User sees estimated vs actual spend for a list
**Plans**: TBD
**UI hint**: yes

### Phase 5: Pantry-Aware Intelligence
**Goal**: Generated shopping lists contain only what the user actually needs to buy, and the app shows what to cook before food expires
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05
**Success Criteria** (what must be TRUE):
  1. Ingredient text is parsed into quantity, unit and canonical name, and quantities show no float drift
  2. A list generated from several recipes merges the same ingredient and converts compatible units (count units like cloves stay separate from volume and weight)
  3. Generated lists leave out what the pantry already covers
  4. User can mark staples such as salt and oil, and they never appear in generated lists
  5. A "Cook this first" view ranks the user's recipes by how many soon-to-expire pantry items they use, with no AI call
**Plans**: TBD
**UI hint**: yes

### Phase 6: Capture Loops
**Goal**: The pantry stays accurate with minimal typing as users scan, shop and cook
**Mode:** mvp
**Depends on**: Phase 4, Phase 5
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05
**Success Criteria** (what must be TRUE):
  1. User scans a barcode with the phone camera (library fallback on iOS) and the pantry form is prefilled from Open Food Facts
  2. When a scan fails, permission is denied or the product is unknown, user enters the item manually and the barcode is kept
  3. Checking off a shopping item can add it to the pantry ("bought it")
  4. Marking a recipe or meal as cooked deducts its ingredients from the pantry ("cooked it")
  5. User can adjust pantry quantity (+/-) and expiry directly from the list without opening a form
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6. Phases 2 and 3 touch separate code trees and can run in parallel after Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Foundation & Railway Deploy | 0/TBD | Not started | - |
| 2. Reliable AI Suggestions | 0/TBD | Not started | - |
| 3. Mobile-First Shell | 0/TBD | Not started | - |
| 4. Persistent Shopping List | 0/TBD | Not started | - |
| 5. Pantry-Aware Intelligence | 0/TBD | Not started | - |
| 6. Capture Loops | 0/TBD | Not started | - |
