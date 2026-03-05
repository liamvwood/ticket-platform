# ── Application secrets stored in AWS SSM Parameter Store ─────────────────────
#
# Most secrets are auto-generated here. Stripe keys must be updated manually
# after first apply (lifecycle ignore_changes prevents Terraform overwriting them).

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/ticket-platform/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = random_password.jwt_secret.result
}

# Owner credentials — seeded on initial apply; update via SSM Console for prod
resource "aws_ssm_parameter" "owner_email" {
  name  = "/ticket-platform/${var.environment}/owner-email"
  type  = "SecureString"
  value = "owner@slingshot.dev"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "owner_password" {
  name  = "/ticket-platform/${var.environment}/owner-password"
  type  = "SecureString"
  value = "ChangeMe-Before-Use!"

  lifecycle {
    ignore_changes = [value]
  }
}

# DB connection string assembled from the RDS instance outputs
resource "aws_ssm_parameter" "db_connection_string" {
  name = "/ticket-platform/${var.environment}/db-connection-string"
  type = "SecureString"
  value = join("", [
    "Host=${aws_db_instance.postgres.address};",
    "Port=${aws_db_instance.postgres.port};",
    "Database=${aws_db_instance.postgres.db_name};",
    "Username=${aws_db_instance.postgres.username};",
    "Password=${random_password.db.result}",
  ])
}

# IRSA role ARN — read by CI to annotate the API ServiceAccount
resource "aws_ssm_parameter" "api_irsa_role_arn" {
  name  = "/ticket-platform/${var.environment}/api-irsa-role-arn"
  type  = "String"
  value = aws_iam_role.api_irsa.arn
}

# Stripe — placeholders; update with real keys before going live
resource "aws_ssm_parameter" "stripe_secret_key" {
  name  = "/ticket-platform/${var.environment}/stripe-secret-key"
  type  = "SecureString"
  value = "sk_test_placeholder_update_before_use"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "stripe_webhook_secret" {
  name  = "/ticket-platform/${var.environment}/stripe-webhook-secret"
  type  = "SecureString"
  value = "whsec_placeholder_update_before_use"

  lifecycle {
    ignore_changes = [value]
  }
}
