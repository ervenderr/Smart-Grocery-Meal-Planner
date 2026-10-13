# Reply to App Review: Guideline 2.1 Information Needed (1.0, 2026-10-12)

Send this in App Store Connect > App Review > Resolution Center, and paste the same text into App Review Information > Notes. Attach the screen recording (item 1) to the reply.

---

Hello App Review team,

Thank you for the review. Answers to your seven items follow.

**1. Screen recording** (physical iPhone, latest iOS, attached). It starts at app launch and shows: sign-up, login, onboarding, adding a pantry item, what-can-I-cook, a meal plan, the shopping list, the AI consent sheet and the "Report suggestion" action, and account deletion (Settings > Data > Delete account).

**2. Purpose and audience.** Kumaun helps people who cook at home see what is in their kitchen, use food before it expires, decide what to cook, and shop without overspending. It tracks pantry items and expiry dates, suggests recipes from what the user already has, builds weekly meal plans and shopping lists, and tracks grocery spending. It works offline. The audience is individuals and households who want to waste less food and spend less.

**3. How to access the main features.** Sign in with the demo account in the Sign-in required fields of App Review Information (email `kumaun.review@example.com`; the password is in that same section). The account is already onboarded and holds sample pantry items, recipes, a shopping list and a meal plan. Tabs: Home, Pantry, Recipes, Meal Plans, Shopping. No files are needed. You can also create a new account with any email and password.

**4. External services.**
- Hosting and database: Railway (API and PostgreSQL) and Vercel (web and legal pages).
- AI suggestions: Dahl Inference (model MiniMaxAI/MiniMax-M2.7). Used only after the user accepts the in-app AI consent. Only ingredient names, quantities and dietary tags are sent; no name, email or address.
- Barcode lookup: Open Food Facts.
- Payment: the one-time purchase of the app itself through the App Store. There is no other payment processor.
- Sign-in is our own email and password system. There is no third-party login.

**5. Regional differences.** The app works the same in every region. Only the app price follows App Store pricing for each storefront, and users can choose their display currency in Settings.

**6. Regulated industry or protected material.** None. Kumaun is not a medical or health-care service. AI suggestions carry an "AI-generated" label and a general-information disclaimer, and users can report a suggestion in the app. There is no user-to-user content, so there is nothing to block. All recipes are created by the user or by the AI feature.

**7. In-App Purchase.** None. Kumaun is a paid download (USD 9.99) with no in-app purchases, subscriptions or free tier. Every feature is available from first launch, and AI suggestions are limited to 40 a day and 600 a month per user.

Account deletion: Settings > Data > Delete account (password required, all data removed immediately).

Privacy Policy: https://kitcha-ai.vercel.app/privacy. Support: https://kitcha-ai.vercel.app/support.

Thank you,
Erven Idjad
