#!/usr/bin/env bash
# Production smoke test for the Kitcha API (and optionally the Vercel frontend bundle).
#
# Usage:
#   API=https://<host>.up.railway.app scripts/smoke-prod.sh [--api-only]
#   FE=https://kitcha-ai.vercel.app (optional, default shown)
#
# Requires curl and jq. Exits non-zero on the first failing check.
# The JWT is never printed. The smoke user (smoke+<epoch>@example.com) stays in
# the database because there is no delete-account endpoint.
set -euo pipefail

API="${API:-}"
FE="${FE:-https://kitcha-ai.vercel.app}"
PREVIEW_ORIGIN="https://kitcha-git-main-ervenderrs-projects.vercel.app"
API_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --api-only) API_ONLY=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "$API" ]; then
  echo "FAIL: API env var is required (e.g. API=https://x.up.railway.app)" >&2
  exit 2
fi
API="${API%/}"

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FAIL: $bin is required" >&2; exit 2; }
done

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

BODY_FILE="$(mktemp)"
HDR_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE" "$HDR_FILE"' EXIT

# req METHOD URL [curl args...] -> prints HTTP status; body in $BODY_FILE, headers in $HDR_FILE
req() {
  local method="$1" url="$2"
  shift 2
  curl -sS --max-time 30 -X "$method" -o "$BODY_FILE" -D "$HDR_FILE" \
    -w '%{http_code}' "$url" "$@"
}

header() {
  # case-insensitive header lookup from last response
  grep -i "^$1:" "$HDR_FILE" | tail -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# (1) health
code="$(req GET "$API/health")" || fail "1 health: API unreachable"
[ "$code" = "200" ] || fail "1 health: expected 200, got $code"
[ "$(jq -r '.status' "$BODY_FILE")" = "ok" ] || fail "1 health: status is not ok"
pass "1 GET /health returns 200 status ok"

# (2) preflight from production frontend origin
code="$(req OPTIONS "$API/api/v1/auth/login" \
  -H "Origin: $FE" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type")" || fail "2 preflight: request failed"
[ "$code" = "200" ] || [ "$code" = "204" ] || fail "2 preflight: expected 200, got $code"
[ "$(header access-control-allow-origin)" = "$FE" ] || fail "2 preflight: ACAO does not equal $FE"
pass "2 preflight from $FE allowed"

# (3) Vercel preview origin
code="$(req OPTIONS "$API/api/v1/auth/login" \
  -H "Origin: $PREVIEW_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type")" || fail "3 preview preflight: request failed"
[ "$code" = "200" ] || [ "$code" = "204" ] || fail "3 preview preflight: expected 200, got $code"
[ "$(header access-control-allow-origin)" = "$PREVIEW_ORIGIN" ] || fail "3 preview preflight: ACAO mismatch"
pass "3 preview origin preflight allowed"

# (4) disallowed origin
code="$(req GET "$API/api/v1" -H "Origin: https://evil.example")" || fail "4 evil origin: request failed"
[ "$code" = "403" ] || fail "4 evil origin: expected 403, got $code"
[ "$(jq -r '.message' "$BODY_FILE")" = "Origin not allowed" ] || fail "4 evil origin: message is not 'Origin not allowed'"
pass "4 unknown origin gets 403 Origin not allowed"

# (5) rate-limit identity: spoofed leftmost XFF must not mint new buckets
req GET "$API/api/v1" -H "X-Forwarded-For: 1.1.1.1" >/dev/null || fail "5 ratelimit: first request failed"
first="$(header ratelimit-remaining)"
req GET "$API/api/v1" -H "X-Forwarded-For: 2.2.2.2" >/dev/null || fail "5 ratelimit: second request failed"
second="$(header ratelimit-remaining)"
[[ "$first" =~ ^[0-9]+$ && "$second" =~ ^[0-9]+$ ]] || fail "5 ratelimit: ratelimit-remaining header missing (first='$first' second='$second')"
[ "$second" -eq $((first - 1)) ] || fail "5 ratelimit: expected remaining to drop by exactly 1 (first=$first second=$second)"
pass "5 spoofed XFF shares one rate-limit bucket ($first -> $second)"

# (6) signup + login
EPOCH="$(date +%s)"
EMAIL="smoke+${EPOCH}@example.com"
PASSWORD="Smoke${EPOCH}Aa1"

signup_payload="$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p,firstName:"Smoke",lastName:"Test"}')"
code="$(req POST "$API/api/v1/auth/signup" -H "Content-Type: application/json" -d "$signup_payload")" || fail "6 signup: request failed"
[ "$code" = "201" ] || fail "6 signup: expected 201, got $code"
TOKEN="$(jq -r '.token // empty' "$BODY_FILE")"
[ -n "$TOKEN" ] || fail "6 signup: no token in response"
pass "6a signup returns 201 and a token"

login_payload="$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')"
code="$(req POST "$API/api/v1/auth/login" -H "Content-Type: application/json" -d "$login_payload")" || fail "6 login: request failed"
[ "$code" = "200" ] || fail "6 login: expected 200, got $code"
TOKEN="$(jq -r '.token // empty' "$BODY_FILE")"
[ -n "$TOKEN" ] || fail "6 login: no token in response"
pass "6b login returns 200 and a token"

# (7) pantry CRUD
AUTH="Authorization: Bearer $TOKEN"
item_payload='{"ingredientName":"Smoke Test Rice","quantity":2,"unit":"pieces","category":"other"}'
code="$(req POST "$API/api/v1/pantry" -H "$AUTH" -H "Content-Type: application/json" -d "$item_payload")" || fail "7 pantry create: request failed"
[ "$code" = "201" ] || fail "7 pantry create: expected 201, got $code"
ITEM_ID="$(jq -r '.id // .data.id // .item.id // empty' "$BODY_FILE")"
[ -n "$ITEM_ID" ] || fail "7 pantry create: no id in response"
pass "7a pantry create returns 201 with id"

code="$(req GET "$API/api/v1/pantry/$ITEM_ID" -H "$AUTH")" || fail "7 pantry get: request failed"
[ "$code" = "200" ] || fail "7 pantry get: expected 200, got $code"
pass "7b pantry get returns 200"

code="$(req PATCH "$API/api/v1/pantry/$ITEM_ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"quantity":3}')" || fail "7 pantry update: request failed"
[ "$code" = "200" ] || fail "7 pantry update: expected 200, got $code"
pass "7c pantry update returns 200"

code="$(req DELETE "$API/api/v1/pantry/$ITEM_ID" -H "$AUTH")" || fail "7 pantry delete: request failed"
[ "$code" = "200" ] || fail "7 pantry delete: expected 200, got $code"
pass "7d pantry delete returns 200"

code="$(req GET "$API/api/v1/pantry/$ITEM_ID" -H "$AUTH")" || fail "7 pantry get-after-delete: request failed"
[ "$code" = "404" ] || fail "7 pantry get-after-delete: expected 404, got $code"
pass "7e pantry get after delete returns 404"

# (8) frontend bundle check
if [ "$API_ONLY" = "false" ]; then
  API_HOST="${API#https://}"
  # The landing page does not load the API client chunk, so scan the auth pages too.
  js_paths=""
  for page in "" "/login" "/signup"; do
    html="$(curl -sS --max-time 30 "$FE$page")" || fail "8 frontend: could not fetch $FE$page"
    js_paths="$js_paths
$(printf '%s' "$html" | grep -oE '/_next/static/[^"'"'"' )\\]+\.js')"
  done
  js_paths="$(printf '%s\n' "$js_paths" | sed '/^$/d' | sort -u)"
  [ -n "$js_paths" ] || fail "8 frontend: no /_next/static js found in HTML"
  found_api=false
  while IFS= read -r p; do
    js="$(curl -sS --max-time 30 "$FE$p")" || continue
    if printf '%s' "$js" | grep -q "localhost:3001"; then
      fail "8 frontend: bundle $p still references localhost:3001"
    fi
    if printf '%s' "$js" | grep -qF "$API_HOST"; then
      found_api=true
    fi
  done <<< "$js_paths"
  [ "$found_api" = "true" ] || fail "8 frontend: no bundle contains API host $API_HOST"
  pass "8 frontend bundle contains API host and no localhost:3001"
fi

echo "ALL CHECKS PASSED (smoke user $EMAIL remains in the DB; no delete-account endpoint)"
