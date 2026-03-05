# Bucket holding original uploaded images
import {
  to = aws_s3_bucket.images_original
  id = "ticket-platform-${var.environment}-images-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "images_original" {
  bucket = "ticket-platform-${var.environment}-images-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "images_original" {
  bucket = aws_s3_bucket.images_original.id
  versioning_configuration { status = "Disabled" }
}

# Block all public access — CloudFront uses OAC to reach S3
resource "aws_s3_bucket_public_access_block" "images_original" {
  bucket                  = aws_s3_bucket.images_original.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "images_original" {
  bucket = aws_s3_bucket.images_original.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = var.image_bucket_cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "images_original" {
  bucket = aws_s3_bucket.images_original.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

# OAC — Origin Access Control for CloudFront → S3 (modern replacement for OAI)
import {
  to = aws_cloudfront_origin_access_control.images
  id = "ECDWSRU6009QJ"
}

resource "aws_cloudfront_origin_access_control" "images" {
  name                              = "ticket-platform-${var.environment}-images-oac"
  description                       = "OAC for image originals bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Bucket policy: allow CloudFront (via OAC) to read originals/*
resource "aws_s3_bucket_policy" "images_original_cloudfront" {
  bucket     = aws_s3_bucket.images_original.id
  depends_on = [aws_s3_bucket_public_access_block.images_original]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.images_original.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.images.arn
          }
        }
      }
    ]
  })
}
