#!/usr/bin/env bash
# Throwaway production account helpers for the Simulator smoke E2E.
# Source after common.sh. Credentials live only in exported env vars
# (E2E_EMAIL, E2E_PASSWORD); they are never echoed or written to disk.
# Functions: e2e_create_account, e2e_delete_account. Sets E2E_CREATED (0|1).

E2E_CREATED=0
E2E_API_BASE="${API_URL:-$PROD_API_URL_DEFAULT}"
E2E_API_BASE="${E2E_API_BASE%/}"

_e2e_json_body() {
  # Reads E2E_EMAIL / E2E_PASSWORD from the environment (not argv).
  jq -n '{email: env.E2E_EMAIL, password: env.E2E_PASSWORD, firstName: "E2E", lastName: "Smoke"}'
}

_e2e_password_body() {
  jq -n '{email: env.E2E_EMAIL, password: env.E2E_PASSWORD}'
}

e2e_create_account() {
  require_cmd curl; require_cmd jq; require_cmd openssl
  if [ -n "${E2E_EMAIL:-}" ] && [ -n "${E2E_PASSWORD:-}" ]; then
    E2E_CREATED=0
    export E2E_EMAIL E2E_PASSWORD
    log "using account supplied through the environment"
    return 0
  fi
  local rand pw code
  rand="$(openssl rand -hex 2)"
  E2E_EMAIL="kitcha-e2e+$(date +%s)-${rand}@example.com"
  pw="$(openssl rand -base64 18 | tr -d '/+=')"
  E2E_PASSWORD="${pw}Aa1"
  export E2E_EMAIL E2E_PASSWORD
  code="$(_e2e_json_body | curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "$E2E_API_BASE/api/v1/auth/signup" \
    -H 'Content-Type: application/json' --data @-)" || die "signup request failed"
  case "$code" in
    200|201) E2E_CREATED=1; log "throwaway account created (HTTP $code)" ;;
    *) die "signup returned HTTP $code" ;;
  esac
}

e2e_delete_account() {
  [ -n "${E2E_EMAIL:-}" ] && [ -n "${E2E_PASSWORD:-}" ] || return 0
  local token code
  token="$(_e2e_password_body | curl -sS -X POST "$E2E_API_BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' --data @- | jq -r '.data.token // .token // empty' 2>/dev/null)" || token=""
  if [ -z "$token" ]; then
    log "account already gone or login failed; nothing to delete"
    return 0
  fi
  code="$(jq -n '{password: env.E2E_PASSWORD}' | curl -sS -o /dev/null -w '%{http_code}' \
    -X DELETE "$E2E_API_BASE/api/v1/users/me" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" --data @-)" || code="000"
  token=""
  case "$code" in
    200|204) log "account deleted" ;;
    *) log "WARNING: account deletion returned HTTP $code" ;;
  esac
}
