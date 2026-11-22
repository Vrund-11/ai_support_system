# REST API v1 Architecture and Conventions

The SupportPilot REST API enables developers to automate ticket management, sync customer data, and integrate external CRM platforms.

## Conventions

- Base URL: `https://api.supportpilot.io/api/v1`
- Protocol: HTTPS with TLS 1.3 required.
- Format: JSON payloads (`Content-Type: application/json`).
- Errors: All error responses conform to RFC 7807 Problem Details with standardized fields: `type`, `title`, `status`, `detail`, `instance`.
- Time formats: ISO 8601 UTC strings (`YYYY-MM-DDTHH:MM:SSZ`).
