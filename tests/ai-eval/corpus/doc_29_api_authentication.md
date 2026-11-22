# API Authentication and Bearer Token Security

API endpoints require authentication via Bearer API keys.

## Generating API Keys

1. Navigate to **Settings > Integrations > API Keys**.
2. Click **Generate New Key**, enter a descriptive name, and select permissions (read-only or read-write).
3. Copy the secret key immediately. It is shown only once and stored using SHA-256 hashing.

## Using API Keys in Requests

Include the key in the HTTP `Authorization` header:

```bash
curl -H "Authorization: Bearer sp_live_38f2910ba7492c" https://api.supportpilot.io/api/v1/tickets
```

Do not commit API keys into source code repositories or expose them in client-side code.
