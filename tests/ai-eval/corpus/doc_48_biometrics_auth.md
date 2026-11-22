# Mobile Biometric Authentication

SupportPilot Mobile safeguards ticket data on portable devices using hardware biometrics.

## Supported Technologies

- iOS: FaceID and TouchID via `expo-local-authentication`.
- Android: BiometricPrompt API (Fingerprint, Face Unlock, Iris).

## Inactivity Timeout

After 5 minutes of background inactivity, the mobile application locks automatically, prompting the agent for biometric re-verification before showing ticket contents.
