# 06 Mobile: Build Evidence and Real Push

## Findings being fixed

`eas.json` and Fastfile exist but no build ever ran; push uses a mock; no Firebase; no crash reporting.

## Step 1: First real EAS build (Android)

```powershell
npm i -g eas-cli
eas login
cd apps/mobile
eas build:configure
eas build --platform android --profile preview
```

- Use free tier; builds queue. Preview profile should produce an installable APK (`"android": { "buildType": "apk" }`).
- Install on a physical Android device or an emulator. Record the build URL, build id and a short screen recording or screenshots into `evidence/mobile/`.
- iOS: needs a paid Apple developer account for device builds. Document "iOS build not done" and keep Android as the verified path. Expo Go or simulator on a Mac can demonstrate UI only.
- Set runtime/app versions, bundle identifiers, and icons; fix any config errors.

## Step 2: Fastlane (be honest about Windows)

Fastlane does not run natively on Windows. Use WSL2 Ubuntu.

```bash
sudo apt install ruby-full build-essential
sudo gem install fastlane
cd apps/mobile && fastlane lanes
```

Lanes to make truly runnable without store accounts: `bump_version` (updates version/buildNumber in app.json), `build_android_local` (prebuild + gradle `assembleRelease` or call `eas build --local`). The `beta` upload lane needs a Google Play service account; keep it but mark "requires Play Console account; not executed". Record which lanes you ran and paste outputs to `evidence/mobile/fastlane.txt`.

## Step 3: Real push notifications (choose one, name it correctly)

Option A (simplest, honest label "Expo push"): use Expo Push Service. Register Expo push token, send from notification-service via `expo-server-sdk`, handle receipts and remove invalid tokens.
Option B (label "FCM"): Firebase project (free Spark plan), add Android app, `google-services.json`, dev build (not Expo Go), device token via `getDevicePushTokenAsync`, server sends via FCM HTTP v1 with `firebase-admin` and a service-account JSON secret; remove invalid tokens on `messaging/registration-token-not-registered`.
For either: deep link payload `{ type, ticketId, tenantId }` opens `supportpilot://ticket/:id`; add a test for the notification response handler and a manual checklist. Replace the "mock push" in notification-service with the real sender behind a provider interface, mock only in tests. Save a screen recording of a push arriving.

## Step 4: Crash and error reporting (optional)

Sentry (free tier) via `sentry-expo`/`@sentry/react-native` or Firebase Crashlytics (needs dev build). If skipped, do not list Crashlytics or Sentry.

## Step 5: GitHub Actions for mobile

`mobile.yml`: on main, `eas build --platform android --profile preview --non-interactive` using `EXPO_TOKEN` secret; upload build URL to the run summary. Also run typecheck, lint and Jest/Vitest for mobile on every PR.

## Step 6: Mobile tests

Keep the 14 existing tests; add tests for outbox flush ordering and dedupe, token refresh, deep link routing. Optional: Maestro flows (free) for login -> open ticket -> send reply.

## Acceptance checklist

- [ ] One EAS Android preview build completed and installed; evidence saved.
- [ ] Fastlane lanes that can run have run (via WSL2); the rest labelled not executed.
- [ ] Real push (Expo or FCM) received on a device; recording saved; invalid token cleanup tested.
- [ ] `mobile.yml` has a green run.

## Resume gating

Allowed: "Expo React Native agent app with biometric unlock, secure storage, offline outbox and deep links; Android build via EAS; push via [Expo Push | FCM]". Do not claim iOS store release, Crashlytics, or Fastlane store upload unless executed.
