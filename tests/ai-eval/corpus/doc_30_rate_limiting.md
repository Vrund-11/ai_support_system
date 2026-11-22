# API Rate Limiting and Retry Guidelines

Rate limiting protects SupportPilot microservices from denial of service and noisy neighbor starvation.

## Rate Limits

- Per IP Address: 120 requests per minute.
- Per Tenant (API Key): 1,000 requests per minute.
- Ingestion Endpoints (`/v1/kb/ingest`): 60 requests per minute.

## Rate Limit Response Headers

- `X-RateLimit-Limit`: Maximum requests allowed in the current window.
- `X-RateLimit-Remaining`: Remaining requests allowed.
- `X-RateLimit-Reset`: Unix timestamp when the current quota window resets.
- HTTP Status `429 Too Many Requests`: Exceeded quota. Includes `Retry-After: <seconds>` header.
