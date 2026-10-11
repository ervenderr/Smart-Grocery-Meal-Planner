#!/usr/bin/env bash
# Export the archive for App Store Connect and upload it to TestFlight.
# Uses `xcodebuild -exportArchive` with ExportOptions destination=upload (works with API-key auth).
#
# Usage: upload-testflight.sh        (run archive-ios.sh first)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/asc-env.sh"
require_cmd xcodebuild
# Unlock the dedicated signing keychain and make sure the App Store profile exists (see setup-signing.sh).
bash "$SCRIPT_DIR/setup-signing.sh" --unlock-only

ARCHIVE="$mobile_dir/build/archive/Kumaun.xcarchive"
[ -d "$ARCHIVE" ] || die "no archive at $ARCHIVE; run archive-ios.sh first"
EXPORT_DIR="$mobile_dir/build/export"
OPTS="$mobile_dir/build/ExportOptions.plist"
rm -rf "$EXPORT_DIR"; mkdir -p "$EXPORT_DIR"

TEAM="$(cd "$mobile_dir/ios/App" && xcodebuild -project App.xcodeproj -scheme App -showBuildSettings 2>/dev/null \
  | awk -F' = ' '/^ *DEVELOPMENT_TEAM =/{print $2; exit}')"
[ -n "$TEAM" ] || die "DEVELOPMENT_TEAM not set in the Xcode project"

cat > "$OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>$BUNDLE_ID</key><string>Kumaun App Store</string></dict>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST

log "exporting and uploading $(cat "$mobile_dir/build/archive/BUILD_NUMBER" 2>/dev/null || echo '?')"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$OPTS" -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
log "upload step finished; run: node scripts/asc-testflight.mjs wait"
