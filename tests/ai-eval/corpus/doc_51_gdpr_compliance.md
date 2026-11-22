# GDPR Compliance and Right to be Forgotten

SupportPilot complies with the General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA).

## Right to Erasure Workflow

1. Navigate to **Customer Profile > Privacy Actions > Delete Customer Data**.
2. Confirming deletion executes a permanent cascade:
   - Customer name, email, phone number, and custom fields are scrubbed from MongoDB.
   - Message contents authored by the customer are replaced with `[Deleted under GDPR Article 17]`.
   - Vector embeddings associated with customer tickets are permanently removed.
   - A cryptographic deletion certificate is generated and logged in the audit trail.
