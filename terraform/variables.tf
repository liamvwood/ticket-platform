variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name — used in all resource names and SSM paths (e.g. test, prod)"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.small"]
}

variable "node_min_size" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 3
}

variable "node_desired_size" {
  description = "Desired number of EKS worker nodes at launch"
  type        = number
  default     = 2
}

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

variable "api_domain" {
  description = "Public hostname for the API (e.g. api.slingshot.dev)"
  type        = string
}

variable "frontend_domain" {
  description = "Public hostname for the frontend (e.g. app.slingshot.dev)"
  type        = string
}

variable "grafana_domain" {
  description = "Public hostname for Grafana. Leave empty to skip ingress."
  type        = string
  default     = ""
}

variable "enable_monitoring" {
  description = "Deploy kube-prometheus-stack (Prometheus + Grafana)"
  type        = bool
  default     = true
}

variable "ecr_image_retention_count" {
  description = "Number of container images to retain per ECR repository"
  type        = number
  default     = 20
}

variable "thumbnail_bucket_cors_origin" {
  description = "Allowed CORS origin for the S3 thumbnail bucket (use frontend domain in prod)"
  type        = string
  default     = "*"
}

variable "letsencrypt_email" {
  description = "Email address for Let's Encrypt certificate notifications"
  type        = string
  default     = "ops@slingshot.dev"
}
