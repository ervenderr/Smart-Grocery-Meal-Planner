# Kitcha — Smart Grocery & Meal Planner (v2 improvement milestone)

## What This Is

Kitcha is a personal full-stack app (Next.js frontend, Express + Prisma + PostgreSQL backend) that tracks pantry inventory and expiry, manages recipes, plans weekly meals, builds shopping lists, tracks grocery budget, and offers AI suggestions (currently Google Gemini). It is a side project with low traffic (a handful of AI calls per day), so free tiers and zero-cost infrastructure are preferred over scale.

This milestone takes the already-working app and makes it production-real: deployed backend on Railway, mobile-first PWA experience, cheaper/better AI suggestions, and closing the feature/process gaps that users of similar apps complain about.

## Core Value

Someone standing in a kitchen or grocery aisle with a phone can quickly see what they have, what to cook, and what to buy — without wasting food or money.

## Requirements

### Validated

<!-- Inferred from existing code (brownfield). -->

- ✓ Auth (JWT, bcrypt) — existing
- ✓ Pantry CRUD with categories, quantities, expiry — existing
- ✓ Recipe management, favorites, dietary filters, public sharing — existing
- ✓ Meal plans with items, cost estimation — existing
- ✓ Shopping lists + shopping history — existing
- ✓ Budget tracking, analytics, market prices — existing
- ✓ Notifications and alerts (expiry, budget, low stock) — existing
- ✓ Gemini-powered recipe suggestions / meal plan generation / substitutions — existing
- ✓ Zapier webhook integration — existing

### Active

- [ ] Backend deployed to Railway (project + Railway Postgres, migrations on deploy, env vars, health check, CORS for frontend) via the Railway CLI
- [ ] Mobile-first redesign of the Next.js frontend: bottom navigation, thumb-friendly touch targets, mobile layouts for every screen, installable PWA (manifest, icons, offline shell)
- [ ] AI suggestions research and upgrade: compare free LLM providers (Gemini free tier vs Groq/OpenRouter/Mistral etc.) and free food data APIs (TheMealDB, Open Food Facts, USDA FoodData, Spoonacular free tier); adopt what clearly wins; add caching and rate/quota guards since usage is low
- [ ] Gap analysis from competitor apps (Mealime, Paprika, Samsung Food, KitchenPal, etc.), app-store/Reddit reviews, and an audit of Kitcha's own UX flows; turn findings into prioritized requirements (e.g. barcode scan, onboarding, empty states, shopping-list UX, expiry-driven recipes)
- [ ] Deployment/process hygiene: CI, env documentation, replace Render config with Railway config, production readiness checklist

### Out of Scope

- Native iOS/Android app (Expo/React Native) — PWA covers the "mobile first" goal at a fraction of the cost
- Paid LLM or data APIs — side project; free tiers only
- Moving the frontend host as part of this milestone — only the backend + DB move to Railway (frontend host stays as-is, e.g. Vercel)
- Multi-tenant scale work (queues, horizontal scaling) — traffic is tiny

## Context

- Brownfield repo: `backend/` (Express 4, Prisma 5.22, TypeScript, Jest, Winston, Dockerfile + `entrypoint.sh` running `prisma migrate deploy`, `render.yaml` from a previous Render target), `frontend/` (Next.js 16.0.2 pinned, vulnerable, must upgrade; Tailwind 4, Zustand, React Hook Form, Zod, Axios, Lucide), `project details/` (original specs).
- Backend modules: ai, alert, analytics, auth, marketprice, mealplan, notification, pantry, recipe, users, zapier. AI lives in `backend/src/services/ai.service.ts` and `backend/src/modules/ai/`.
- Backend listens on `PORT` (Dockerfile defaults to 10000); required env: `DATABASE_URL`, `JWT_SECRET`, `PORT`; optional `GEMINI_AI_API_KEY`, `SPOONACULAR_API_KEY`, `FRONTEND_URL`, `CORS_ORIGIN`.
- Railway CLI is installed and logged in (account: Erven Idjad). Deployment will be done through it.
- Last work in git: Zapier integration (event dispatching, docs).

## Constraints

- **Budget**: Free tiers for AI and data APIs; Railway Hobby (~$5/mo, spend cap set) is the one accepted cost.
- **Traffic**: Very low AI call volume, so aggressive caching and simple quota guards are enough.
- **Tech stack**: Keep the existing Next.js + Express + Prisma + Postgres stack; no rewrite.
- **Coding rules**: Immutability, small files (<800 lines), validation at boundaries, tests with 80% coverage target (user global rules).
- **Secrets**: No secrets committed; set via Railway variables.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first = responsive PWA, not native app | Reuses existing Next.js code, one codebase, installable on phone | — Pending |
| Backend + Postgres on Railway; frontend host unchanged | User wants BE on Railway; Railway Postgres removes a separate DB vendor | — Pending |
| Compare free AI options, keep Gemini unless something clearly wins | Gemini already integrated; avoid churn without benefit | — Pending |
| Gap analysis benchmarks competitors + reviews + own-app audit | User asked what others find we are missing | — Pending |

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
*Last updated: 2026-10-08 after initialization*
