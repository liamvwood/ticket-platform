output "cluster_name" {
  description = "EKS cluster name — use with aws eks update-kubeconfig"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded CA certificate for the EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "kubeconfig_command" {
  description = "Run this to configure kubectl for this cluster"
  value       = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}"
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

output "api_irsa_role_arn" {
  description = "IAM role ARN annotated on the API ServiceAccount (IRSA)"
  value       = aws_iam_role.api_irsa.arn
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

output "app_namespace" {
  description = "Kubernetes namespace where the application is deployed"
  value       = local.app_namespace
}

output "github_secrets_summary" {
  description = "GitHub Actions secrets to configure after apply (retrieve sensitive values from SSM)"
  value = {
    AWS_REGION          = var.aws_region
    AWS_ACCESS_KEY_ID   = "(see ci_access_key_id output)"
    AWS_SECRET_ACCESS_KEY = "(see ci_secret_access_key output)"
    ECR_REGISTRY        = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    EKS_CLUSTER_NAME    = module.eks.cluster_name
    TEST_API_HOST       = var.api_domain
    TEST_FRONTEND_HOST  = var.frontend_domain
  }
}
