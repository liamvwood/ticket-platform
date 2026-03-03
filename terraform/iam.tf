# ── CI/CD IAM user — used by GitHub Actions to push to ECR and deploy to EKS ──

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
        Sid    = "EKSDescribe"
        Effect = "Allow"
        Action = ["eks:DescribeCluster", "eks:ListClusters"]
        Resource = "*"
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

# ── IRSA role — grants the API pod access to S3 (thumbnails) and SSM (secrets) ─

data "aws_iam_policy_document" "api_irsa_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:${local.app_namespace}:ticket-platform-api"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_irsa" {
  name               = "${local.name}-api-irsa"
  assume_role_policy = data.aws_iam_policy_document.api_irsa_assume.json
}

resource "aws_iam_role_policy" "api_irsa" {
  name = "${local.name}-api-irsa-policy"
  role = aws_iam_role.api_irsa.id

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
