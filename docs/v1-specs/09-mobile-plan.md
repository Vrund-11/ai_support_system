# Mobile Plan (Expo agent app)

## Stack

Expo (current SDK), Expo Router, TypeScript, TanStack Query, Zustand, socket.io-client, expo-secure-store, expo-local-authentication, expo-notifications plus Firebase Cloud Messaging, expo-image-picker, expo-document-picker, Sentry or Firebase Crashlytics (dev client).

## Screens

`(auth)/login`, `(tabs)/inbox`, `(tabs)/mine`, `(tabs)/notifications`, `(tabs)/settings`, `ticket/[id]` (thread, composer, quick actions, AI suggestion), `modal/filters`.

## Behaviours

- Tokens in secure store; refresh rotation handled by the shared api-client interceptor; biometric unlock after first login.
- Socket connects when app is foregrounded; push handles background.
- Push payload: `{ type, ticketId, tenantId }`; tapping deep-links to `ticket/[id]`.
- Offline outbox stores unsent replies and flushes on reconnect with `clientId` for dedupe.
- Accessibility labels, dynamic type, 44pt touch targets.

## Free build and release path

1. `eas build:configure`; profiles in `eas.json`: `development` (dev client), `preview` (internal distribution, Android APK), `production`.
2. EAS free tier builds Android and iOS in the cloud with queue limits. iOS installs need an Apple developer account; document it as optional and keep Android as the verified path.
3. **Fastlane** lanes in `apps/mobile/fastlane/Fastfile`: `beta_android` (build or take the EAS artifact and upload to Play internal track using a service account; document the dry-run if no Play account), `screenshots`, `bump_version`. Run what is possible locally; clearly mark steps that need paid store accounts.
4. EAS Update for JS-only OTA updates with runtime version policy `appVersion`.
5. GitHub Actions `mobile.yml`: on merge to main run `eas build --profile preview --non-interactive` with `EXPO_TOKEN` secret and attach the build URL to the run summary.

## Firebase (free Spark plan)

Create a project, add Android app, download `google-services.json`, enable Cloud Messaging; server side uses FCM HTTP v1 with a service-account JSON stored as a secret. Handle invalid tokens by removing them from `deviceTokens`.

## Testing

Jest + React Native Testing Library for components and hooks; mock socket and API; manual device checklist per release (login, biometric, push tap, offline send, attachment upload).
