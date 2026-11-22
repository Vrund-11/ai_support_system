# Password Complexity and Expiration Policies

SupportPilot enforces robust password policies to ensure compliance with SOC 2 Type II and ISO 27001 standards.

## Password Requirements

- Minimum length: 12 characters (16 characters recommended for Admins).
- Character sets: At least one uppercase letter, one lowercase letter, one digit, and one special character (`!@#$%^&*()-_+=`).
- Breach checking: Passwords are automatically checked against the HaveIBeenPwned k-Anonymity API during registration and updates.
- History restriction: Users cannot reuse any of their previous 5 passwords.

## Expiration and Rotation

Administrators can configure password expiration intervals of 60, 90, or 180 days. Users receive automated email notifications 14 days and 3 days prior to required rotation.
