# Kitcha for iPhone

Capacitor iOS app (milestone v2.0, Phase 10). Built from a static export of `../frontend`.
See `.planning/ROADMAP.md` and `.planning/research-v2/`.

## Prerequisites

- Xcode 26.6+ with an iOS Simulator runtime installed
- Node 22+
- `cd mobile && npm ci` (the generated Swift package resolves plugin paths into `mobile/node_modules`)
- Network access on the first build (Swift Package Manager fetches Capacitor)

## Build and run in the Simulator

```bash
cd mobile
npm run build:ios      # export frontend, cap sync, unsigned Simulator build
npm run sim:run        # boot Simulator, install, launch app.kitcha.mobile, print pid
npm run verify:bundle  # security and size gate on the export
```

- `API_URL` (default `https://kitcha-api-production.up.railway.app`) is baked into the export. It must start with `https://`.
- `SIM_DEVICE` picks the Simulator by name (default `iPhone 17`, falls back to the first available iPhone).
- Flags: `build-ios.sh --skip-export | --skip-xcode | --e2e`; `sim-run.sh --screenshot <png> | --no-install | --relaunch`.
- Run `npm run verify:bundle` after `npm run build:ios`. It fails on a `server` key or cleartext in the Capacitor config, a bundle over `MAX_BUNDLE_KB` (default 10240), a missing https API base, secret-like strings, or E2E markers in a release export.

## How it works

- The frontend is exported statically with `BUILD_TARGET=native` and copied into the app by `cap sync`. There is no `server.url`; the app never loads remote web content.
- The app navigates client-side only (no server-rendered routes), see research Pitfall 1.
- The auth token is stored in the iOS Keychain; expiry reminders use local notifications.

## Run on your iPhone

1. Open `mobile/ios/App/App.xcodeproj` in Xcode.
2. Select the **App** target, then **Signing and Capabilities**.
3. Check **Automatically manage signing**.
4. Choose your **Personal Team** (a free Apple ID works). If none is listed: Xcode > Settings > Accounts > add your Apple ID.
5. If Xcode reports the bundle id is taken, change `app.kitcha.mobile` to a unique one.
6. Connect the iPhone and select it as the run destination.
7. Press **Run**.
8. On first run, trust the developer profile on the phone: Settings > General > VPN and Device Management. Enable Developer Mode if prompted (Settings > Privacy and Security).
9. Free-team builds expire after 7 days; run again from Xcode to refresh.

## Real-device checklist (human_needed)

- [ ] Native barcode scan of a real product
- [ ] Manual entry fallback works when camera permission is denied
- [ ] Haptic feel on: check shopping item, quantity step, cooked it, scan success
- [ ] Notification delivered for an item expiring tomorrow, including in airplane mode
- [ ] Tapping the notification opens Pantry filtered to expiring
- [ ] Dynamic Island and safe-area insets look right
- [ ] Keyboard clearance in bottom sheets
- [ ] Status bar legibility
- [ ] Login against production from the phone (CORS origin `capacitor://localhost`)
- [ ] Session survives an app restart

## Troubleshooting

- First build is slow or fails offline: SPM needs network once to fetch packages.
- Clean build: `rm -rf mobile/build`.
- The Keychain survives an uninstall; the app clears it on first launch.

## Phase 10 verification results

Date: 2026-10-11. Device: iPhone 17 Simulator, iOS 26.5 (Xcode simctl). Command: `cd mobile && npm run e2e:ios`.

| Step | Result | Notes |
|------|--------|-------|
| render | pass | origin `capacitor://localhost` (bundle, no remote content) |
| login | pass | throwaway production account, 0 token copies in localStorage |
| relaunch | pass | after terminate and relaunch the Keychain still yields the access token, authenticated, 0 leaks |
| scan | pass | Simulator (virtual device) routes to manual entry; injected code `4800016644801` passes the adapter |
| haptics | pass | no-throw check only (feel is human_needed) |
| notifications | pass (gated) | permission stayed `prompt` (the system alert cannot be answered on a headless Simulator and `simctl privacy` has no notifications service), so the scheduler correctly scheduled nothing; pending-count check is human_needed |
| done | pass | |

The throwaway account is deleted and E2E build output (`frontend/out`, `ios/App/App/public`) is wiped on exit. The Simulator build is ad-hoc signed (`CODE_SIGN_IDENTITY=-`): fully unsigned builds cannot use the Keychain (OSStatus -34018).

Screenshots (`.planning/phases/10-capacitor-ios-shell/screenshots/`): `00-release-login.png` (release build login), `01-e2e-dashboard.png`, `02-e2e-pantry.png` (new account onboarding with the system notification alert visible), `report.json`.

### human_needed checklist (status: pending (user))

- [ ] Real barcode scan of a product on the iPhone
- [ ] Haptic feel (check shopping item, quantity step, cooked it, scan success)
- [ ] Notification delivery at the scheduled time, including airplane mode, and tap deep link to Pantry expiring filter
- [ ] Dynamic Island and keyboard clearance in bottom sheets
- [ ] Status bar legibility on device
- [ ] Signing team setup and run on the connected iPhone (00008110-001914C02146401E)
- [ ] Login from the device (CORS `capacitor://localhost`)
- [ ] Notification pending-count check after granting permission (Simulator could not grant it)
