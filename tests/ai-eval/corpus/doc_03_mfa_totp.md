# Multi-Factor Authentication and TOTP Pairing

Multi-Factor Authentication (MFA) adds a critical layer of defense against credential stuffing and brute force attacks.

## Enforced MFA

Organizations can mandate MFA for all users or restrict enforcement to Agent, Team Lead, and Admin roles. When enforced, users without paired MFA cannot access tickets or administrative views.

## Pairing Authenticator Apps

SupportPilot generates an RFC 6238 compliant TOTP secret:

1. Open your authenticator app (Google Authenticator, Authy, 1Password, or Bitwarden).
2. Scan the provided QR code or manually enter the 32-character base32 secret key.
3. Submit the 6-digit verification code to confirm pairing.
4. Download and securely store the 10 emergency backup recovery codes.

Each backup code is single-use and hashed using bcrypt before storage.
