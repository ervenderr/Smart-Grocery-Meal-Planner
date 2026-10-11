#!/usr/bin/env bash
# Build the release web export, sync Capacitor, and create a signed .xcarchive.
#
# Usage: archive-ios.sh [--skip-export]
# Env:   BUILD_NUMBER (default: UTC timestamp yymmddHHMM, always increasing)
#        API_URL      (default production, https only; baked into the export)
# Output: mobile/build/archive/Kumaun.xcarchive ; prints the build number to stdout.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/asc-env.sh"

SKIP_EXPORT=()
[ "${1:-}" = "--skip-export" ] && SKIP_EXPORT=(--skip-export)
for c in xcodebuild node npm; do require_cmd "$c"; done

BUILD_NUMBER="${BUILD_NUMBER:-$(date -u +%y%m%d%H%M)}"
case "$BUILD_NUMBER" in ''|*[!0-9.]*) die "BUILD_NUMBER must be digits/dots" ;; esac

# Release web export + cap sync, no simulator build. Scrub E2E vars so a release never ships them.
env -u NEXT_PUBLIC_E2E -u E2E_EMAIL -u E2E_PASSWORD \
  bash "$SCRIPT_DIR/build-ios.sh" --skip-xcode ${SKIP_EXPORT[@]+"${SKIP_EXPORT[@]}"}
bash "$SCRIPT_DIR/verify-bundle.sh"

# Default: archive unsigned and let `-exportArchive` sign with Apple's cloud-managed distribution
# certificate (API key). Set LOCAL_SIGN=1 to sign at archive time with the login-keychain identity
# (fails with errSecInternalComponent when the keychain is locked or the session is non-interactive).
ARCHIVE_SIGN_ARGS=()
[ "${LOCAL_SIGN:-0}" = "1" ] || ARCHIVE_SIGN_ARGS=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=)

ARCHIVE="$mobile_dir/build/archive/Kumaun.xcarchive"
rm -rf "$ARCHIVE"
mkdir -p "$(dirname "$ARCHIVE")"
log "archiving build $BUILD_NUMBER"
(
  cd "$mobile_dir/ios/App"
  xcodebuild -project App.xcodeproj -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$ASC_KEY_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    ${ARCHIVE_SIGN_ARGS[@]+"${ARCHIVE_SIGN_ARGS[@]}"} \
    archive -quiet
) >&2
[ -d "$ARCHIVE" ] || die "archive missing"
echo "$BUILD_NUMBER" > "$mobile_dir/build/archive/BUILD_NUMBER"
log "archive ready: $ARCHIVE"
echo "$BUILD_NUMBER"
