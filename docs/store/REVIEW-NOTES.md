# App Review Notes (Kitcha)

Paste the relevant parts into App Store Connect > App Review Information (and the Play Console app access section). No secrets live in this file.

## Demo account

- Email: the value of `REVIEWER_EMAIL` used when seeding (default `app-review@kitcha-demo.com`).
- Password (set in App Store Connect): entered in App Store Connect > App Review Information. It is not stored in this repo.

## How to seed it

From `backend/`, with a local database:

```
REVIEWER_PASSWORD=<strong password> npm run seed:reviewer
```

The seed is idempotent (re-running resets the demo data), refuses `NODE_ENV=production` and non-local databases, and prints only the email and counts. The seed also refuses to run if `REVIEWER_EMAIL` already belongs to an account that is not a seeded reviewer (name "App Reviewer"), because seeding deletes that account's data.

### Production procedure (owner-approved, not yet done)

1. Run only from a trusted shell, never in CI.
2. Use a dedicated reviewer email (default `app-review@kitcha-demo.com`), never a real user's address.
3. The seed refuses `NODE_ENV=production`, so run it with `NODE_ENV=development ALLOW_SEED=true DATABASE_URL=<target>` and double-check the `DATABASE_URL` host before pressing enter. Do not leave `ALLOW_SEED` set in any shell profile.
4. Confirm the printed email and counts, then unset the variables.

## What to try

The demo account has onboarding completed and is pre-populated:

- Pantry: 8 items, several expiring within days.
- Recipes: 3 sample recipes.
- Shopping list: one active list with 5 items.
- Meal plan: the current week with 4 planned meals.

## AI features

- The demo account has NOT given AI consent. The first time an AI feature is used, the "Use AI features?" consent sheet is shown by design. Accepting enables AI suggestions; declining leaves the rest of the app fully usable.
- AI responses carry an "AI-generated" badge, a health/nutrition disclaimer, and a "Report suggestion" action.
- AI-generated content is always labelled. Only ingredient names, quantities and dietary tags are sent to the AI provider; no name, email or address.
- Each user has a daily AI request limit (default 20). Hitting it shows a friendly message.

## Account deletion

Where: Settings > Data > Delete account. The password is required to confirm, and all of the user's data is removed immediately.

## Legal and support URLs

- Privacy Policy: `https://<vercel-host>/privacy` (owner to fill in)
- Terms of Use: `https://<vercel-host>/terms` (owner to fill in)
- Support: `https://<vercel-host>/support` (owner to fill in)

## Third-party data

Barcode lookups use Open Food Facts (data under the ODbL, images CC BY-SA). Attribution is shown in the app and on the legal pages.

## Backend

API base URL: `https://<railway-api-host>` (owner to fill in after deploy). Health check: `GET /health`.
