environment = "test"
aws_region  = "us-east-1"

# ECS Fargate capacity
api_task_cpu      = 256
api_task_memory   = 512
api_desired_count = 1
api_max_count     = 5

frontend_task_cpu      = 256
frontend_task_memory   = 512
frontend_desired_count = 1
frontend_max_count     = 3

db_instance_class    = "db.t3.micro"
db_allocated_storage = 20

# Single NAT gateway — cheaper for non-production
single_nat_gateway = true
enable_nat_gateway = true

api_domain      = "api.slingshot.dev"
frontend_domain = "app.slingshot.dev"

# Set route53_zone_id for automatic ACM DNS validation, or provide an
# existing certificate_arn. See terraform/acm.tf for details.
route53_zone_id = ""
certificate_arn = ""

ecr_image_retention_count = 20

thumbnail_bucket_cors_origin = "*"
