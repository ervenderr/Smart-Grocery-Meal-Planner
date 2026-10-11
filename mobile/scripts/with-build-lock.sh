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
# Grace for a lock dir that has no pid file yet (holder is between mkdir and pid write).
NO_PID_GRACE_SEC=30
POLL_SEC=2
waited=0

lock_age() {
  local mtime now
  mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo $((now - mtime))
}

# Stale = holder PID recorded and dead, or no PID ever recorded past the grace period.
# Liveness (not lock age) decides, so long native builds never lose their lock.
lock_is_stale() {
  local pid
  pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    ! kill -0 "$pid" 2>/dev/null
  else
    [ "$(lock_age)" -gt "$NO_PID_GRACE_SEC" ]
  fi
}

# Break a stale lock by atomically renaming it away (rename succeeds for exactly one
# waiter), so a fresh lock taken by another waiter is never removed by a late rmdir.
break_stale_lock() {
  local grave="${LOCK_DIR}.stale.$$"
  if mv "$LOCK_DIR" "$grave" 2>/dev/null; then
    echo "with-build-lock: removed stale lock $LOCK_DIR" >&2
    rm -rf "$grave"
  fi
}

until mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ -d "$LOCK_DIR" ] && lock_is_stale; then
    break_stale_lock
    continue
  fi
  if [ "$waited" -ge "$MAX_WAIT_SEC" ]; then
    echo "with-build-lock: gave up waiting for $LOCK_DIR after ${MAX_WAIT_SEC}s" >&2
    exit 1
  fi
  sleep "$POLL_SEC"
  waited=$((waited + POLL_SEC))
done

echo "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
KITCHA_BUILD_LOCK_HELD=1 "$@"
