#!/usr/bin/env bash
# Capture App Store screenshots from dedicated iPhone Simulators.
#
# Usage:
#   scripts/store/capture-screenshots.sh /path/to/App.app [6.9|6.3|all]
#
# - The .app must be an ALREADY BUILT simulator build (this script never builds).
# - It creates and uses its OWN simulators named "Kitcha-Store-<size>" so it never
#   touches whatever device you are developing on. Nothing else is erased or shut down.
# - Navigation is interactive by default: the app has no URL scheme registered
#   (no CFBundleURLTypes in Info.plist, checked 2026-10-11), so `simctl openurl`
#   deep links cannot work yet. The script pauses per screen so you can navigate
#   (log in with the REVIEWER/demo account, never a real account), then captures.
#   Set KITCHA_SCREEN_URLS_FILE to a file of "name|url" lines to use deep links
#   once a scheme exists.
# - Output: docs/store/screenshots/<device-label>/NN-name.png
#
# Environment:
#   KITCHA_BUNDLE_ID   default app.kitcha.mobile
#   KITCHA_ASSUME_YES  set to 1 to skip the interactive pause (captures whatever is on screen)
#   KITCHA_SETTLE_SECS default 2 (wait after launch/openurl before capture)
#
# Required App Store Connect sizes (verified 2026-10-11 at
# https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications):
#   Dynamic Island large  1320x2868 (or 1290x2796, 1260x2736)  -> iPhone 17 Pro Max / 16 Pro Max
#   Dynamic Island medium 1206x2622 (or 1179x2556)              -> iPhone 17 Pro / 16 Pro
#   Apple's page says medium is required and large is required unless you supply
#   Dynamic Island large; supplying both avoids any ambiguity.
set -euo pipefail

APP_PATH="${1:-}"
WHICH="${2:-all}"
BUNDLE_ID="${KITCHA_BUNDLE_ID:-app.kitcha.mobile}"
SETTLE="${KITCHA_SETTLE_SECS:-2}"
ASSUME_YES="${KITCHA_ASSUME_YES:-0}"
URLS_FILE="${KITCHA_SCREEN_URLS_FILE:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ROOT="$REPO_ROOT/docs/store/screenshots"

# label|simulator device type name|expected WxH
TARGETS=(
  "6.9-inch|iPhone 17 Pro Max|1320x2868"
  "6.3-inch|iPhone 17 Pro|1206x2622"
)

# Screens, in App Store order. See docs/store/SCREENSHOTS.md for captions.
SCREENS=(
  "pantry-expiring"
  "barcode-scan"
  "what-can-i-cook"
  "recipe-detail"
  "meal-plan"
  "shopping-list"
  "budget"
  "offline"
)

die() { echo "error: $*" >&2; exit 1; }

[[ -n "$APP_PATH" ]] || die "usage: $0 /path/to/App.app [6.9|6.3|all]"
[[ -d "$APP_PATH" ]] || die "app bundle not found: $APP_PATH"
[[ -f "$APP_PATH/Info.plist" ]] || die "not an app bundle (no Info.plist): $APP_PATH"
command -v xcrun >/dev/null || die "xcrun not found (install Xcode)"

latest_runtime() {
  # Newest available iOS runtime identifier.
  xcrun simctl list runtimes available -j |
    /usr/bin/python3 -I -c '
import json,sys
rs=[r for r in json.load(sys.stdin)["runtimes"] if r["identifier"].startswith("com.apple.CoreSimulator.SimRuntime.iOS")]
rs.sort(key=lambda r:[int(x) for x in r["version"].split(".")])
print(rs[-1]["identifier"] if rs else "")'
}

device_type_id() {
  xcrun simctl list devicetypes -j |
    NAME="$1" /usr/bin/python3 -I -c '
import json,sys,os
n=os.environ["NAME"]
for d in json.load(sys.stdin)["devicetypes"]:
    if d["name"]==n: print(d["identifier"]); break'
}

find_or_create_sim() {
  local sim_name="$1" type_name="$2" udid
  udid="$(xcrun simctl list devices -j |
    NAME="$sim_name" /usr/bin/python3 -I -c '
import json,sys,os
n=os.environ["NAME"]
for rt,ds in json.load(sys.stdin)["devices"].items():
    for d in ds:
        if d["name"]==n and d.get("isAvailable",True): print(d["udid"]); sys.exit()')"
  if [[ -z "$udid" ]]; then
    local rt tid
    rt="$(latest_runtime)"; [[ -n "$rt" ]] || die "no iOS runtime available"
    tid="$(device_type_id "$type_name")"; [[ -n "$tid" ]] || die "device type not found: $type_name"
    udid="$(xcrun simctl create "$sim_name" "$tid" "$rt")"
  fi
  echo "$udid"
}

pause_for() {
  local screen="$1"
  if [[ "$ASSUME_YES" == "1" ]]; then return; fi
  read -r -p "Navigate the simulator to '$screen', then press Enter to capture (s = skip)... " ans </dev/tty
  [[ "$ans" == "s" ]] && return 1
  return 0
}

capture_target() {
  local label="$1" type_name="$2" expect="$3"
  local sim_name="Kitcha-Store-$label" udid outdir
  udid="$(find_or_create_sim "$sim_name" "$type_name")"
  outdir="$OUT_ROOT/$label"
  mkdir -p "$outdir"
  echo "== $label ($type_name) udid=$udid -> $outdir"

  xcrun simctl boot "$udid" 2>/dev/null || true       # already-booted is fine
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl ui "$udid" appearance light
  xcrun simctl status_bar "$udid" override \
    --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 \
    --operatorName ""

  xcrun simctl install "$udid" "$APP_PATH"
  xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  sleep "$SETTLE"

  local i=0 name url
  for name in "${SCREENS[@]}"; do
    i=$((i + 1))
    local file; file="$(printf '%s/%02d-%s.png' "$outdir" "$i" "$name")"
    if [[ -n "$URLS_FILE" && -f "$URLS_FILE" ]]; then
      url="$(awk -F'|' -v n="$name" '$1==n {print $2}' "$URLS_FILE")"
      if [[ -n "$url" ]]; then
        xcrun simctl openurl "$udid" "$url"
        sleep "$SETTLE"
      fi
    else
      pause_for "$name" || { echo "skipped $name"; continue; }
    fi
    xcrun simctl io "$udid" screenshot --type=png "$file" >/dev/null
    local w h
    w="$(/usr/bin/sips -g pixelWidth "$file" | awk '/pixelWidth/{print $2}')"
    h="$(/usr/bin/sips -g pixelHeight "$file" | awk '/pixelHeight/{print $2}')"
    if [[ "${w}x${h}" != "$expect" ]]; then
      echo "warning: $file is ${w}x${h}, expected $expect" >&2
    fi
    echo "captured $file (${w}x${h})"
  done

  xcrun simctl status_bar "$udid" clear
}

for t in "${TARGETS[@]}"; do
  IFS='|' read -r label type_name expect <<<"$t"
  case "$WHICH" in
    all) capture_target "$label" "$type_name" "$expect" ;;
    6.9) [[ "$label" == 6.9-inch ]] && capture_target "$label" "$type_name" "$expect" ;;
    6.3) [[ "$label" == 6.3-inch ]] && capture_target "$label" "$type_name" "$expect" ;;
    *) die "second arg must be 6.9, 6.3 or all" ;;
  esac
done

echo "Done. Review images for real user data, then check: sips -g hasAlpha <file> (App Store rejects alpha)."
