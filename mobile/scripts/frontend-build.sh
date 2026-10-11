#!/usr/bin/env bash
# Serialized frontend build used by every verification step.
# Usage: frontend-build.sh web|native [--e2e|--shot]
#   --shot  store-screenshot variant (Simulator only, no credentials baked in; never ship)
# Env:   API_URL (default https://kitcha-api-production.up.railway.app, must be https)
#        E2E_EMAIL / E2E_PASSWORD (only used with --e2e, never echoed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../../frontend" && pwd)"
DEFAULT_API_URL="https://kitcha-api-production.up.railway.app"

# Re-run this script under the shared build lock (re-entrant via KITCHA_BUILD_LOCK_HELD).
if [ "${KITCHA_BUILD_LOCK_HELD:-}" != "1" ]; then
  case "${1:-}" in
    web|native) exec "$SCRIPT_DIR/with-build-lock.sh" bash "${BASH_SOURCE[0]}" "$@" ;;
  esac
fi

TARGET="${1:-}"
E2E=0
SHOT=0
case "$TARGET" in
  web|native) ;;
  *) echo "usage: frontend-build.sh web|native [--e2e|--shot]" >&2; exit 2 ;;
esac
shift
for arg in "$@"; do
  case "$arg" in
    --e2e) E2E=1 ;;
    --shot) SHOT=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

API_URL="${API_URL:-${NEXT_PUBLIC_API_URL:-$DEFAULT_API_URL}}"
# Public support address shown on the support page (baked into the static export).
export NEXT_PUBLIC_SUPPORT_EMAIL="${NEXT_PUBLIC_SUPPORT_EMAIL:-ervenidjad12@gmail.com}"
case "$API_URL" in
  https://*) ;;
  *) echo "frontend-build: API url must start with https://" >&2; exit 1 ;;
esac

build_web() {
  cd "$FRONTEND_DIR"
  NEXT_PUBLIC_API_URL="$API_URL" npm run build
}

build_native() {
  cd "$FRONTEND_DIR"
  rm -rf out
  if [ "$E2E" = "1" ]; then
    NEXT_PUBLIC_E2E=1 \
    NEXT_PUBLIC_E2E_EMAIL="${E2E_EMAIL:-}" \
    NEXT_PUBLIC_E2E_PASSWORD="${E2E_PASSWORD:-}" \
    NEXT_PUBLIC_E2E_SUITE="${E2E_SUITE:-smoke}" \
    NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY="kitcha:e2e-force-offline" \
    BUILD_TARGET=native NEXT_PUBLIC_API_URL="$API_URL" npx next build
  elif [ "$SHOT" = "1" ]; then
    # Screenshot variant: flag only. Credentials and routes arrive at launch (SIMCTL_CHILD_*).
    env -u NEXT_PUBLIC_E2E -u NEXT_PUBLIC_E2E_EMAIL -u NEXT_PUBLIC_E2E_PASSWORD \
      -u NEXT_PUBLIC_E2E_SUITE -u NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY \
      NEXT_PUBLIC_SHOT=1 BUILD_TARGET=native NEXT_PUBLIC_API_URL="$API_URL" npx next build
  else
    # Release: scrub any inherited E2E vars so they can never be inlined into the bundle.
    env -u NEXT_PUBLIC_E2E -u NEXT_PUBLIC_E2E_EMAIL -u NEXT_PUBLIC_E2E_PASSWORD \
      -u NEXT_PUBLIC_E2E_SUITE -u NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY -u NEXT_PUBLIC_SHOT \
      BUILD_TARGET=native NEXT_PUBLIC_API_URL="$API_URL" npx next build
  fi
  rm -f out/top-view-tasty-food-devices.jpg
  if [ ! -f out/index.html ]; then
    echo "frontend-build: out/index.html missing after native build" >&2
    exit 1
  fi
}

if [ "$TARGET" = "web" ]; then
  build_web
else
  build_native
fi
