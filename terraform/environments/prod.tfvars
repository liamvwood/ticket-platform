environment = "prod"
aws_region  = "us-east-1"

# ECS Fargate capacity
api_task_cpu      = 512
api_task_memory   = 1024
api_desired_count = 2
api_max_count     = 20

frontend_task_cpu      = 256
frontend_task_memory   = 512
frontend_desired_count = 2
frontend_max_count     = 10

db_instance_class    = "db.t3.small"
db_allocated_storage = 100

# Multi-AZ NAT gateways for production HA
single_nat_gateway = false
enable_nat_gateway = true

api_domain      = "api.slingshot.dev"
frontend_domain = "app.slingshot.dev"

# Set route53_zone_id for automatic ACM DNS validation, or provide an
# existing certificate_arn. See terraform/acm.tf for details.
route53_zone_id = ""
certificate_arn = ""

ecr_image_retention_count = 50

thumbnail_bucket_cors_origin = "https://app.slingshot.dev"
