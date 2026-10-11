#!/usr/bin/env bash
# One-time (idempotent) signing setup for TestFlight uploads, driven by the ASC API key.
# Why: Apple's cloud signing at export time returns "Cloud signing permission error" for this key, and
# the login keychain cannot sign non-interactively (errSecInternalComponent). So we create our own
# Apple Distribution certificate through the API, keep its private key in a dedicated keychain whose
# password lives only in ~/.appstoreconnect/signing/ (outside the repo), and use a manual App Store profile.
#
# Usage: setup-signing.sh [--unlock-only]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/asc-env.sh"

DIR="$HOME/.appstoreconnect/signing"
KC="$HOME/Library/Keychains/kumaun-signing.keychain-db"
IDENTITY="Apple Distribution"

unlock() {
  [ -f "$KC" ] && [ -f "$DIR/kc.pass" ] || die "signing keychain missing; run scripts/setup-signing.sh first"
  security unlock-keychain -p "$(cat "$DIR/kc.pass")" "$KC"
  case "$(security list-keychains -d user)" in
    *kumaun-signing*) ;;
    *) security list-keychains -d user -s "$KC" "$HOME/Library/Keychains/login.keychain-db" ;;
  esac
  security find-identity -v -p codesigning "$KC" | grep -q "$IDENTITY" || die "no $IDENTITY identity in $KC"
  ls "$HOME/Library/MobileDevice/Provisioning Profiles" 2>/dev/null | grep -q mobileprovision \
    || die "no provisioning profile installed; run scripts/setup-signing.sh"
}

if [ "${1:-}" = "--unlock-only" ]; then unlock; exit 0; fi

mkdir -p "$DIR"; chmod 700 "$DIR"
if [ ! -f "$KC" ]; then
  [ -f "$DIR/dist.key" ] || openssl req -new -newkey rsa:2048 -nodes -keyout "$DIR/dist.key" -out "$DIR/dist.csr" \
    -subj "/CN=Kumaun Distribution/C=US" 2>/dev/null
  chmod 600 "$DIR/dist.key"
  CERT_ID="$(node "$SCRIPT_DIR/asc-cert.mjs" "$DIR")"
  KCPASS="$(openssl rand -hex 16)"; P12PASS="$(openssl rand -hex 12)"
  printf %s "$KCPASS" > "$DIR/kc.pass"; chmod 600 "$DIR/kc.pass"
  openssl x509 -inform der -in "$DIR/dist.cer" -out "$DIR/dist.pem"
  openssl pkcs12 -export -legacy -inkey "$DIR/dist.key" -in "$DIR/dist.pem" -out "$DIR/dist.p12" -passout "pass:$P12PASS"
  security create-keychain -p "$KCPASS" "$KC"
  security set-keychain-settings -lut 21600 "$KC"
  security unlock-keychain -p "$KCPASS" "$KC"
  security import "$DIR/dist.p12" -k "$KC" -P "$P12PASS" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
  curl -sSf -o "$DIR/wwdr.cer" https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
  security import "$DIR/wwdr.cer" -k "$KC" -T /usr/bin/codesign >/dev/null || true
  security set-key-partition-list -S apple-tool:,apple: -s -k "$KCPASS" "$KC" >/dev/null
  echo "$CERT_ID" > "$DIR/cert.id"
fi
node "$SCRIPT_DIR/asc-profile.mjs" "$(cat "$DIR/cert.id")"
unlock
log "signing ready"
