# App Store Listing: Kumaun (iPhone and iPad)

Status: DRAFT for Phase 14. Verify limits with `node scripts/store/check-listing-limits.mjs` after any edit.
Every fenced block under a heading ending in `(max N)` is length-checked by that script.

Apple limits verified 2026-10-11: name 2-30 and subtitle <=30 at https://developer.apple.com/help/app-store-connect/reference/app-information/app-information . Promotional text 170, description 4000, keywords 100 and What's New 4000 come from Apple's published App Store Connect limits as I know them; Apple's page I could fetch did not state them, so UNVERIFIED on Apple's side (the App Store Connect form enforces them anyway).

## Name

Name is **Kumaun** (owner decision: "Kitcha" was taken on the App Store; see `NAME-CHECK.md`). Clearance (App Store search and trademark) for "Kumaun" is still to be run by the owner before submit; the fallbacks below are contingency. Apple requires unique names (2-30 chars). Options, in order of preference (the first is the chosen name):

1. `Kumaun: Pantry & Meal Planner` (29 chars) if the name is available in App Store Connect. A descriptive suffix does not remove the trademark/confusion risk (Guideline 5.2); this is the owner's decision.
2. `Kumaun` alone, if available.
3. A coined fallback from NAME-CHECK.md (Larderly, Pantrio, Fridgely, Mealoop, Cookmarq, Snackpad). If renamed, bundle id `app.kitcha.mobile` can stay (bundle id is invisible to users), but the product id in IAP.md shares its prefix.

### Name (max 30)
```text
Kumaun: Pantry & Meal Planner
```

### Subtitle (max 30)
```text
Expiry alerts & grocery list
```

### Promotional text (max 170)
```text
Scan what you buy, see what expires soon, and get ideas for dinner from what is already in your kitchen. Works offline, too.
```

### Keywords (max 100)
```text
food waste,fridge,recipes,barcode,scanner,shopping,budget,inventory,kitchen,cook,offline,leftovers
```

Keyword rules applied: comma separated, no spaces after commas, no words repeated from the name or subtitle (pantry, meal, planner, expiry, grocery, list, alerts are already indexed), no competitor names, no app name.

### Description (max 4000)
```text
Kumaun helps you see what you have, decide what to cook, and buy only what you need.

KNOW WHAT IS IN YOUR KITCHEN
- Keep a pantry list with quantities, locations and expiry dates.
- See what is expiring soon at a glance and get reminders before food goes to waste.
- Scan a product barcode with your camera to add it fast. Product data comes from Open Food Facts.

COOK WHAT YOU ALREADY HAVE
- "What can I cook?" ranks your recipes by how much of each one you already have, right on your device, even without a connection.
- Save your own recipes, scale servings, and see which ingredients you are missing.
- Get simple ingredient substitution ideas.

PLAN THE WEEK
- Build a weekly meal plan from your recipes and mark meals as cooked.
- Turn a plan into a shopping list. Items you already have are subtracted for you.

SHOP SMARTER
- Check items off as you shop, with quantities merged when you add the same thing twice.
- Finish a trip and your purchases go straight into your pantry.
- Set a grocery budget and track what you spend over time.

WORKS WHEN YOUR SIGNAL DOES NOT
- View your pantry, shopping list, recipes and meal plans offline. Changes you make without a connection are saved and sync when you are back online. Barcode scanning and "What can I cook?" work offline too. AI suggestions need a connection.

OPTIONAL AI SUGGESTIONS
- Ask for recipe ideas and meal plans based on your pantry and dietary preferences.
- AI is off until you say yes. Before the first use, Kumaun explains what is sent (ingredient names, quantities and dietary tags only, never your name or email) and asks for your permission. You can keep using every other feature without it.
- AI results are clearly labelled, can contain mistakes, and can be reported from inside the app.

PAY ONCE, USE EVERYTHING
- One price, no subscription, no in-app purchases, no ads.
- Barcode scanning, expiry reminders, recipes, meal plans, shopping lists, an unlimited pantry and optional AI suggestions are all included.

YOUR DATA
- You can delete your account and all of its data from Settings at any time.
- No ads, no tracking, and we do not sell your data.

Kumaun is not medical or dietary advice. Always check ingredient labels if you have allergies.

Product information provided by Open Food Facts (ODbL).
```

Honesty notes (do not paste into App Store Connect):
- Version 1.0 scope (owner decision 2026-10-11): ships Phase 11 offline support and the Phase 12 one-time Kumaun Full unlock. On-device AI (Phase 13) is DEFERRED to 1.1, so this listing makes no on-device AI or Apple Intelligence claim; do not add one. AI suggestions use the server provider with explicit consent and need a connection.
- Offline claims must match what Phase 11 delivers: offline viewing, edits that sync later, scanning, rules-based "What can I cook?". Offline barcode scanning means the camera scan works; the product lookup itself needs a connection unless Phase 11 caches it. Re-verify each claim on the shipping build and soften the wording if not.
- "FREE TO START" last bullets (25 items, Kumaun Full): Phase 12 is in 1.0 scope but not built as of 2026-10-11. Remove the Kumaun Full bullet if Phase 12 does not ship in the same version, otherwise reviewers will look for a purchase that does not exist. The $9.99 price is in IAP.md, not in this text.
- "Nutrition data from USDA": remove the line unless USDA data is actually shown in the shipped UI.
- "Finish a trip", "Items you already have are subtracted": built in v1.0 phases 4-5 per ROADMAP; confirm on device.
- Do not state a price in the description (Apple discourages pricing text in metadata; the store shows the price).

### What's New (max 4000)
```text
Welcome to Kumaun on iPhone. Track your pantry and expiry dates, scan barcodes, plan meals, build shopping lists and keep an eye on your grocery budget.
```

## Other fields

| Field | Value |
|-------|-------|
| Primary category | Food & Drink |
| Secondary category | Lifestyle (optional; Productivity is the alternative) |
| Platform | iPhone and iPad (owner decision: keep `TARGETED_DEVICE_FAMILY = "1,2"`; see iPad note below) |
| Price | Paid upfront, USD 9.99 (decision 2026-10-13: no free tier, no in-app purchases; IAP.md is historical) |
| Availability | All regions you can legally serve; start with Philippines plus the countries you test in. The AI provider is the env-configured OpenAI-compatible one (label default `Dahl Inference`); check its terms for the EEA/UK before enabling AI there. |
| Copyright | `2026 <Your Legal Name>` (individual enrollment: your legal name, shown as seller) |
| Support URL | `https://<vercel-host>/support` (exists in frontend/app/support) |
| Marketing URL (optional) | `https://<vercel-host>/` |
| Privacy Policy URL (required) | `https://<vercel-host>/privacy` (exists in frontend/app/privacy; must match PRIVACY-LABELS.md) |
| Terms of Use / EULA | `https://<vercel-host>/terms` as custom EULA, or leave the standard Apple EULA |
| Version | 1.0.0 |
| Content rights | Declares use of third-party content: Open Food Facts data and images (attribution in app) |
| Export compliance | `ITSAppUsesNonExemptEncryption` = NO (HTTPS only). NOT currently in Info.plist (checked); add it or answer the prompt on every upload. |
| Sign-in | Email and password. Demo account: see REVIEW-NOTES.md |

iPad note: owner decision is to keep iPad supported (`TARGETED_DEVICE_FAMILY = "1,2"`). This requires 13-inch iPad screenshots (2064x2752, see SCREENSHOTS.md) and iPad review, and the iPad QA checklist in SUBMISSION-CHECKLIST.md must pass first.

## Age rating answers

Apple's questionnaire (categories verified at https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions ): answer **None** for every item except the below.

| Question group | Answer | Reason |
|----------------|--------|--------|
| Parental controls, age assurance | None | |
| Unrestricted web access | None | Only own bundled pages; Open Food Facts links, if any, should open in the system browser, not an in-app browser. Re-check at submission. |
| User-generated content | None | Recipes are private to the account; nothing is shared publicly (Guideline 1.2 not triggered). Revisit if public sharing is added. |
| Messaging and chat / social media | None | |
| Advertising | None | |
| Health or wellness topics | Infrequent (conservative) | Calorie and nutrition numbers, dietary filters. Apple lists "calorie tracking, dieting" as Health or Wellness, which gives 9+. Answering None is arguably defensible, but 9+ is the safe answer. |
| Medical or treatment information | None | No treatment content. Keep the disclaimers. |
| Alcohol, tobacco, drugs | None | Recipes could mention wine as an ingredient; AI text is filtered by dietary rules but not for this. If concerned choose Infrequent (13+). |
| Gambling, contests, loot boxes | None | |
| Violence, sexual content, profanity, horror | None | |

Expected result: 4+ (None) or 9+ (with Health/Wellness infrequent). The App Store Connect tool computes the final rating; AI-generated text may prompt extra questions (UNVERIFIED, the page does not mention AI).

## Localization

Primary language: English (U.S.). Optional later: English (Philippines), Filipino.
