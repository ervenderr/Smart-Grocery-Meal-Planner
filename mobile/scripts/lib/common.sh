#!/usr/bin/env bash
# Shared helpers for mobile/scripts. Source this file; do not execute it.
# Provides: mobile_dir, frontend_dir, repo_root, log, die, require_cmd,
#           PROD_API_URL_DEFAULT, BUNDLE_ID.

_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd "$_common_dir/../.." && pwd)"
repo_root="$(cd "$mobile_dir/.." && pwd)"
frontend_dir="$repo_root/frontend"

PROD_API_URL_DEFAULT="https://kitcha-api-production.up.railway.app"
BUNDLE_ID="app.kitcha.mobile"

log() { printf '[mobile] %s\n' "$*" >&2; }
die() { printf '[mobile] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}
