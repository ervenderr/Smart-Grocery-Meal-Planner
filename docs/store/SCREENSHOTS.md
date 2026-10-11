# Screenshots

## Required sizes (verified 2026-10-11)

Source: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications

- 1 to 10 screenshots per size, JPEG/JPG/PNG, no alpha channel or transparency.
- Accepted portrait pixel sizes: Dynamic Island large 1320x2868, 1290x2796 or 1260x2736; Dynamic Island medium 1179x2556 or 1206x2622; Face ID large 1284x2778 or 1242x2688 (older fallback).
- Apple's page marks Dynamic Island medium as required, and large as required unless you provide Dynamic Island large. It does not use inch labels; the script supplies both a 6.9-inch class (1320x2868) and a 6.3-inch class (1206x2622). Smaller sizes are scaled from larger ones if missing.
- iPad (owner decision: iPad stays supported, `TARGETED_DEVICE_FAMILY = "1,2"`): 13-inch display is REQUIRED, accepted 2064x2752 or 2048x2732 portrait, 2752x2064 or 2732x2048 landscape. 12.9-inch (2048x2732) and 11-inch (e.g. 1488x2266, 1668x2420, 1668x2388, 1640x2360) are optional and scaled from 13-inch. Same 1 to 10 images, no alpha. Re-verified 2026-10-11 at the Apple page above. The script captures 2064x2752 portrait.

## How to capture

```
scripts/store/capture-screenshots.sh /path/to/Kitcha.app all     # both iPhone sizes and iPad 13-inch
scripts/store/capture-screenshots.sh /path/to/Kitcha.app ipad    # iPad only
KITCHA_IPAD_ORIENTATION=landscape scripts/store/capture-screenshots.sh /path/to/Kitcha.app ipad   # optional landscape set (2752x2064)
```

It creates its own simulators (`Kitcha-Store-6.9-inch`, `Kitcha-Store-6.3-inch`, `Kitcha-Store-iPad-13`, device type "iPad Pro 13-inch", newest match), sets status bar to 9:41, full battery, full bars, installs the given built simulator `.app`, launches `app.kitcha.mobile`, and asks you to navigate to each screen then press Enter. Output goes to `docs/store/screenshots/<label>/NN-name.png`. Deep links are not possible yet (no URL scheme registered). Use the seeded demo account (`npm run seed:reviewer`, local DB only), never a real account. Not yet run (instructed not to touch the booted device).

Pre-capture: set Philippine peso currency, tidy demo data so item names are realistic (Filipino and common pantry items), and check that no real email or name is visible. Add a "Frame/caption" pass afterwards (Figma or a framing tool); raw Simulator PNGs are the input, captions below go on the framed image. Captions are marketing text on the image, not part of the app.

## Screens and captions (8, App Store order)

| # | File name | Screen | Caption (short, big text) |
|---|-----------|--------|---------------------------|
| 1 | 01-pantry-expiring | Pantry list with "expiring soon" items highlighted | See what expires before it goes to waste |
| 2 | 02-barcode-scan | Barcode scanner with a product recognised | Scan a barcode to add it in seconds |
| 3 | 03-what-can-i-cook | "What can I cook?" ranked recipes with match percent | Cook what you already have |
| 4 | 04-recipe-detail | Recipe with servings scaler and missing ingredients | Scale servings, spot what is missing |
| 5 | 05-meal-plan | Weekly meal plan | Plan your week in a few taps |
| 6 | 06-shopping-list | Shopping list mid-trip with checked items | A shopping list that knows your pantry |
| 7 | 07-budget | Budget/spending chart in PHP | Keep your grocery budget in check |
| 8 | 08-offline | Offline banner with pantry still visible | Works even without a signal |

Notes:
- Screens 1-3 carry the story (research note 04: first three screenshots matter most).
- Screen 8 depends on Phase 11 (offline core), which is in 1.0 scope. Replace with the AI suggestion screen (with the AI-generated badge and consent explained) if offline slips. Do not show AI output without its AI label in a screenshot.
- Do not show a price, "free forever", or features that are not in the build (Guideline 2.3, metadata accuracy). Phase 12 is in 1.0 scope, so add the optional 9th: the Kitcha Full unlock sheet (also reused as the IAP review screenshot, see IAP.md).
- Do not include the Open Food Facts logo in screenshots without checking its brand terms; text attribution lives in the app.
- Optional later: 15-30 second app preview video per size.

## iPad screenshots

Use the same 8 screens and captions, captured on the 13-inch iPad simulator (`docs/store/screenshots/iPad-13/`, landscape in `iPad-13-landscape/`). Capture them in the layout iPad actually shows (sidebar or wide layout, not a stretched phone layout); if any screen looks like a stretched phone UI, fix the layout before capturing (see iPad QA in SUBMISSION-CHECKLIST.md). Minimum for review is the 13-inch portrait set; landscape is optional.
