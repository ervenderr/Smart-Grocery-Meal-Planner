#!/usr/bin/env bash
# Serialize frontend builds across parallel executors: concurrent `next build`
# runs collide on frontend/.next and frontend/out.
# Usage: with-build-lock.sh <command...>
# Re-entrant: when KITCHA_BUILD_LOCK_HELD=1 the command runs directly.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: with-build-lock.sh <command...>" >&2
  exit 2
fi

if [ "${KITCHA_BUILD_LOCK_HELD:-}" = "1" ]; then
  exec "$@"
fi

LOCK_BASE="${TMPDIR:-/tmp}"
LOCK_DIR="${LOCK_BASE%/}/kitcha-frontend-build.lock"
MAX_WAIT_SEC=900
STALE_SEC=900
POLL_SEC=2
waited=0

lock_age() {
  local mtime now
  mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo $((now - mtime))
}

until mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ -d "$LOCK_DIR" ] && [ "$(lock_age)" -gt "$STALE_SEC" ]; then
    echo "with-build-lock: removing stale lock $LOCK_DIR" >&2
    rmdir "$LOCK_DIR" 2>/dev/null || true
    continue
  fi
  if [ "$waited" -ge "$MAX_WAIT_SEC" ]; then
    echo "with-build-lock: gave up waiting for $LOCK_DIR after ${MAX_WAIT_SEC}s" >&2
    exit 1
  fi
  sleep "$POLL_SEC"
  waited=$((waited + POLL_SEC))
done

trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
KITCHA_BUILD_LOCK_HELD=1 "$@"
