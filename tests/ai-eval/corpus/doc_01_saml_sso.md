# Single Sign-On Configuration with SAML 2.0

SupportPilot enables enterprise teams to authenticate users using SAML 2.0 identity providers including Okta, Microsoft Azure Active Directory (Entra ID), Google Workspace, and PingIdentity.

## Configuration Requirements

Before enabling SAML SSO, ensure your organization has an Enterprise subscription tier and you hold the Owner or Admin role.

1. Navigate to **Organization Settings > Security > SAML SSO**.
2. Copy the **Assertion Consumer Service (ACS) URL**: `https://api.supportpilot.io/v1/auth/saml/callback`.
3. Copy the **Audience URI (Entity ID)**: `urn:supportpilot:sp:<tenant_id>`.
4. Upload your Identity Provider Metadata XML or enter the Single Sign-On URL, Entity ID, and X.509 Signing Certificate.
5. Choose whether to enforce **Just-In-Time (JIT) Provisioning** for new agents.

## Enforcing SSO

Once tested successfully, toggle **Enforce SAML SSO** to redirect all non-breakglass login attempts through your identity provider. Breakglass accounts require hardware security keys or secondary TOTP.
