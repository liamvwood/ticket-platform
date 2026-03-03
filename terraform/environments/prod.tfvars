environment         = "prod"
aws_region          = "us-east-1"
cluster_version     = "1.31"

node_instance_types = ["t3.medium"]
node_min_size       = 2
node_max_size       = 20
node_desired_size   = 3

db_instance_class    = "db.t3.small"
db_allocated_storage = 100

# Multi-AZ NAT gateways for production HA
single_nat_gateway = false
enable_nat_gateway = true

api_domain      = "api.slingshot.dev"
frontend_domain = "app.slingshot.dev"
grafana_domain  = "grafana.slingshot.dev"

enable_monitoring         = true
ecr_image_retention_count = 50

thumbnail_bucket_cors_origin = "https://app.slingshot.dev"
letsencrypt_email            = "ops@slingshot.dev"
