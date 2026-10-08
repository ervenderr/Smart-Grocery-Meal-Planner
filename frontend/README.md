# Kitcha - Frontend

Mobile-first PWA built with Next.js 16.4 (App Router), React 19.3, TypeScript and Tailwind CSS 4. See the [root README](../README.md) for the product overview and deployment notes.

## Setup

Requirements: Node.js 22, npm, and the [backend](../backend/README.md) running (default `http://localhost:3001`).

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev                    # http://localhost:3000
```

Use the browser device toolbar at 390x844 to see the phone layout (bottom navigation); wider screens get a sidebar.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest (`lib/**/*.test.ts`) |

## Environment

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend origin without trailing slash. Inlined at build time, so on Vercel set it for Production and Preview and redeploy after changes. Public, never put secrets in it. |

## Structure

```
frontend/
├── app/
│   ├── (auth)/              login, signup
│   ├── (app)/               dashboard, pantry, recipes, mealplans, shopping, budget,
│   │                        analytics, alerts, settings, profile, help (app shell + bottom nav)
│   ├── manifest.ts          PWA manifest (standalone, start_url /dashboard)
│   └── layout.tsx, page.tsx
├── components/              feature folders: pantry, recipes, mealplans, shopping, onboarding,
│                            ai, food, dashboard (bottom-nav, more-sheet), pwa, settings, ui
├── lib/                     api clients (axios), react-query, currency, shopping, onboarding,
│                            navigation, hooks, stores
├── types/                   shared TypeScript types
└── public/                  icons (192/512/maskable), apple-touch-icon, logos
```

## Notes

- **PWA**: installable on Android and iOS (iOS shows an "Add to Home Screen" hint). There is no service worker or offline mode yet.
- **Currency**: amounts are formatted in the user's chosen currency (default PHP) through `lib/currency`; the API stores integer cents.
- **Shopping mode** uses the Screen Wake Lock API where available.
- **Server state** lives in TanStack Query; small client state in Zustand.

## Deployment

Vercel with Root Directory `frontend` and `NEXT_PUBLIC_API_URL` pointing at the Railway API. Add the Vercel URL to the API's `CORS_ORIGIN`.
