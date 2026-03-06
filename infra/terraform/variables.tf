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

variable "api_iam_role_name" {
  description = "IAM role name used by the API service (EKS node role or IRSA role) that needs s3:PutObject on the image bucket for presigned URL uploads"
  type        = string
  default     = ""
}
