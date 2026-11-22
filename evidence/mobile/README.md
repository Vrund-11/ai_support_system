# Mobile Architecture & Performance Evidence (Milestone 4 - Area 06)

## Overview

SupportPilot Mobile is a cross-platform React Native / Expo application (`apps/mobile`) designed for agents and supervisors responding to tickets on Android and iOS devices.

### Architecture Components

- **State & Stores**: Zustand store (`src/lib/auth.store.ts`) for JWT auth token lifecycle, refresh token rotation, and biometric enrolment.
- **Offline Outbox**: Client-side SQLite/AsyncStorage outbox queue (`src/lib/outbox.ts`) with strict FIFO drain ordering and UUID `clientId` deduplication.
- **Real-Time & Sync**: Socket.io client (`src/lib/socket.ts`) with reconnection backoff and token refresh listeners.
- **Deep Linking**: Schema parser (`src/lib/notifications.ts`) resolving `supportpilot://ticket/:id`, `supportpilot://inbox`, and `supportpilot://notifications`.
- **Push Notifications**: Server-side multi-provider abstraction (`apps/notification-service/src/push/`) supporting `ExpoPushProvider` and `TestPushProvider` with invalid token lifecycle eviction.

## Directory Structure

- `apps/mobile/app.json`: Expo application manifest configured with `android.versionCode: 1`.
- `apps/mobile/eas.json`: Expo Application Services build configuration with `preview` APK profile.
- `apps/mobile/fastlane/Fastfile`: Fastlane automation with `bump_version`, `build_android_local`, and `beta_android` lanes.
- `.github/workflows/mobile.yml`: GitHub Actions CI workflow running typecheck, lint, test, and EAS preview triggers.

## Evidence Artifacts

- [build-info.md](./build-info.md) - EAS configuration, Android versionCode, and build profile details.
- [fastlane.txt](./fastlane.txt) - Fastlane automation lanes, WSL2 environment notes, execution transcripts.
- [push-verification.md](./push-verification.md) - Push provider interface, token cleanup validation, deep link routing specs.
