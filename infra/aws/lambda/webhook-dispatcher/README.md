# Webhook Dispatcher Lambda (Consolidated)

> **Notice:** The canonical serverless webhook dispatcher implementation for SupportPilot has been consolidated into the **Python 3.12 AWS SAM** application located at `infra/sam/handlers/webhook.py` and `infra/sam/template.yaml`.
>
> The Python implementation includes:
>
> - SSRF protection (rejecting private IP space and link-local addresses)
> - Cryptographic HMAC-SHA256 signature verification (`x-supportpilot-signature`)
> - SQS dead-letter queue (DLQ) batch failure reporting (`ReportBatchItemFailures`)
> - Comprehensive automated unit test suite in `infra/sam/tests/test_webhook.py` (23 tests passing)
>
> This TypeScript implementation is retained as legacy reference.
