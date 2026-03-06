# Execution role for the Lambda@Edge image transformer
resource "aws_iam_role" "lambda_edge_image" {
  provider = aws.us_east_1
  name     = "ticket-platform-${var.environment}-lambda-edge-image"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_edge_basic" {
  provider   = aws.us_east_1
  role       = aws_iam_role.lambda_edge_image.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Allow Lambda@Edge to read original images from S3
resource "aws_iam_role_policy" "lambda_edge_s3_read" {
  provider = aws.us_east_1
  name     = "s3-read-image-originals"
  role     = aws_iam_role.lambda_edge_image.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.images_original.arn}/originals/*"
      },
      {
        # s3:ListBucket causes S3 to return 404 (not 403 AccessDenied) for
        # missing keys, so the Lambda handler can correctly return 404 to clients
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.images_original.arn
      }
    ]
  })
}

# Allow the API service role (EKS node role or IRSA) to PUT originals for presigned uploads.
# When api_iam_role_name is set, attach an inline policy granting s3:PutObject.
data "aws_iam_role" "api_service" {
  count = var.api_iam_role_name != "" ? 1 : 0
  name  = var.api_iam_role_name
}

resource "aws_iam_role_policy" "api_image_bucket_write" {
  count = var.api_iam_role_name != "" ? 1 : 0
  name  = "ticket-platform-${var.environment}-image-bucket-write"
  role  = data.aws_iam_role.api_service[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowPresignedPut"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.images_original.arn,
          "${aws_s3_bucket.images_original.arn}/originals/*"
        ]
      }
    ]
  })
}
