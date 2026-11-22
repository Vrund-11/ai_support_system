# ── SSM Parameter Store ──

resource "aws_ssm_parameter" "webhook_signing_secret" {
  name        = "/supportpilot/${var.environment}/WEBHOOK_SIGNING_SECRET"
  description = "Webhook HMAC-SHA256 signing secret"
  type        = "SecureString"
  value       = var.webhook_signing_secret
}

resource "aws_ssm_parameter" "sqs_queue_url" {
  name        = "/supportpilot/${var.environment}/webhooks_queue_url"
  description = "Outbound webhooks SQS queue URL"
  type        = "String"
  value       = aws_sqs_queue.webhooks.url
}

resource "aws_ssm_parameter" "s3_bucket" {
  name        = "/supportpilot/${var.environment}/s3_bucket"
  description = "S3 attachments bucket name"
  type        = "String"
  value       = aws_s3_bucket.attachments.id
}
