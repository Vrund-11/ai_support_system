# Webhook Signature Verification with HMAC-SHA256

To guarantee payload authenticity and prevent replay attacks, all outbound webhooks include cryptographic signatures.

## Verification Headers

- `X-SupportPilot-Timestamp`: Unix epoch timestamp when the event was dispatched.
- `X-SupportPilot-Signature-256`: Hexadecimal HMAC-SHA256 signature.

## Verification Algorithm

1. Extract the timestamp header and raw HTTP request body string.
2. Concatenate: `signature_payload = timestamp + "." + raw_body`.
3. Compute `expected_signature = hmac_sha256(webhook_secret, signature_payload)`.
4. Use constant-time string comparison (`timingSafeEqual`) to verify against the header.
5. Reject messages where timestamp is older than 300 seconds (5 minutes) to prevent replay attacks.
