# ── SQS Webhooks Queue & Dead Letter Queue (DLQ) ──

resource "aws_sqs_queue" "webhooks_dlq" {
  name                      = "supportpilot-webhooks-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "webhooks" {
  name                       = "supportpilot-webhooks-${var.environment}"
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhooks_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue_policy" "webhooks_policy" {
  queue_url = aws_sqs_queue.webhooks.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowNotificationServiceAndLambda"
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.webhooks.arn
      }
    ]
  })
}
