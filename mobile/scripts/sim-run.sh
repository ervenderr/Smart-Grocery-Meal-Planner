#!/usr/bin/env bash
# Boot a Simulator, install and launch app.kitcha.mobile.
#
# Usage: sim-run.sh [--screenshot <path>] [--no-install] [--relaunch]
# Env:   SIM_DEVICE (default "iPhone 17", falls back to first available iPhone)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/sim-device.sh
. "$SCRIPT_DIR/lib/sim-device.sh"

SHOT=""
INSTALL=1
RELAUNCH=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --screenshot)
      [ "$#" -ge 2 ] || { echo "--screenshot needs a path" >&2; exit 2; }
      SHOT="$2"; shift ;;
    --no-install) INSTALL=0 ;;
    --relaunch) RELAUNCH=1 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

require_cmd xcrun
UDID="$(resolve_sim_udid)"
boot_sim "$UDID"

if [ "$INSTALL" = "1" ]; then
  APP_PATH="$mobile_dir/build/Build/Products/Debug-iphonesimulator/App.app"
  [ -d "$APP_PATH" ] || die "App.app not found; run npm run build:ios first"
  xcrun simctl install "$UDID" "$APP_PATH"
fi
if [ "$RELAUNCH" = "1" ]; then
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
fi
xcrun simctl launch "$UDID" "$BUNDLE_ID"

if [ -n "$SHOT" ]; then
  mkdir -p "$(dirname "$SHOT")"
  sleep 3
  xcrun simctl io "$UDID" screenshot "$SHOT" >/dev/null 2>&1
  log "screenshot: $SHOT"
fi
