#!/usr/bin/env bash
# Security and size gate for the exported bundle (frontend/out) and Capacitor config.
#
# Usage: verify-bundle.sh [--e2e]
#   --e2e  expect E2E markers (out/e2e/index.html) instead of forbidding them
# Env:   MAX_BUNDLE_KB (default 10240), API_URL (default production host),
#        CAP_CONFIG_PATH (override capacitor.config.ts, for testing),
#        OUT_DIR (override frontend/out), E2E_PASSWORD (must not appear in a release export)
# Never prints matched secret values, only file names.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

E2E=0
for arg in "$@"; do
  case "$arg" in
    --e2e) E2E=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

MAX_BUNDLE_KB="${MAX_BUNDLE_KB:-10240}"
API_URL="${API_URL:-$PROD_API_URL_DEFAULT}"
OUT_DIR="${OUT_DIR:-$frontend_dir/out}"
CAP_CONFIG_PATH="${CAP_CONFIG_PATH:-$mobile_dir/capacitor.config.ts}"
GEN_CONFIG="$mobile_dir/ios/App/App/capacitor.config.json"
API_HOST="${API_URL#https://}"
API_HOST="${API_HOST%%/*}"

fail() { printf 'verify-bundle FAIL: %s\n' "$*" >&2; exit 1; }

# 1. No remote web content or cleartext in the Capacitor config.
for cfg in "$CAP_CONFIG_PATH" "$GEN_CONFIG"; do
  [ -f "$cfg" ] || continue
  if grep -Eq '(^|[{,[:space:]])"?server"?[[:space:]]*:' "$cfg"; then
    fail "$cfg declares a server key (remote web content is forbidden)"
  fi
  if grep -Eiq 'cleartext' "$cfg"; then
    fail "$cfg mentions cleartext"
  fi
done

# 2. Export exists and is within the size budget.
[ -d "$OUT_DIR" ] || fail "$OUT_DIR is missing; run npm run build:ios first"
SIZE_KB="$(du -sk "$OUT_DIR" | awk '{print $1}')"
echo "bundle size: ${SIZE_KB} KB (budget ${MAX_BUNDLE_KB} KB)"
[ "$SIZE_KB" -le "$MAX_BUNDLE_KB" ] || fail "bundle ${SIZE_KB} KB exceeds budget ${MAX_BUNDLE_KB} KB"

# 3. https API base is baked in, and no http:// base for the same host.
grep -rqF "https://$API_HOST" "$OUT_DIR" --include='*.js' || fail "https://$API_HOST not found in exported JS"
if grep -rqF "http://$API_HOST" "$OUT_DIR"; then
  fail "http:// API base for $API_HOST found in export"
fi

# 4. Secret-pattern scan (file names only).
PATTERN='DATABASE_URL|JWT_SECRET|GEMINI_API_KEY|GROQ_API_KEY|AI_API_KEY|-----BEGIN|postgres://|postgresql://'
HITS="$(grep -rlE -e "$PATTERN" "$OUT_DIR" || true)"
if [ -n "$HITS" ]; then
  printf '%s\n' "$HITS" >&2
  fail "secret-like pattern found in the files above"
fi

# 5. E2E markers.
if [ "$E2E" = "1" ]; then
  [ -f "$OUT_DIR/e2e/index.html" ] || fail "--e2e given but $OUT_DIR/e2e/index.html is missing"
else
  if grep -rlF "KITCHA_E2E" "$OUT_DIR" >/dev/null 2>&1; then
    grep -rlF "KITCHA_E2E" "$OUT_DIR" >&2 || true
    fail "KITCHA_E2E marker present in a release export"
  fi
  [ ! -e "$OUT_DIR/e2e" ] || fail "$OUT_DIR/e2e exists in a release export"
  if [ -n "${E2E_PASSWORD:-}" ] && grep -rlF -e "$E2E_PASSWORD" "$OUT_DIR" >/dev/null 2>&1; then
    grep -rlF -e "$E2E_PASSWORD" "$OUT_DIR" >&2 || true
    fail "E2E_PASSWORD value leaked into the release export (files above)"
  fi
fi

echo "verify-bundle OK"
