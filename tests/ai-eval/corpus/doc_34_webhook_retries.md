# Webhook Delivery Retries and Dead Letter Queue

SupportPilot ensures reliable webhook delivery even when subscriber endpoints experience downtime.

## Retry Schedule

If a subscriber endpoint returns an HTTP 5xx error or times out (timeout = 10s), delivery is retried with exponential backoff and jitter:

1. Attempt 1: Immediate.
2. Attempt 2: 1 minute later.
3. Attempt 3: 5 minutes later.
4. Attempt 4: 30 minutes later.
5. Attempt 5: 2 hours later.

After 5 failed attempts, the message transitions to the Dead Letter Queue (DLQ). Admins can inspect failed payloads and trigger redrives from the Admin Dashboard.
