#!/usr/bin/env bash
# Non-interactive App Store screenshot capture from a SCREENSHOT build (never a shipping build).
#
#   cd mobile && bash scripts/build-ios.sh --shot && bash scripts/verify-bundle.sh --shot
#   REVIEWER_ENV=~/.appstoreconnect/reviewer.env \
#   scripts/store/capture-store-screenshots.sh <label> <simulator-device-type> <WxH> [app-path]
#   e.g. ... iPhone-6.9 com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max 1320x2868
#        ... iPad-13   com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB 2064x2752
#
# Creates a fresh simulator "Kumaun-Store-<label>" (deleted at the end unless KEEP_SIM=1), never touches
# other devices. Credentials come from the reviewer env file and reach the app only through
# SIMCTL_CHILD_KUMAUN_SHOT_* launch variables (see mobile/ios/App/App/SceneDelegate.swift).
# Output: docs/store/screenshots/<label>/NN-name.png
set -euo pipefail
LABEL="${1:?label}"; DEVTYPE="${2:?device type id}"; SIZE="${3:?WxH}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="${4:-$REPO/mobile/build/Build/Products/Debug-iphonesimulator/App.app}"
OUT="$REPO/docs/store/screenshots/$LABEL"
SETTLE="${SETTLE:-11}"
BUNDLE=app.kitcha.mobile
set -a; . "${REVIEWER_ENV:-$HOME/.appstoreconnect/reviewer.env}"; set +a
[ -d "$APP" ] || { echo "app not found: $APP" >&2; exit 1; }
mkdir -p "$OUT"

# name|route|tap-text|extra-delay-seconds
SCREENS=(
  "01-pantry-expiring|/pantry/?filter=expiring||0"
  "02-what-can-i-cook|/recipes/cook/||2"
  "03-recipe-detail|/recipes/|One-Pot Chicken and Rice|3"
  "04-meal-plan|/mealplans/||0"
  "05-shopping-list|/shopping/||0"
  "06-budget|/budget/||2"
  "07-recipes|/recipes/||2"
)

RUNTIME="$(xcrun simctl list runtimes available -j | /usr/bin/python3 -I -c 'import json,sys;r=[x for x in json.load(sys.stdin)["runtimes"] if x["identifier"].startswith("com.apple.CoreSimulator.SimRuntime.iOS")];r.sort(key=lambda x:[int(i) for i in x["version"].split(".")]);print(r[-1]["identifier"])')"
UDID="$(xcrun simctl create "Kumaun-Store-$LABEL" "$DEVTYPE" "$RUNTIME")"
cleanup() { xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true; [ "${KEEP_SIM:-0}" = 1 ] || xcrun simctl delete "$UDID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
xcrun simctl boot "$UDID"; xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl ui "$UDID" appearance light
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 --operatorName ""
xcrun simctl install "$UDID" "$APP"

for spec in "${SCREENS[@]}"; do
  IFS='|' read -r name route click extra <<<"$spec"
  SIMCTL_CHILD_KUMAUN_SHOT_EMAIL="$REVIEWER_EMAIL" SIMCTL_CHILD_KUMAUN_SHOT_PASSWORD="$REVIEWER_PASSWORD" \
  SIMCTL_CHILD_KUMAUN_SHOT_ROUTE="$route" SIMCTL_CHILD_KUMAUN_SHOT_CLICK="$click" \
  SIMCTL_CHILD_KUMAUN_SHOT_DELAY_MS="$(( (SETTLE - 3) * 1000 ))" \
    xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE" >/dev/null
  sleep $(( SETTLE + extra ))
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$name.png" >/dev/null 2>&1
  got="$(sips -g pixelWidth -g pixelHeight "$OUT/$name.png" | awk '/pixel/{printf "%s%s",sep,$2;sep="x"}')"
  [ "$got" = "$SIZE" ] || { echo "$name: expected $SIZE got $got" >&2; exit 1; }
  echo "captured $name ($got)"
done

# Post-process: App Store Connect rejects alpha, and Simulator PNGs carry a transparent rounded
# corner mask. A JPEG round-trip flattens it. iPad captures also show the iPadOS window-resize grip
# (system chrome) in the bottom-right corner, which is painted over with the pixels above it.
TMPJ="$(mktemp -t kumaun-shot).jpg"
for f in "$OUT"/*.png; do
  sips -s format jpeg -s formatOptions 100 "$f" --out "$TMPJ" >/dev/null
  sips -s format png "$TMPJ" --out "$f" >/dev/null
done
rm -f "$TMPJ"
case "$LABEL" in
  iPad*) swiftc -O "$REPO/scripts/store/clean-ipad-corner.swift" -o "${TMPDIR:-/tmp}/kumaun-cleancorner" && "${TMPDIR:-/tmp}/kumaun-cleancorner" "$OUT"/*.png ;;
esac
echo "done: $OUT"
