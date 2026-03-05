# Image Pipeline Architecture

Instagram-style image processing pipeline with Open Graph rich link preview support.

## Overview

Original images are uploaded directly to S3 by clients using presigned URLs. CloudFront + Lambda@Edge serve dynamically-resized variants on demand and cache them globally. Social-preview bots receive server-rendered HTML with Open Graph metadata pointing to the CDN image URL.

No dedicated image microservice is required.

---

## Upload Flow

```
VenueAdmin
  → POST /events/{id}/image-upload-url      (API returns presigned S3 PUT URL, expires 15 min)
  → PUT <presignedUrl>  Content-Type: image/jpeg   (client uploads directly to S3)
  → S3 stores object at  originals/{imageId}.jpg
```

The API response includes:

| Field | Description |
|---|---|
| `uploadUrl` | Pre-signed S3 PUT URL (15 min expiry) |
| `imageId` | UUID identifying this image |
| `cdnImageUrl` | `https://{cdn}/img/1200x630/cover/{imageId}.jpg` |

---

## Image Delivery

```
User / Bot
  → GET https://{cdn}/img/1200x630/cover/{imageId}.jpg
  → CloudFront checks cache
      ├─ HIT  → return cached JPEG (99% of requests)
      └─ MISS → Lambda@Edge origin-request
                  → fetch originals/{imageId}.jpg from S3
                  → resize with sharp (cover, 1200×630)
                  → return JPEG + Cache-Control: public, max-age=31536000, immutable
                  → CloudFront caches variant globally
```

Subsequent requests for the same URL are pure CDN cache hits — Lambda is never invoked again.

---

## URL Schema

```
/img/{width}x{height}/{fit}/{imageId}.jpg
```

| Segment | Values |
|---|---|
| `width` | Pixel width (0 = auto) |
| `height` | Pixel height (0 = auto) |
| `fit` | `cover` or `contain` |
| `imageId` | UUID of the original image |

### Example URLs

```
/img/1200x630/cover/550e8400-e29b-41d4-a716-446655440000.jpg   ← OG / social preview
/img/800x0/contain/550e8400-e29b-41d4-a716-446655440000.jpg    ← wide banner
/img/300x300/cover/550e8400-e29b-41d4-a716-446655440000.jpg    ← thumbnail grid
/img/200x200/cover/550e8400-e29b-41d4-a716-446655440000.jpg    ← avatar
```

---

## CDN Caching Strategy

Each unique URL is a distinct CloudFront cache key. Transformed images are cached for **1 year** (`max-age=31536000, immutable`).

Because images are stored by UUID, URLs never change for the same content. CDN invalidation is only needed if an image is replaced.

---

## Open Graph Rich Previews

Social crawlers (Slackbot, Twitterbot, Discordbot, facebookexternalhit, LinkedInBot, Applebot) do **not** execute JavaScript. They fetch the page HTML and parse `<meta>` tags.

The API serves a minimal HTML page at `GET /og/events/{slug}` containing all required OG tags.

### Example HTML

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Friday Night Comedy — Slingshot</title>
  <meta property="og:type"          content="article"/>
  <meta property="og:site_name"     content="Slingshot"/>
  <meta property="og:title"         content="Friday Night Comedy — Slingshot"/>
  <meta property="og:description"   content="Fri, Mar 7 at 8:00 PM @ Cap City Comedy. Austin's best lineup..."/>
  <meta property="og:url"           content="https://slingshot.dev/events/friday-night-comedy"/>
  <meta property="og:image"         content="https://d1234abcd.cloudfront.net/img/1200x630/cover/550e8400-e29b-41d4-a716-446655440000.jpg"/>
  <meta property="og:image:width"   content="1200"/>
  <meta property="og:image:height"  content="630"/>
  <meta name="twitter:card"         content="summary_large_image"/>
  <meta name="twitter:image"        content="https://d1234abcd.cloudfront.net/img/1200x630/cover/550e8400-e29b-41d4-a716-446655440000.jpg"/>
  <link rel="canonical" href="https://slingshot.dev/events/friday-night-comedy"/>
</head>
<body></body>
</html>
```

### OG Image Fallback Chain

1. **CDN URL** — `https://{cdn}/img/1200x630/cover/{eventId}.jpg` — used when `Aws:CdnDomain` is configured and the event has an S3 thumbnail.
2. **Raw S3 URL** — used when the event has a fetchable thumbnail but CDN is not configured.
3. **Generated gradient PNG** — server-rendered deterministic gradient at `/og/events/{id}/image` — used when the event has no uploaded thumbnail.

---

## Terraform Infrastructure

Located at `/infra/terraform/`.

| File | Purpose |
|---|---|
| `main.tf` | Provider config; separate `aws.us_east_1` alias for Lambda@Edge |
| `s3.tf` | `images_original` bucket + OAC (Origin Access Control) + bucket policy |
| `cloudfront.tf` | CloudFront distribution; `/img/*` path routes through Lambda@Edge |
| `lambda_edge.tf` | Lambda@Edge function (Node 20, 512 MB, 10 s timeout), packaged from `/image-transformer/` |
| `iam.tf` | Execution role for Lambda@Edge with `s3:GetObject` on `originals/*` |
| `variables.tf` | `aws_region`, `environment`, `image_bucket_cors_origins` |
| `outputs.tf` | `cdn_domain`, `image_upload_bucket`, `cloudfront_distribution_id` |

### Terraform Outputs

```hcl
cdn_domain                  = "d1234abcd.cloudfront.net"
image_upload_bucket         = "ticket-platform-prod-images-123456789012"
cloudfront_distribution_id  = "E1ABCDEFGHIJKL"
```

Set `Aws:CdnDomain` in the API config to the `cdn_domain` output value to enable CDN image URLs in OG tags.

---

## Bot Compatibility

| Crawler | Requirement met |
|---|---|
| Slackbot | ✅ OG tags in initial HTML, image publicly accessible, < 5 MB |
| Twitterbot | ✅ `twitter:card=summary_large_image`, 1200×630 image |
| Discordbot | ✅ OG image accessible without auth |
| facebookexternalhit | ✅ `og:image:width/height` explicit dimensions |
| LinkedInBot | ✅ `og:type=article`, `og:url` canonical |
| Applebot (iMessage) | ✅ `og:image` JPEG, no cookies required |

---

## Local Development

- Set `Aws:ImageBucket` = your image bucket name in `appsettings.Development.json`.
- Set `Aws:CdnDomain` = your CloudFront domain.
- Leave both unset to get dev fallback responses (no S3 or CDN required).
