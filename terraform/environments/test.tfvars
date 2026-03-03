environment         = "test"
aws_region          = "us-east-1"
cluster_version     = "1.31"

node_instance_types = ["t3.small"]
node_min_size       = 1
node_max_size       = 3
node_desired_size   = 2

db_instance_class    = "db.t3.micro"
db_allocated_storage = 20

# Single NAT gateway — cheaper for non-production
single_nat_gateway = true
enable_nat_gateway = true

api_domain      = "api.100.29.51.191.sslip.io"
frontend_domain = "app.100.29.51.191.sslip.io"
grafana_domain  = "grafana.100.29.51.191.sslip.io"

enable_monitoring         = true
ecr_image_retention_count = 20

thumbnail_bucket_cors_origin = "*"
letsencrypt_email            = "ops@slingshot.dev"
