# OpenID Connect and OAuth 2.0 Social Logins

SupportPilot supports OpenID Connect (OIDC) and OAuth 2.0 authentication for customer portal and agent logins.

## Supported Providers

- Google OAuth 2.0
- GitHub OAuth
- Microsoft Entra OIDC
- Custom OIDC Provider (Enterprise tier)

## Setup Steps

1. In your developer console (e.g. Google Cloud or GitHub Developer Settings), create an OAuth 2.0 Client.
2. Set the authorized redirect URI to `https://api.supportpilot.io/v1/auth/oauth/callback`.
3. Enter Client ID and Client Secret in SupportPilot Admin Console under **Settings > Authentication > OIDC Providers**.
4. Configure required scopes: `openid`, `email`, `profile`.

Token exchange uses PKCE (Proof Key for Code Exchange) with SHA-256 challenges to mitigate interception attacks.
