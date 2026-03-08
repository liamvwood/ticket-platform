# ── CI/CD IAM user — used by GitHub Actions to push to ECR and deploy to ECS ──

resource "aws_iam_user" "ci" {
  name = "${local.name}-ci"
  path = "/service/"
}

resource "aws_iam_access_key" "ci" {
  user = aws_iam_user.ci.name
}

resource "aws_iam_user_policy" "ci" {
  name = "${local.name}-ci-policy"
  user = aws_iam_user.ci.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ]
        Resource = [
          aws_ecr_repository.api.arn,
          aws_ecr_repository.frontend.arn,
        ]
      },
      {
        Sid    = "ECSRegisterTaskDef"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSUpdateService"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:ListClusters",
        ]
        Resource = [
          aws_ecs_cluster.this.arn,
          "arn:aws:ecs:${var.aws_region}:${local.account_id}:service/${local.name}/*",
        ]
      },
      {
        Sid    = "ECSPassRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.api_task.arn,
        ]
      },
      {
        Sid    = "SSMReadSecrets"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/ticket-platform/${var.environment}/*"
      },
    ]
  })
}

# Store CI credentials in SSM so the bootstrap README can reference them
resource "aws_ssm_parameter" "ci_access_key_id" {
  name  = "/ticket-platform/${var.environment}/ci-access-key-id"
  type  = "SecureString"
  value = aws_iam_access_key.ci.id
}

resource "aws_ssm_parameter" "ci_secret_access_key" {
  name  = "/ticket-platform/${var.environment}/ci-secret-access-key"
  type  = "SecureString"
  value = aws_iam_access_key.ci.secret
}

# ── ECS Task Execution Role ────────────────────────────────────────────────────
# Grants the ECS agent permission to pull images from ECR, write logs to
# CloudWatch, and fetch secrets from SSM Parameter Store at task start.

data "aws_iam_policy_document" "ecs_task_execution_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_ssm" {
  name = "${local.name}-task-execution-ssm"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SSMGetSecrets"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/ticket-platform/${var.environment}/*"
      },
    ]
  })
}

# ── API Task Role ──────────────────────────────────────────────────────────────
# Grants running API containers access to S3 (thumbnails) and SSM at runtime.

resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json
}

resource "aws_iam_role_policy" "api_task" {
  name = "${local.name}-api-task-policy"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Thumbnails"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.thumbnails.arn}/*"
      },
      {
        Sid    = "SSMSecrets"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/ticket-platform/${var.environment}/*"
      },
    ]
  })
}
