# Mobile Build Configuration & Environment Evidence (Feature 40)

## Build Metadata & Verification

- **Package Name**: `com.supportpilot.agent`
- **Application Slug**: `supportpilot-agent`
- **Current Version**: `1.0.0`
- **Android Version Code**: `1` (Verified in `apps/mobile/app.json`)
- **Expo SDK Version**: `52`
- **Deep Link Custom Scheme**: `supportpilot://`

### EAS Configuration (`apps/mobile/eas.json`)

The EAS build configuration defines three deployment profiles:

1. **development**: Internal client distribution with `developmentClient: true`.
2. **preview**: Standalone Android APK (`android.buildType: "apk"`) with `distribution: "internal"`. Used for direct sideloading and internal QA testing without requiring Google Play Store submission.
3. **production**: Generates Android App Bundle (`android.buildType: "app-bundle"`) and signed iOS release (`simulator: false`).

### Honest Environment Disclosure

Per project ground rules in `AGENTS.md` and `docs/01-free-tools-and-aws-emulation.md`:

- **No Paid Store Accounts**: Neither an Apple Developer Enterprise/Individual account ($99/yr) nor a Google Play Developer account ($25 one-time) is provisioned for this development environment.
- **Store Submission Lanes**: In `apps/mobile/fastlane/Fastfile`, store submission lanes (`beta_android`, `upload_to_play_store`) are defined syntactically but marked unexecuted due to absent API service account keys (`SUPPORTS_PLAY_STORE_KEY`).
- **Reproducible Local Alternative**: The `build_android_local` lane executes `npx expo prebuild` and invokes Gradle assemble (`gradlew assembleRelease`), creating a standalone release APK for testing.

### Local APK Build Procedure

To build the preview APK locally:

```bash
cd apps/mobile
# 1. Generate native Android Gradle project
npx expo prebuild --platform android --clean

# 2. Compile release APK
cd android && ./gradlew assembleRelease
# Output located at: android/app/build/outputs/apk/release/app-release.apk
```
