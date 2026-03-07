variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name — used in all resource names and SSM paths (e.g. test, prod)"
  type        = string
}

# ── ECS Fargate capacity ───────────────────────────────────────────────────────

variable "api_task_cpu" {
  description = "CPU units for the API Fargate task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "api_task_memory" {
  description = "Memory in MiB for the API Fargate task"
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Desired number of running API tasks"
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = "Maximum number of API tasks for auto-scaling"
  type        = number
  default     = 10
}

variable "frontend_task_cpu" {
  description = "CPU units for the frontend Fargate task"
  type        = number
  default     = 256
}

variable "frontend_task_memory" {
  description = "Memory in MiB for the frontend Fargate task"
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Desired number of running frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_max_count" {
  description = "Maximum number of frontend tasks for auto-scaling"
  type        = number
  default     = 5
}

# ── RDS ────────────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

# ── Networking ─────────────────────────────────────────────────────────────────

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (cost-saving for non-prod). Set false for production HA."
  type        = bool
  default     = true
}

variable "enable_nat_gateway" {
  description = "Provision NAT gateway(s) for private subnet internet egress"
  type        = bool
  default     = true
}

# ── Domains & TLS ──────────────────────────────────────────────────────────────

variable "api_domain" {
  description = "Public hostname for the API (e.g. api.slingshot.dev)"
  type        = string
}

variable "frontend_domain" {
  description = "Public hostname for the frontend (e.g. app.slingshot.dev)"
  type        = string
}

variable "certificate_arn" {
  description = <<-EOT
    ARN of an existing ACM certificate covering api_domain and frontend_domain.
    If set, no certificate resources are created by Terraform.
    If empty, a new certificate is created — set route53_zone_id for automatic
    DNS validation, or add the CNAME records shown in acm_validation_records manually.
  EOT
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for automatic ACM DNS validation and ALB alias records. Leave empty to skip Route 53 management."
  type        = string
  default     = ""
}

# ── ECR ────────────────────────────────────────────────────────────────────────

variable "ecr_image_retention_count" {
  description = "Number of container images to retain per ECR repository"
  type        = number
  default     = 20
}

# ── S3 ─────────────────────────────────────────────────────────────────────────

variable "thumbnail_bucket_cors_origin" {
  description = "Allowed CORS origin for the S3 thumbnail bucket (use frontend domain in prod)"
  type        = string
  default     = "*"
}
