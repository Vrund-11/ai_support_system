variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (e.g. dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "localstack_endpoint" {
  description = "Endpoint override URL for LocalStack or emulator"
  type        = string
  default     = "http://localhost:4566"
}

variable "use_localstack" {
  description = "Whether to route AWS provider calls to LocalStack"
  type        = bool
  default     = true
}

variable "webhook_signing_secret" {
  description = "HMAC-SHA256 signing secret for outbound webhook delivery"
  type        = string
  default     = "whsec_default_signing_key_32_chars!"
  sensitive   = true
}
