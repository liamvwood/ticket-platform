resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "postgres" {
  name       = local.name
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "Allow PostgreSQL from EKS worker nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "${local.name}-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_encrypted = true

  db_name  = "ticketplatform"
  username = "ticketplatform"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Daily automated backups retained for 7 days
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Protect production data; test can be torn down freely
  skip_final_snapshot = var.environment != "prod"
  deletion_protection = var.environment == "prod"

  # Enhanced monitoring in production
  performance_insights_enabled = var.environment == "prod"

  # Minor version upgrades applied automatically during maintenance window
  auto_minor_version_upgrade = true
}
