#!/usr/bin/env bash
# Scripted Simulator OFFLINE E2E (Phase 11, D-07).
#
# Usage: e2e-offline.sh [--keep-account] [--skip-build]
# Env:   E2E_EMAIL + E2E_PASSWORD (optional; otherwise a throwaway account is generated),
#        API_URL (https only), SIM_DEVICE, STEP_TIMEOUT (default 90).
# Flow: build E2E variant (suite=offline), fresh install, launch 1 (seed online, force offline,
# queue writes), terminate (the kill), launch 2 (cold start still offline: hydrated from SQLite,
# queue intact; then reconnect, exactly-once check, same-key replay), screenshots, report.json.
# simctl has no airplane-mode switch: the E2E-only forced-offline flag stands in for it.
# EXIT trap always deletes the account and wipes E2E build output.
set -euo pipefail
export E2E_SUITE=offline

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
SHOT_DIR="$repo_root/.planning/phases/11-offline-core/screenshots"
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
    if grep -hq 'KITCHA_E2E {"step":"done","ok":false' "${LOGS[@]}" 2>/dev/null; then
      FAILED=1
      die "runner crashed while waiting for $step: $(grep -h 'KITCHA_E2E {"step":"done","ok":false' "${LOGS[@]}" | head -n 1 | cut -c1-300)"
    fi
    sleep 1; waited=$((waited + 1))
  done
  FAILED=1
  die "step $step timed out after ${timeout}s"
}

screenshot() { xcrun simctl io "$UDID" screenshot "$ART_DIR/$1" >/dev/null 2>&1; }

log "launch 1: seed online, go offline, queue writes"
launch_and_capture launch1
wait_for_step seed
wait_for_step offline-write
sleep 3
screenshot 11-offline-queued.png
stop_capture
log "terminating the app (kill) while forced offline"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 3

log "launch 2: cold start offline, reconnect, replay"
launch_and_capture launch2
wait_for_step offline-cold-start
sleep 1
screenshot 12-offline-cold-start.png
for s in reconnect replay done; do wait_for_step "$s"; done
sleep 2
screenshot 13-offline-reconnected.png
stop_capture

DURATION=$(( $(date +%s) - START_EPOCH ))
jq -n --argjson steps "$STEPS_JSON" --arg device "$SIM_NAME" --arg runtime "$SIM_RUNTIME" \
  --argjson dur "$DURATION" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{suite: "offline", date: $date, device: $device, runtime: $runtime,
    offline_mode: "forced-offline flag (simctl has no airplane mode)", duration_seconds: $dur, steps: $steps}' \
  >"$ART_DIR/report.json"
cp "$ART_DIR"/1[123]-*.png "$SHOT_DIR/"
cp "$ART_DIR/report.json" "$SHOT_DIR/offline-report.json"
[ "$FAILED" = "0" ] || die "offline e2e had failing steps"
log "offline e2e passed in ${DURATION}s; report: $SHOT_DIR/offline-report.json"
