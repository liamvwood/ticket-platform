# Event thumbnails bucket — publicly readable so images can be embedded in the frontend
resource "aws_s3_bucket" "thumbnails" {
  # Include account ID to guarantee global uniqueness
  bucket = "${local.name}-thumbnails-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  # Allow public reads via bucket policy (for serving thumbnail images)
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [var.thumbnail_bucket_cors_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_policy" "thumbnails_public_read" {
  bucket     = aws_s3_bucket.thumbnails.id
  depends_on = [aws_s3_bucket_public_access_block.thumbnails]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.thumbnails.arn}/*"
    }]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Versioning off — thumbnails are replaced not versioned
resource "aws_s3_bucket_versioning" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  versioning_configuration {
    status = "Disabled"
  }
}

# SSM parameter so the API pod knows its bucket name at runtime
resource "aws_ssm_parameter" "thumbnail_bucket" {
  name  = "/ticket-platform/${var.environment}/thumbnail-bucket-name"
  type  = "String"
  value = aws_s3_bucket.thumbnails.bucket
}
