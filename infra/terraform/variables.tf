variable "aws_region" {
  description = "Primary AWS region for most resources (CloudFront is global)"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (test, staging, prod)"
  type        = string
}

variable "image_bucket_cors_origins" {
  description = "Allowed origins for presigned upload CORS"
  type        = list(string)
  default     = ["*"]
}
