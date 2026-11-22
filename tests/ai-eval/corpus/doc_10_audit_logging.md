# Security Event Audit Logs and SIEM Export

Audit logs maintain a tamper-evident record of all security-sensitive actions performed in SupportPilot.

## Tracked Events

- User authentications: Logins, logouts, failed attempts, password changes.
- Administrative updates: Role changes, SSO configuration, API key generations.
- Data exports: Bulk ticket exports, customer data downloads.
- Ticket deletions and macro modifications.

## SIEM Integration

Enterprise plans can stream audit logs directly to external security platforms (Splunk, Datadog, AWS CloudWatch) via HTTPS Webhooks or S3 log shipping. Logs follow the standardized CEF (Common Event Format) with JSON metadata.
