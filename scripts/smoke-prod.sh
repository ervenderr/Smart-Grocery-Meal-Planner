#!/usr/bin/env bash
# Production smoke test for the Kitcha API (and optionally the Vercel frontend bundle).
#
# Usage:
#   API=https://<host>.up.railway.app scripts/smoke-prod.sh [--api-only] [--ai-live]
#   --api-only  skip the frontend bundle check (8)
#   --ai-live   make real (cached-twice) provider calls in check (9); needs AI_API_KEY on the server
#   Check (11) covers the currency allow-list and onboarding completion contract.
#   Check (12) covers the persistent shopping list (add, check with price, finish, history).
#   Check (13) covers pantry-aware intelligence (staples, cook-first, pantry-subtracted generate).
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
AI_LIVE=false

for arg in "$@"; do
  case "$arg" in
    --api-only) API_ONLY=true ;;
    --ai-live) AI_LIVE=true ;;
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

# (5) rate-limit identity: spoofed leftmost XFF must not mint new buckets.
# Other traffic from the same IP can consume the bucket between the two
# requests, so retry a few times before failing. Repeated runs within the
# rate-limit window (15 min) also consume the auth budget.
rl_ok=false
first=""; second=""
for attempt in 1 2 3; do
  req GET "$API/api/v1" -H "X-Forwarded-For: 1.1.1.1" >/dev/null || fail "5 ratelimit: first request failed"
  first="$(header ratelimit-remaining)"
  req GET "$API/api/v1" -H "X-Forwarded-For: 2.2.2.2" >/dev/null || fail "5 ratelimit: second request failed"
  second="$(header ratelimit-remaining)"
  [[ "$first" =~ ^[0-9]+$ && "$second" =~ ^[0-9]+$ ]] || fail "5 ratelimit: ratelimit-remaining header missing (first='$first' second='$second')"
  if [ "$second" -eq $((first - 1)) ]; then rl_ok=true; break; fi
  echo "WARN: 5 ratelimit: attempt $attempt saw first=$first second=$second, retrying" >&2
done
[ "$rl_ok" = "true" ] || fail "5 ratelimit: expected remaining to drop by exactly 1 (first=$first second=$second)"
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

# (9) AI contract
code="$(req GET "$API/api/v1/ai/status" -H "$AUTH")" || fail "9 ai status: request failed"
[ "$code" = "200" ] || fail "9 ai status: expected 200, got $code"
[ -n "$(jq -r '.provider // empty' "$BODY_FILE")" ] || fail "9 ai status: provider missing"
AI_AVAILABLE="$(jq -r '.available' "$BODY_FILE")"
case "$AI_AVAILABLE" in true|false) ;; *) fail "9 ai status: available is not a boolean" ;; esac
pass "9a ai status returns 200 (provider $(jq -r '.provider' "$BODY_FILE"), available=$AI_AVAILABLE)"

AI_ITEM_PAYLOAD="$(jq -n --arg n "smoke-rice-$EPOCH" '{ingredientName:$n,quantity:2,unit:"pieces",category:"other"}')"
code="$(req POST "$API/api/v1/pantry" -H "$AUTH" -H "Content-Type: application/json" -d "$AI_ITEM_PAYLOAD")" || fail "9 ai pantry item: request failed"
[ "$code" = "201" ] || fail "9 ai pantry item: expected 201, got $code"
AI_ITEM_ID="$(jq -r '.id // .data.id // .item.id // empty' "$BODY_FILE")"
[ -n "$AI_ITEM_ID" ] || fail "9 ai pantry item: no id in response"

AI_BODY='{}'
if [ "$AI_AVAILABLE" = "false" ]; then
  code="$(req POST "$API/api/v1/ai/suggest-recipes" -H "$AUTH" -H "Content-Type: application/json" -d "$AI_BODY")" || fail "9 ai unavailable: request failed"
  [ "$code" = "503" ] || fail "9 ai unavailable: expected 503, got $code"
  [ "$(jq -r '.code' "$BODY_FILE")" = "AI_UNAVAILABLE" ] || fail "9 ai unavailable: code is not AI_UNAVAILABLE"
  [ -n "$(jq -r '.message // empty' "$BODY_FILE")" ] || fail "9 ai unavailable: message is empty"
  pass "9 AI unavailable contract (503 AI_UNAVAILABLE with message)"
elif [ "$AI_LIVE" = "false" ]; then
  echo "SKIP: 9 live AI call (pass --ai-live)"
else
  code="$(req POST "$API/api/v1/ai/suggest-recipes" --max-time 100 -H "$AUTH" -H "Content-Type: application/json" -d "$AI_BODY")" || fail "9 ai live: request failed"
  [ "$code" = "200" ] || fail "9 ai live: expected 200, got $code"
  [ "$(jq -r '.suggestions | type' "$BODY_FILE")" = "array" ] || fail "9 ai live: suggestions is not an array"
  pass "9b live suggest-recipes returns 200 with suggestions array"
  code="$(req POST "$API/api/v1/ai/suggest-recipes" --max-time 100 -H "$AUTH" -H "Content-Type: application/json" -d "$AI_BODY")" || fail "9 ai live repeat: request failed"
  [ "$code" = "200" ] || fail "9 ai live repeat: expected 200, got $code"
  [ "$(jq -r '.cached' "$BODY_FILE")" = "true" ] || fail "9 ai live repeat: response was not cached"
  pass "9c identical repeat request is served from cache (cached=true)"
fi

code="$(req DELETE "$API/api/v1/pantry/$AI_ITEM_ID" -H "$AUTH")" || fail "9 ai pantry cleanup: request failed"
[ "$code" = "200" ] || fail "9 ai pantry cleanup: expected 200, got $code"

# (10) food lookups
code="$(req GET "$API/api/v1/food/barcode/3017620422003" -H "$AUTH")" || fail "10 barcode: request failed"
if [ "$code" = "429" ] && [ "$(jq -r '.code' "$BODY_FILE")" = "LOOKUP_THROTTLED" ]; then
  echo "WARN: 10a barcode lookup throttled (LOOKUP_THROTTLED), not a failure"
else
  [ "$code" = "200" ] || fail "10 barcode: expected 200, got $code"
  [ "$(jq -r '.attribution.license' "$BODY_FILE")" = "ODbL" ] || fail "10 barcode: attribution.license is not ODbL"
  [ -n "$(jq -r '.product.name // empty' "$BODY_FILE")" ] || fail "10 barcode: product.name is empty"
  pass "10a barcode lookup returns 200 with ODbL attribution"
fi

code="$(req GET "$API/api/v1/food/nutrition?query=apple" -H "$AUTH")" || fail "10 nutrition: request failed"
if [ "$code" = "200" ]; then
  [ "$(jq -r '.attribution.license' "$BODY_FILE")" = "CC0" ] || fail "10 nutrition: attribution.license is not CC0"
  pass "10b nutrition lookup returns 200 with CC0 attribution"
elif [ "$code" = "503" ] && [ "$(jq -r '.code' "$BODY_FILE")" = "LOOKUP_UNAVAILABLE" ]; then
  pass "10b nutrition lookup unavailable without USDA key (503 LOOKUP_UNAVAILABLE)"
else
  fail "10 nutrition: unexpected status $code"
fi

# (11) currency allow-list and onboarding contract
JSON_H="Content-Type: application/json"
code="$(req GET "$API/api/v1/users/preferences" -H "$AUTH")" || fail "11a preferences: request failed"
[ "$code" = "200" ] || fail "11a preferences: expected 200, got $code"
jq -e 'has("onboardingCompletedAt")' "$BODY_FILE" >/dev/null || fail "11a preferences: onboardingCompletedAt missing"
pass "11a preferences include onboardingCompletedAt"

code="$(req PATCH "$API/api/v1/users/preferences" -H "$AUTH" -H "$JSON_H" -d '{"currency":"XXX"}')" || fail "11b currency: request failed"
[ "$code" = "400" ] || fail "11b unsupported currency: expected 400, got $code"
pass "11b unsupported currency rejected with 400"

code="$(req PATCH "$API/api/v1/users/preferences" -H "$AUTH" -H "$JSON_H" -d '{"currency":"jpy"}')" || fail "11c currency: request failed"
[ "$code" = "200" ] || fail "11c currency jpy: expected 200, got $code"
[ "$(jq -r '.currency' "$BODY_FILE")" = "JPY" ] || fail "11c currency jpy: not normalised to JPY"
code="$(req PATCH "$API/api/v1/users/preferences" -H "$AUTH" -H "$JSON_H" -d '{"currency":"PHP"}')" || fail "11c currency reset: request failed"
[ "$code" = "200" ] || fail "11c currency reset to PHP: expected 200, got $code"
pass "11c currency normalised to uppercase and reset to PHP"

code="$(req POST "$API/api/v1/users/onboarding/complete" -H "$AUTH" -H "$JSON_H" -d '{}')" || fail "11d onboarding: request failed"
[ "$code" = "200" ] || fail "11d onboarding first call: expected 200, got $code"
ONB_FIRST="$(jq -r '.onboardingCompletedAt // empty' "$BODY_FILE")"
[ -n "$ONB_FIRST" ] || fail "11d onboarding: onboardingCompletedAt is null"
code="$(req POST "$API/api/v1/users/onboarding/complete" -H "$AUTH" -H "$JSON_H" -d '{}')" || fail "11d onboarding repeat: request failed"
[ "$code" = "200" ] || fail "11d onboarding second call: expected 200, got $code"
[ "$(jq -r '.onboardingCompletedAt // empty' "$BODY_FILE")" = "$ONB_FIRST" ] || fail "11d onboarding is not idempotent"
pass "11d onboarding/complete is idempotent"

# (12) persistent shopping list contract
SHOP="$API/api/v1/shopping"
code="$(req GET "$SHOP/list" -H "$AUTH")" || fail "12a shopping list: request failed"
[ "$code" = "200" ] || fail "12a shopping list: expected 200, got $code"
LIST_ID="$(jq -r '.id // empty' "$BODY_FILE")"
[ -n "$LIST_ID" ] || fail "12a shopping list: id missing"
[ "$(jq -r '.items | length' "$BODY_FILE")" = "0" ] || fail "12a shopping list: expected no items"
pass "12a active shopping list created lazily and empty"

code="$(req POST "$SHOP/items" -H "$AUTH" -H "$JSON_H" -d '{"itemName":"Smoke milk","quantity":2,"unit":"liters"}')" || fail "12b add item: request failed"
[ "$code" = "201" ] || fail "12b add item: expected 201, got $code"
[ "$(jq -r '.category' "$BODY_FILE")" = "dairy" ] || fail "12b add item: category not inferred as dairy"
[ "$(jq -r '.quantity' "$BODY_FILE")" = "2" ] || fail "12b add item: quantity not 2"
ITEM_ID="$(jq -r '.id // empty' "$BODY_FILE")"
[ -n "$ITEM_ID" ] || fail "12b add item: id missing"
pass "12b item added with inferred category dairy"

code="$(req PATCH "$SHOP/items/$ITEM_ID" -H "$AUTH" -H "$JSON_H" -d '{"isChecked":true,"actualCostCents":150}')" || fail "12c check item: request failed"
[ "$code" = "200" ] || fail "12c check item: expected 200, got $code"
[ "$(jq -r '.isChecked' "$BODY_FILE")" = "true" ] || fail "12c check item: isChecked not true"
pass "12c item checked with actual price"

code="$(req GET "$SHOP/list" -H "$AUTH")" || fail "12d list persistence: request failed"
[ "$code" = "200" ] || fail "12d list persistence: expected 200, got $code"
[ "$(jq -r '.id' "$BODY_FILE")" = "$LIST_ID" ] || fail "12d list persistence: list id changed"
jq -e --arg id "$ITEM_ID" '.items[] | select(.id == $id) | .isChecked == true and .actualCostCents == 150' "$BODY_FILE" >/dev/null || fail "12d list persistence: check/price not persisted"
pass "12d check and price persist on a fresh GET"

code="$(req POST "$SHOP/items" -H "$AUTH" -H "$JSON_H" -d '{"itemName":"Smoke bad","quantity":1,"unit":"<script>"}')" || fail "12e invalid unit: request failed"
[ "$code" = "400" ] || fail "12e invalid unit: expected 400, got $code"
[ "$(jq -r '.code // empty' "$BODY_FILE")" = "VALIDATION_ERROR" ] || fail "12e invalid unit: code is not VALIDATION_ERROR"
pass "12e invalid unit rejected with 400 VALIDATION_ERROR"

code="$(req GET "$SHOP/list")" || fail "12f unauthenticated: request failed"
[ "$code" = "401" ] || fail "12f unauthenticated list: expected 401, got $code"
pass "12f shopping list requires a token (401)"

RECEIPT_DATE="$(date -u +%F)"
code="$(req POST "$SHOP/finish" -H "$AUTH" -H "$JSON_H" -d "{\"carryOver\":\"discard\",\"receiptDate\":\"$RECEIPT_DATE\"}")" || fail "12g finish: request failed"
[ "$code" = "200" ] || fail "12g finish: expected 200, got $code"
[ "$(jq -r '.history.receiptDate' "$BODY_FILE")" = "$RECEIPT_DATE" ] || fail "12g finish: receiptDate mismatch"
[ "$(jq -r '.history.totalCents' "$BODY_FILE")" = "150" ] || fail "12g finish: totalCents not 150"
[ "$(jq -r '.list.id' "$BODY_FILE")" != "$LIST_ID" ] || fail "12g finish: list id did not change"
[ "$(jq -r '.list.items | length' "$BODY_FILE")" = "0" ] || fail "12g finish: new list not empty"
pass "12g finish trip writes history (150 cents) and starts a fresh list"

code="$(req GET "$SHOP/history" -H "$AUTH")" || fail "12h history: request failed"
[ "$code" = "200" ] || fail "12h history: expected 200, got $code"
HIST_TOTAL="$(jq -r '.pagination.total' "$BODY_FILE")"
[ "$HIST_TOTAL" -ge 1 ] || fail "12h history: pagination.total < 1"
[ "$(jq -r '.items[0].totalCents' "$BODY_FILE")" = "150" ] || fail "12h history: first entry totalCents not 150"
pass "12h history lists the finished trip"

code="$(req POST "$SHOP/finish" -H "$AUTH" -H "$JSON_H" -d '{}')" || fail "12i empty finish: request failed"
[ "$code" = "400" ] || fail "12i empty finish: expected 400, got $code"
[ "$(jq -r '.code // empty' "$BODY_FILE")" = "SHOPPING_LIST_EMPTY" ] || fail "12i empty finish: code is not SHOPPING_LIST_EMPTY"
code="$(req GET "$SHOP/history" -H "$AUTH")" || fail "12i history recheck: request failed"
[ "$(jq -r '.pagination.total' "$BODY_FILE")" = "$HIST_TOTAL" ] || fail "12i history total changed after rejected finish"
pass "12i finishing an empty list is rejected and history is unchanged"

# (13) pantry-aware intelligence: staples, cook-first, pantry-subtracted generate.
# The smoke user's data remains afterwards (no delete-account endpoint), so every
# recipe/ingredient name below carries the per-run $EPOCH tag and assertions only
# look at those tagged names; the check does not depend on prior runs.
TODAY="$(date +%F)"
IN2="$(date -v+2d +%F 2>/dev/null || date -d '+2 days' +%F)"
IN9="$(date -v+9d +%F 2>/dev/null || date -d '+9 days' +%F)"

code="$(req GET "$API/api/v1/users/preferences" -H "$AUTH")" || fail "13a staples default: request failed"
[ "$code" = "200" ] || fail "13a staples default: expected 200, got $code"
jq -e '.stapleNames | index("salt") != null' "$BODY_FILE" >/dev/null || fail "13a staples default: salt missing from stapleNames"
jq -e '.defaultStapleNames | length >= 10' "$BODY_FILE" >/dev/null || fail "13a staples default: defaultStapleNames has fewer than 10 entries"
pass "13a new user has default staples (salt) and a default list of 10+"

code="$(req PATCH "$API/api/v1/users/preferences" -H "$AUTH" -H "$JSON_H" -d '{"stapleNames":[" Salt ","SALT","Olive Oil"]}')" || fail "13b save staples: request failed"
[ "$code" = "200" ] || fail "13b save staples: expected 200, got $code"
jq -e '.stapleNames == ["salt","olive oil"]' "$BODY_FILE" >/dev/null || fail "13b save staples: not canonicalised to [salt, olive oil]"
pass "13b staples saved in canonical form"

BIG_STAPLES="$(jq -nc '{stapleNames: [range(101) | "item\(.)"]}')"
code="$(req PATCH "$API/api/v1/users/preferences" -H "$AUTH" -H "$JSON_H" -d "$BIG_STAPLES")" || fail "13c 101 staples: request failed"
[ "$code" = "400" ] || fail "13c 101 staples: expected 400, got $code"
jq -e '.message | tostring | test("stapleNames")' "$BODY_FILE" >/dev/null || fail "13c 101 staples: message does not mention stapleNames"
code="$(req GET "$API/api/v1/users/preferences" -H "$AUTH")" || fail "13c recheck: request failed"
jq -e '.stapleNames == ["salt","olive oil"]' "$BODY_FILE" >/dev/null || fail "13c staples changed after rejected save"
pass "13c 101 staples rejected with 400 and stored list unchanged"

code="$(req POST "$API/api/v1/pantry" -H "$AUTH" -H "$JSON_H" -d "{\"ingredientName\":\"Smoke spinach $EPOCH\",\"quantity\":1,\"unit\":\"kg\",\"category\":\"vegetable\",\"expiryDate\":\"$IN2\"}")" || fail "13d pantry spinach: request failed"
[ "$code" = "201" ] || fail "13d pantry spinach: expected 201, got $code"
code="$(req POST "$API/api/v1/pantry" -H "$AUTH" -H "$JSON_H" -d "{\"ingredientName\":\"Smoke rice $EPOCH\",\"quantity\":1,\"unit\":\"kg\",\"category\":\"grains\"}")" || fail "13d pantry rice: request failed"
[ "$code" = "201" ] || fail "13d pantry rice: expected 201, got $code"
pass "13d pantry items created (spinach expiring in 2 days, rice without expiry)"

RECIPE_PAYLOAD="$(jq -nc --arg t "$EPOCH" '{name:("Smoke stir fry " + $t),category:"dinner",difficulty:"easy",prepTimeMinutes:5,cookTimeMinutes:10,servings:2,instructions:["Cook everything"],ingredients:[{ingredientName:("Smoke spinach " + $t),quantity:200,unit:"grams"},{ingredientName:("Smoke rice " + $t),quantity:500,unit:"grams"},{ingredientName:"salt",quantity:1,unit:"tsp"},{ingredientName:("Smoke bread flour " + $t),quantity:500,unit:"grams"},{ingredientName:("Smoke bread flour " + $t),quantity:1,unit:"kg"}]}')"
code="$(req POST "$API/api/v1/recipes" -H "$AUTH" -H "$JSON_H" -d "$RECIPE_PAYLOAD")" || fail "13e recipe: request failed"
[ "$code" = "201" ] || fail "13e recipe: expected 201, got $code"
RECIPE_ID="$(jq -r '.id // .data.id // empty' "$BODY_FILE")"
[ -n "$RECIPE_ID" ] || fail "13e recipe: id missing"
pass "13e recipe created"

code="$(req GET "$API/api/v1/recipes/cook-first?today=$TODAY&limit=3" -H "$AUTH")" || fail "13f cook-first: request failed"
[ "$code" = "200" ] || fail "13f cook-first: expected 200, got $code"
jq -e --arg id "$RECIPE_ID" '.items[0].recipe.id == $id' "$BODY_FILE" >/dev/null || fail "13f cook-first: smoke recipe is not ranked first"
jq -e '.items[0].usesExpiring[0].daysLeft == 2' "$BODY_FILE" >/dev/null || fail "13f cook-first: usesExpiring daysLeft is not 2"
code="$(req GET "$API/api/v1/recipes/cook-first?limit=0" -H "$AUTH")" || fail "13f cook-first limit=0: request failed"
[ "$code" = "400" ] || fail "13f cook-first limit=0: expected 400, got $code"
pass "13f cook-first ranks the expiring-spinach recipe first; limit=0 rejected"

PLAN_PAYLOAD="$(jq -nc --arg r "$RECIPE_ID" --arg s "$TODAY" --arg e "$IN9" '{name:"Smoke plan",startDate:$s,endDate:$e,meals:[{recipeId:$r,dayOfWeek:0,mealType:"lunch",servings:2}]}')"
code="$(req POST "$API/api/v1/mealplans" -H "$AUTH" -H "$JSON_H" -d "$PLAN_PAYLOAD")" || fail "13g meal plan: request failed"
[ "$code" = "201" ] || fail "13g meal plan: expected 201, got $code"
PLAN_ID="$(jq -r '.id // .data.id // empty' "$BODY_FILE")"
[ -n "$PLAN_ID" ] || fail "13g meal plan: id missing"
code="$(req POST "$SHOP/generate" -H "$AUTH" -H "$JSON_H" -d "$(jq -nc --arg p "$PLAN_ID" '{mealPlanId:$p}')")" || fail "13g generate: request failed"
[ "$code" = "200" ] || fail "13g generate: expected 200, got $code"
jq -e '.skippedStaples | map(ascii_downcase) | index("salt") != null' "$BODY_FILE" >/dev/null || fail "13g generate: salt not in skippedStaples"
jq -e '.covered | map(.status) | index("full") != null' "$BODY_FILE" >/dev/null || fail "13g generate: no fully covered ingredient"
code="$(req GET "$SHOP/list" -H "$AUTH")" || fail "13g list: request failed"
jq -e --arg t "$EPOCH" '.items | map(select(.itemName | test("smoke bread flour " + $t; "i"))) | length == 1 and .[0].quantity == 1.5 and .[0].unit == "kg"' "$BODY_FILE" >/dev/null || fail "13g generate: bread flour not merged to 1.5 kg"
jq -e --arg t "$EPOCH" '[.items[] | select(.itemName | test("smoke rice " + $t + "|^salt"; "i"))] | length == 0' "$BODY_FILE" >/dev/null || fail "13g generate: covered rice or staple salt appears on the list"
pass "13g generate skips staples, subtracts pantry, merges 500 g + 1 kg to 1.5 kg"

code="$(req POST "$SHOP/generate" -H "$AUTH" -H "$JSON_H" -d "$(jq -nc --arg p "$PLAN_ID" '{mealPlanId:$p}')")" || fail "13h regenerate: request failed"
[ "$code" = "200" ] || fail "13h regenerate: expected 200, got $code"
jq -e '.added == 0 and .merged == 0' "$BODY_FILE" >/dev/null || fail "13h regenerate: second generate changed the list"
jq -e --arg t "$EPOCH" '.list.items | map(select(.itemName | test("smoke bread flour " + $t; "i"))) | length == 1 and .[0].quantity == 1.5' "$BODY_FILE" >/dev/null || fail "13h regenerate: bread flour quantity changed"
pass "13h generating the same plan twice adds nothing (already on your list)"

# (8) frontend bundle check
if [ "$API_ONLY" = "false" ]; then
  API_HOST="${API#http://}"
  API_HOST="${API_HOST#https://}"
  # The landing page does not load the API client chunk, so scan the auth pages too.
  js_paths=""
  for page in "" "/login" "/signup"; do
    html="$(curl -sS --max-time 30 "$FE$page")" || fail "8 frontend: could not fetch $FE$page"
    js_paths="$js_paths
$(printf '%s' "$html" | grep -oE '/_next/static/[^"'"'"' )\\]+\.js' || true)"
  done
  js_paths="$(printf '%s\n' "$js_paths" | sed '/^$/d' | sort -u)"
  [ -n "$js_paths" ] || fail "8 frontend: no /_next/static js found in HTML"
  found_api=false
  chunk_failures=0
  while IFS= read -r p; do
    if ! js="$(curl -sS --max-time 30 "$FE$p")"; then
      chunk_failures=$((chunk_failures + 1))
      echo "WARN: 8 frontend: could not fetch chunk $p" >&2
      continue
    fi
    if printf '%s' "$js" | grep -q "localhost:3001"; then
      fail "8 frontend: bundle $p still references localhost:3001"
    fi
    if printf '%s' "$js" | grep -qF "$API_HOST"; then
      found_api=true
    fi
  done <<< "$js_paths"
  [ "$found_api" = "true" ] || fail "8 frontend: no bundle contains API host $API_HOST ($chunk_failures chunk fetch failures)"
  pass "8 frontend bundle contains API host and no localhost:3001"
fi

echo "ALL CHECKS PASSED (smoke user $EMAIL remains in the DB; no delete-account endpoint)"
