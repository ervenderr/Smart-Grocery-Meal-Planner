# Kitcha — Smart Grocery & Meal Planner (v2 improvement milestone)

## What This Is

Kitcha is a personal full-stack app (Next.js frontend, Express + Prisma + PostgreSQL backend) that tracks pantry inventory and expiry, manages recipes, plans weekly meals, builds shopping lists, tracks grocery budget, and offers AI suggestions through one env-configured OpenAI-compatible provider. It is a side project with low traffic (a handful of AI calls per day), so free tiers and zero-cost infrastructure are preferred over scale.

v1.0 took the already-working app and made it production-real: backend on Railway, a mobile-first installable experience, dependable free-tier AI, a persistent pantry-aware shopping list, and barcode / bought-it / cooked-it capture loops. Real-device verification of the mobile flows is still pending (see Deferred in STATE.md).

## Core Value

Someone standing in a kitchen or grocery aisle with a phone can quickly see what they have, what to cook, and what to buy — without wasting food or money.

## Requirements

### Validated

- ✓ Auth (JWT, bcrypt) — existing
- ✓ Pantry CRUD with categories, quantities, expiry — existing
- ✓ Recipe management, favorites, dietary filters, public sharing — existing
- ✓ Meal plans with items, cost estimation — existing
- ✓ Budget tracking, analytics, market prices — existing
- ✓ Notifications and alerts (expiry, budget, low stock) — existing
- ✓ Zapier webhook integration — existing
- ✓ Patched Next.js 16.4.0, Railway API + Postgres with spend cap, healthcheck, CORS allowlist, per-IP rate limits, Zod env, CI (DEP-01..09) — v1.0
- ✓ Validated, cached, quota-guarded AI via one OpenAI-compatible provider, diet/allergen enforcement, Open Food Facts and USDA lookups (AI-01..07) — v1.0 (browser check deferred)
- ✓ Mobile shell: bottom nav, 375px/44px/dvh, manifest and install hint, onboarding, empty states, currency (MOB-01..06) — v1.0 (real-iPhone walkthrough deferred)
- ✓ Persistent backend shopping lists with check-off, grouping, shopping mode, spend tracking (SHOP-01..05) — v1.0 (real-phone check deferred)
- ✓ Pantry-aware intelligence: ingredient parsing, merged and pantry-subtracted lists, staples, "Cook this first" (INT-01..05) — v1.0 (real-phone check deferred)
- ✓ Capture loops: barcode scan, bought-it, cooked-it, quick pantry edits (CAP-01..05) — v1.0 (real-device walkthrough deferred)

### Active

- [ ] Consolidated real-device verification pass for the five deferred v1.0 checks
- [ ] Offline service worker, read-only offline data, install/update prompts (OFF-01..04; needs `@serwist/turbopack` spike on real phones)
- [ ] URL recipe import (IMP-01)
- [ ] Household sharing (HH-01; requires schema re-key)

### Out of Scope

- Native iOS/Android app (Expo/React Native) — PWA covers the "mobile first" goal at a fraction of the cost
- Gemini, OpenRouter, Mistral, Cerebras, Spoonacular, Edamam — free-tier limits, training-data terms or ToS conflicts; Gemini SDK removed in v1.0
- Receipt OCR, grocery delivery integrations, calorie diary, social features — high cost or off core value
- Provider failover for AI — single provider with graceful degradation is enough at this traffic
- Paid LLM or data APIs — side project; free tiers only
- Moving the frontend host as part of this milestone — only the backend + DB move to Railway (frontend host stays as-is, e.g. Vercel)
- Multi-tenant scale work (queues, horizontal scaling) — traffic is tiny

## Context

Shipped v1.0 on 2026-10-10: 6 phases, 62 executed plans, about 19k lines TypeScript in `backend/src` and about 23.5k in `frontend`.
- `backend/` (Express 4, Prisma 5.22, TypeScript, Jest, Winston, Dockerfile + `entrypoint.sh` running `prisma migrate deploy`) is deployed on Railway with Railway Postgres; `render.yaml` is gone. `frontend/` (Next.js 16.4.0, React 19.3.0, Tailwind 4, Zustand, React Query, Zod) deploys on Vercel.
- Backend modules include ai, alert, analytics, auth, cook, food, marketprice, mealplan, notification, pantry, recipe, shopping, users, zapier, plus an intelligence core (units, quantity, canonical names, staples, pantry subtraction).
- AI: env-configured OpenAI-compatible provider (`AI_PROVIDER`/`AI_BASE_URL`/`AI_MODEL`/`AI_API_KEY`, Dahl default), Postgres cache, DB-backed daily quotas.
- Known tech debt: five deferred human verifications (Phase 2 browser check, 03-14, 04-12, 05-13, 06-13), frontend tests cover pure helpers only (no component tests), backend Jest needs live Postgres (CI provides it), stale `draft` status in VALIDATION.md files.
- Railway CLI is installed and logged in (account: Erven Idjad).

## Constraints

- **Budget**: Free tiers for AI and data APIs; Railway Hobby (~$5/mo, spend cap set) is the one accepted cost.
- **Traffic**: Very low AI call volume, so aggressive caching and simple quota guards are enough.
- **Tech stack**: Keep the existing Next.js + Express + Prisma + Postgres stack; no rewrite.
- **Coding rules**: Immutability, small files (<800 lines), validation at boundaries, tests with 80% coverage target (user global rules).
- **Secrets**: No secrets committed; set via Railway variables.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first = responsive PWA, not native app | Reuses existing Next.js code, one codebase, installable on phone | ✓ Good (manifest + install hint shipped; offline SW deferred) |
| Backend + Postgres on Railway; frontend host unchanged | User wants BE on Railway; Railway Postgres removes a separate DB vendor | ✓ Good (live, spend cap set; watch cost after a week on Hobby) |
| Compare free AI options, keep Gemini unless something clearly wins | Gemini already integrated; avoid churn without benefit | ⚠️ Revisit (superseded: one env-configured OpenAI-compatible provider, Gemini removed; real free quota still to confirm) |
| Gap analysis benchmarks competitors + reviews + own-app audit | User asked what others find we are missing | ✓ Good (drove barcode, onboarding, empty states, shopping UX, cook-first) |
| Single AI provider, no failover, graceful "unavailable" with quota refund | Free tiers, tiny traffic, simpler than multi-provider | ✓ Good |
| Exact Decimal quantities and unit families for ingredient math | No float drift when merging and subtracting | ✓ Good |
| One active shopping list per user via partial unique index | Race-safe lazy creation, simple UX | ✓ Good |
| Defer offline service worker and URL import to next milestone | Serwist/Turbopack needs real-phone spike | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-10 after v1.0 milestone*
