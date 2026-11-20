output "attachments_bucket_name" {
  description = "S3 bucket name for ticket attachments"
  value       = aws_s3_bucket.attachments.id
}

output "attachments_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.attachments.arn
}

output "webhooks_queue_url" {
  description = "SQS webhooks delivery queue URL"
  value       = aws_sqs_queue.webhooks.url
}

output "webhooks_queue_arn" {
  description = "SQS webhooks delivery queue ARN"
  value       = aws_sqs_queue.webhooks.arn
}

output "webhooks_dlq_url" {
  description = "SQS webhooks dead letter queue URL"
  value       = aws_sqs_queue.webhooks_dlq.url
}

output "webhook_dispatcher_lambda_arn" {
  description = "Webhook dispatcher Lambda function ARN"
  value       = aws_lambda_function.webhook_dispatcher.arn
}
