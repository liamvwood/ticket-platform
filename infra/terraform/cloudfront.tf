import {
  to = aws_cloudfront_distribution.images
  id = "E1QGF1Q99ZSDJW"
}

resource "aws_cloudfront_distribution" "images" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "ticket-platform-${var.environment} image CDN"
  price_class     = "PriceClass_All"

  origin {
    domain_name              = aws_s3_bucket.images_original.bucket_regional_domain_name
    origin_id                = "S3ImageOrigin"
    origin_access_control_id = aws_cloudfront_origin_access_control.images.id
  }

  # /img/* requests go through Lambda@Edge transformer
  ordered_cache_behavior {
    path_pattern           = "/img/*"
    target_origin_id       = "S3ImageOrigin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    # Cache transformed images for 1 year (they are immutable by URL)
    min_ttl     = 0
    default_ttl = 31536000
    max_ttl     = 31536000

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.image_transformer.qualified_arn
      include_body = false
    }
  }

  # Default behaviour: pass through to S3 (for originals/* if ever needed)
  default_cache_behavior {
    target_origin_id       = "S3ImageOrigin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
