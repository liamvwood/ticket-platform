output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer — create CNAME/ALIAS records pointing api_domain and frontend_domain here"
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Route 53 canonical hosted zone ID of the ALB (use for ALIAS records)"
  value       = aws_lb.this.zone_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.this.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.this.arn
}

output "acm_validation_records" {
  description = "DNS CNAME records required to validate the ACM certificate. Only populated when route53_zone_id is empty and certificate_arn is not set."
  value = var.certificate_arn == "" && var.route53_zone_id == "" ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options :
    dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  } : {}
}

output "ecr_api_repository_url" {
  description = "ECR repository URL for the API image"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR repository URL for the frontend image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_registry" {
  description = "ECR registry hostname (used as ECR_REGISTRY GitHub secret)"
  value       = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL hostname"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.postgres.port
}

output "thumbnail_bucket_name" {
  description = "S3 bucket name for event thumbnails"
  value       = aws_s3_bucket.thumbnails.bucket
}

output "thumbnail_bucket_url" {
  description = "Base URL for publicly readable thumbnail objects"
  value       = "https://${aws_s3_bucket.thumbnails.bucket_regional_domain_name}"
}

output "ci_access_key_id" {
  description = "IAM access key ID for GitHub Actions CI/CD — set as AWS_ACCESS_KEY_ID secret"
  value       = aws_iam_access_key.ci.id
  sensitive   = true
}

output "ci_secret_access_key" {
  description = "IAM secret access key for GitHub Actions CI/CD — set as AWS_SECRET_ACCESS_KEY secret"
  value       = aws_iam_access_key.ci.secret
  sensitive   = true
}

output "aws_region" {
  description = "AWS region the environment is deployed in"
  value       = var.aws_region
}

output "api_domain" {
  description = "API hostname (value for TEST_API_HOST secret)"
  value       = var.api_domain
}

output "frontend_domain" {
  description = "Frontend hostname (value for TEST_FRONTEND_HOST secret)"
  value       = var.frontend_domain
}

output "github_secrets_summary" {
  description = "GitHub Actions secrets to configure after apply (retrieve sensitive values from SSM)"
  value = {
    AWS_REGION            = var.aws_region
    AWS_ACCESS_KEY_ID     = "(see ci_access_key_id output)"
    AWS_SECRET_ACCESS_KEY = "(see ci_secret_access_key output)"
    ECR_REGISTRY          = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    ECS_CLUSTER           = aws_ecs_cluster.this.name
    TEST_API_HOST         = var.api_domain
    TEST_FRONTEND_HOST    = var.frontend_domain
  }
}
