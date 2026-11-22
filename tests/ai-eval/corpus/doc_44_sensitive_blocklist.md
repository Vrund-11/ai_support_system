# PII Redaction and Sensitive Topic Guardrails

Data protection guardrails prevent sensitive customer data from entering LLM context prompts.

## Guardrail Rules

- **PII Scrubbing**: Regular expressions redact Social Security Numbers, credit card numbers, and API secrets before LLM ingestion.
- **Blocklisted Topics**: Legal threats, cryptographic key requests, customer database export requests, and employee compensation inquiries are strictly blocked from automated AI responses.
- Blocked inquiries immediately trigger human handoff with `reason: "sensitive_topic_blocklist"`.
