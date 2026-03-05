output "cdn_domain" {
  description = "CloudFront domain name — use as the base for all image URLs"
  value       = aws_cloudfront_distribution.images.domain_name
}

output "image_upload_bucket" {
  description = "S3 bucket name for original image uploads"
  value       = aws_s3_bucket.images_original.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — use to create invalidations"
  value       = aws_cloudfront_distribution.images.id
}

output "image_transformer_lambda_arn" {
  description = "Lambda@Edge function ARN (qualified) used by CloudFront"
  value       = aws_lambda_function.image_transformer.qualified_arn
}
