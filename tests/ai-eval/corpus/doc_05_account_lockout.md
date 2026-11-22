# Account Lockout Triggers and Unlock Workflows

To thwart automated credential brute-force attacks, SupportPilot implements tiered account lockouts.

## Lockout Thresholds

- After 5 consecutive failed login attempts within 15 minutes, the account is temporarily locked for 15 minutes.
- After 10 consecutive failed attempts, the account enters a hardened locked state requiring email verification or admin intervention.

## Unlock Procedures

1. **Automated Email Link**: An email containing a cryptographically signed HMAC token is dispatched immediately. Clicking the link verifies ownership and unlocks the account. Tokens expire in 15 minutes.
2. **Administrator Manual Unlock**: An Organization Owner or Admin can navigate to **Settings > Team > [User Profile]** and select **Unlock Account**.
3. **Audit Log Record**: Every lockout and unlock action produces a high-severity entry in the organization audit log including the originating IP address and user agent.
