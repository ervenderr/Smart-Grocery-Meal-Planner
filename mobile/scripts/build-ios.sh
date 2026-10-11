#!/usr/bin/env bash
# Export the frontend (static), sync Capacitor, build App.app for the Simulator.
#
# Usage: build-ios.sh [--e2e] [--skip-export] [--skip-xcode]
#   --e2e          export with NEXT_PUBLIC_E2E=1 (needs E2E_EMAIL and E2E_PASSWORD)
#   --skip-export  reuse the existing frontend/out
#   --skip-xcode   stop after `cap sync`
# Env:   API_URL (default production, must be https://), SIM_DEVICE
# Simulator build is ad-hoc signed ("-") so the Keychain works (unsigned builds get -34018). Prints the App.app path.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/sim-device.sh
. "$SCRIPT_DIR/lib/sim-device.sh"

E2E=0
SKIP_EXPORT=0
SKIP_XCODE=0
PHASE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --e2e) E2E=1 ;;
    --skip-export) SKIP_EXPORT=1 ;;
    --skip-xcode) SKIP_XCODE=1 ;;
    --export-sync-locked) PHASE_ONLY=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

API_URL="${API_URL:-$PROD_API_URL_DEFAULT}"
export API_URL

export_and_sync() {
  if [ "$SKIP_EXPORT" = "0" ]; then
    if [ "$E2E" = "1" ]; then
      "$SCRIPT_DIR/frontend-build.sh" native --e2e
    else
      "$SCRIPT_DIR/frontend-build.sh" native
    fi
  fi
  cd "$mobile_dir"
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
    log "installing mobile dependencies (npm ci)"
    npm ci
  fi
  npx cap sync ios
}

# Internal re-entry: runs under the shared build lock.
if [ "$PHASE_ONLY" = "1" ]; then
  export_and_sync
  exit 0
fi

for c in node npm; do require_cmd "$c"; done
case "$API_URL" in
  https://*) ;;
  *) die "API_URL must start with https:// (got a non-https value)" ;;
esac
if [ "$E2E" = "1" ]; then
  [ -n "${E2E_EMAIL:-}" ] || die "--e2e requires E2E_EMAIL"
  [ -n "${E2E_PASSWORD:-}" ] || die "--e2e requires E2E_PASSWORD"
fi
if [ "$SKIP_XCODE" = "0" ]; then
  for c in xcodebuild xcrun; do require_cmd "$c"; done
fi

# Hold the lock across export + sync so a parallel build cannot replace
# frontend/out in between.
fwd=(--export-sync-locked)
[ "$E2E" = "1" ] && fwd+=(--e2e)
[ "$SKIP_EXPORT" = "1" ] && fwd+=(--skip-export)
"$SCRIPT_DIR/with-build-lock.sh" bash "${BASH_SOURCE[0]}" "${fwd[@]}"

if [ "$SKIP_XCODE" = "1" ]; then
  log "skipping xcodebuild"
  exit 0
fi

UDID="$(resolve_sim_udid)"
log "building for Simulator $UDID"
(
  cd "$mobile_dir/ios/App"
  xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
    -destination "platform=iOS Simulator,id=$UDID" \
    -derivedDataPath "$mobile_dir/build" \
    CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES -quiet build
)
APP_PATH="$mobile_dir/build/Build/Products/Debug-iphonesimulator/App.app"
[ -d "$APP_PATH" ] || die "build finished but $APP_PATH is missing"
echo "$APP_PATH"
