#!/usr/bin/env bash
# Load App Store Connect API credentials from ~/.appstoreconnect/env. Source this file.
# Exports ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Never prints values.
ASC_ENV_FILE="${ASC_ENV_FILE:-$HOME/.appstoreconnect/env}"
[ -f "$ASC_ENV_FILE" ] || { echo "[mobile] ERROR: missing $ASC_ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$ASC_ENV_FILE"
set +a
for v in ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH; do
  [ -n "${!v:-}" ] || { echo "[mobile] ERROR: $v not set in $ASC_ENV_FILE" >&2; exit 1; }
done
[ -f "$ASC_KEY_PATH" ] || { echo "[mobile] ERROR: key file not found at ASC_KEY_PATH" >&2; exit 1; }
