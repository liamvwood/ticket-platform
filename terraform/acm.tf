# ── ACM Certificate ────────────────────────────────────────────────────────────
#
# Two provisioning paths:
#
#   1. Provide an existing ACM certificate ARN via var.certificate_arn
#      (e.g. a wildcard cert already issued in the same region).
#      No certificate resources are created here.
#
#   2. Set var.route53_zone_id to your Route 53 hosted zone ID.
#      Terraform creates the certificate and adds the DNS validation CNAME
#      records automatically, then waits for ACM to issue the certificate.
#
# If neither variable is set, a certificate is created and the required
# DNS validation CNAME records are emitted as the `acm_validation_records`
# output. Add those CNAMEs to your DNS provider, then re-run `terraform apply`
# once the certificate status reaches ISSUED.

resource "aws_acm_certificate" "this" {
  count = var.certificate_arn == "" ? 1 : 0

  domain_name               = var.api_domain
  subject_alternative_names = [var.frontend_domain]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ── Route 53 auto-validation (only when route53_zone_id is set) ────────────────

resource "aws_route53_record" "cert_validation" {
  for_each = var.certificate_arn == "" && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "this" {
  count = var.certificate_arn == "" && var.route53_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ── Resolved certificate ARN used by the ALB HTTPS listener ───────────────────

locals {
  certificate_arn = (
    var.certificate_arn != "" ? var.certificate_arn :
    var.route53_zone_id != "" ? aws_acm_certificate_validation.this[0].certificate_arn :
    aws_acm_certificate.this[0].arn
  )
}
