#!/usr/bin/env bash
# Scripted Simulator smoke E2E (SHELL-06).
#
# Usage: e2e-smoke.sh [--keep-account] [--skip-build]
#   --keep-account  do not delete the throwaway production account at the end
#   --skip-build    reuse an existing E2E build (frontend/out and App.app)
# Env:   E2E_EMAIL + E2E_PASSWORD (optional; otherwise a throwaway account is
#        generated), API_URL (https only), SIM_DEVICE, STEP_TIMEOUT (default 90).
# Flow: build E2E variant, fresh install, launch 1 (render + login), terminate,
# launch 2 (relaunch/Keychain, sqlite durability, scan, haptics, notifications, done), screenshots,
# report.json. EXIT trap always deletes the account and wipes E2E build output.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/sim-device.sh
. "$SCRIPT_DIR/lib/sim-device.sh"
# shellcheck source=lib/e2e-account.sh
. "$SCRIPT_DIR/lib/e2e-account.sh"

KEEP_ACCOUNT=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --keep-account) KEEP_ACCOUNT=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done
for c in curl jq xcrun openssl; do require_cmd "$c"; done

STEP_TIMEOUT="${STEP_TIMEOUT:-90}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ART_DIR="$mobile_dir/e2e-artifacts/$STAMP"
SHOT_DIR="$repo_root/.planning/phases/10-capacitor-ios-shell/screenshots"
mkdir -p "$ART_DIR" "$SHOT_DIR"
UDID=""
CAPTURE_PIDS=()
START_EPOCH="$(date +%s)"

stop_capture() {
  local pid
  for pid in "${CAPTURE_PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" >/dev/null 2>&1 || true
  done
  CAPTURE_PIDS=()
}

cleanup() {
  local rc=$?
  set +e
  stop_capture
  if [ "$KEEP_ACCOUNT" = "0" ] && [ "$E2E_CREATED" = "1" ]; then
    e2e_delete_account
  fi
  if [ -n "$UDID" ]; then
    xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
  fi
  # E2E output embeds the credentials as plaintext JS: wipe every location it lands
  # (static export, Next build cache, synced iOS assets, built Simulator app) under the build lock.
  "$SCRIPT_DIR/with-build-lock.sh" rm -rf \
    "$frontend_dir/out" "$frontend_dir/.next" \
    "$mobile_dir/ios/App/App/public" "$mobile_dir/build"
  log "cleanup done (exit $rc)"
  exit "$rc"
}
trap cleanup EXIT

e2e_create_account

if [ "$SKIP_BUILD" = "0" ]; then
  bash "$SCRIPT_DIR/build-ios.sh" --e2e >/dev/null
  bash "$SCRIPT_DIR/verify-bundle.sh" --e2e
fi
APP_PATH="$mobile_dir/build/Build/Products/Debug-iphonesimulator/App.app"
[ -d "$APP_PATH" ] || die "App.app missing; build failed"

UDID="$(resolve_sim_udid)"
boot_sim "$UDID"
SIM_NAME="$(xcrun simctl list devices -j | UDID="$UDID" jq -r '[.devices | to_entries[] | .value[] | select(.udid == env.UDID)][0].name')"
SIM_RUNTIME="$(xcrun simctl list devices -j | UDID="$UDID" jq -r '[.devices | to_entries[] | select(.value[] | .udid == env.UDID)][0].key | split(".") | last')"
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP_PATH"

NOTIF_GRANT=0
if xcrun simctl privacy "$UDID" grant notifications "$BUNDLE_ID" >/dev/null 2>&1; then
  NOTIF_GRANT=1
  log "notification permission pre-granted via simctl privacy"
else
  log "simctl privacy does not support notifications on this runtime; relying on the system alert"
fi

# Best effort: click the Allow button of the notification alert (needs Accessibility).
auto_allow() {
  local i
  for i in $(seq 1 5); do
    osascript -e 'tell application "System Events" to tell process "Simulator" to click button "Allow" of window 1' >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 0
}

LOGS=()
launch_and_capture() {
  local name="$1"
  : >"$ART_DIR/$name.log"; : >"$ART_DIR/$name.stream.log"
  xcrun simctl launch --console-pty --terminate-running-process "$UDID" "$BUNDLE_ID" \
    >"$ART_DIR/$name.log" 2>&1 &
  CAPTURE_PIDS+=("$!")
  xcrun simctl spawn "$UDID" log stream --style compact \
    --predicate 'eventMessage CONTAINS "KITCHA_E2E"' >"$ART_DIR/$name.stream.log" 2>&1 &
  CAPTURE_PIDS+=("$!")
  LOGS=("$ART_DIR/$name.log" "$ART_DIR/$name.stream.log")
}

STEPS_JSON="[]"
FAILED=0
# wait_for_step <step> [timeout]: polls the capture files for the step line.
wait_for_step() {
  local step="$1" timeout="${2:-$STEP_TIMEOUT}" waited=0 line json
  while [ "$waited" -lt "$timeout" ]; do
    line="$(grep -h "KITCHA_E2E {\"step\":\"$step\"" "${LOGS[@]}" 2>/dev/null | head -n 1 || true)"
    if [ -n "$line" ]; then
      json="${line#*KITCHA_E2E }"
      if printf '%s' "$json" | jq -e '.ok == true' >/dev/null 2>&1; then
        STEPS_JSON="$(printf '%s' "$STEPS_JSON" | jq -c --argjson s "$json" '. + [$s]')"
        log "step $step: PASS"
        return 0
      fi
      STEPS_JSON="$(printf '%s' "$STEPS_JSON" | jq -c --arg s "$step" --arg j "$json" '. + [{step: $s, ok: false, raw: $j}]' 2>/dev/null || printf '%s' "$STEPS_JSON")"
      FAILED=1
      die "step $step FAILED: $json"
    fi
    sleep 1; waited=$((waited + 1))
  done
  FAILED=1
  die "step $step timed out after ${timeout}s"
}

screenshot() { xcrun simctl io "$UDID" screenshot "$ART_DIR/$1" >/dev/null 2>&1; }

log "launch 1: render + login"
launch_and_capture launch1
wait_for_step render
wait_for_step login
sleep 3
screenshot 01-e2e-dashboard.png
stop_capture
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 2

log "launch 2: relaunch, scan, haptics, notifications"
launch_and_capture launch2
if [ "$NOTIF_GRANT" = "0" ]; then auto_allow & CAPTURE_PIDS+=("$!"); fi
for s in relaunch sqlite scan haptics notifications done; do wait_for_step "$s"; done
sleep 2
screenshot 02-e2e-pantry.png
stop_capture

NOTIF_NOTE="verified"
if printf '%s' "$STEPS_JSON" | jq -e '.[] | select(.step == "notifications" and .status == "not-granted")' >/dev/null 2>&1; then
  NOTIF_NOTE="human_needed"
fi
DURATION=$(( $(date +%s) - START_EPOCH ))
jq -n --argjson steps "$STEPS_JSON" --arg device "$SIM_NAME" --arg runtime "$SIM_RUNTIME" \
  --argjson grant "$NOTIF_GRANT" --arg note "$NOTIF_NOTE" --argjson dur "$DURATION" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{date: $date, device: $device, runtime: $runtime, simctl_privacy_notifications_supported: ($grant == 1),
    notification_pending_check: $note, duration_seconds: $dur, steps: $steps}' >"$ART_DIR/report.json"
cp "$ART_DIR/01-e2e-dashboard.png" "$ART_DIR/02-e2e-pantry.png" "$ART_DIR/report.json" "$SHOT_DIR/"
log "e2e passed in ${DURATION}s; report: $SHOT_DIR/report.json"
