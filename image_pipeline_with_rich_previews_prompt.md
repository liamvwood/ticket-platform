# Copilot Implementation Prompt
## Instagram-Style Image Pipeline + Rich Link Previews (AWS + Terraform)

You are implementing an **Instagram-style image processing pipeline** using AWS infrastructure and Terraform.

The system should:
- Store original uploads
- Generate image variants on demand
- Cache variants at the CDN layer
- Support Open Graph rich link previews (iMessage, Slack, Discord, Twitter, etc.)
- Require **no dedicated image microservice API**

The architecture must be simple, scalable, and production-ready.

---

# System Overview

Goal: replicate the architecture pattern used by major media platforms where:

- Images are uploaded directly to object storage
- The CDN handles caching
- Edge compute generates image variants on-demand
- Pages expose Open Graph metadata so preview bots can render link previews

Infrastructure should include:

- S3 bucket for original images
- CloudFront CDN
- Lambda@Edge image transformer
- Terraform infrastructure definitions
- Static preview image URLs used in Open Graph tags

---

# Architecture

Upload Flow:

Client
  -> Signed upload URL
  -> S3 bucket (original images)

Image Delivery:

User or Bot
  -> CloudFront CDN
  -> Lambda@Edge (only if variant not cached)
  -> Fetch original from S3
  -> Resize image
  -> Return image
  -> CloudFront caches variant globally

Subsequent requests should be CDN cache hits.

---

# URL-Based Image Transformation

Only store the original image in S3.

Variants are generated dynamically based on the request path.

Example URL schema:

/img/{width}x{height}/{fit}/{imageId}.jpg

Examples:

/img/200x200/cover/post123.jpg
/img/800x0/contain/post123.jpg
/img/1200x630/cover/post123.jpg

Meaning:

width
height
fit mode
image id

Lambda@Edge should parse this path and perform the transformation.

---

# Image Processing Requirements

Use a high-performance image library.

Preferred:

libvips
or
sharp

Supported transformations:

resize
crop
fit modes (cover, contain)
jpeg/webp output
quality control

Example logic:

1. Parse request path
2. Extract width, height, fit mode, image id
3. Fetch original from S3
4. Resize using libvips/sharp
5. Return image with cache headers

---

# CDN Caching Strategy

Each unique URL must act as a cache key.

Example:

/img/1200x630/cover/post123.jpg
/img/300x300/cover/post123.jpg

These should be cached as separate objects in CloudFront.

Return headers:

Cache-Control: public, max-age=31536000, immutable

This ensures global CDN caching.

---

# Rich Link Preview Support

The platform must support previews for:

iMessage
Slack
Discord
Twitter
Facebook
LinkedIn

These services **do not execute JavaScript**.

They fetch the page and parse the HTML for Open Graph metadata.

Therefore the page must return metadata in the **initial HTML response**.

---

# Required Open Graph Tags

Each content page must include the following metadata in the server-rendered HTML:

<meta property="og:title" content="Post Title">

<meta property="og:description" content="Short description">

<meta property="og:type" content="article">

<meta property="og:url" content="https://example.com/post/{id}">

<meta property="og:image" content="https://cdn.example.com/img/1200x630/cover/{imageId}.jpg">

<meta property="og:image:width" content="1200">

<meta property="og:image:height" content="630">

<meta name="twitter:card" content="summary_large_image">

The og:image URL should reference the **dynamic image transformation endpoint**.

---

# Preview Image Standard

Rich preview systems expect approximately:

1200 x 630

Ensure that:

/img/1200x630/cover/{imageId}.jpg

is always supported.

Lambda@Edge should generate this if requested.

---

# Bot Compatibility Requirements

Preview crawlers include:

Slackbot
Twitterbot
Discordbot
facebookexternalhit
LinkedInBot
Applebot

They will:

1. Fetch the page
2. Extract Open Graph metadata
3. Request the og:image URL

The og:image must:

- Be publicly accessible
- Require no authentication
- Be under 5MB
- Return quickly

---

# Terraform Requirements

Create Terraform modules that provision:

S3 bucket for original uploads

CloudFront distribution
- origin pointing to S3
- edge function association

Lambda@Edge function
- Node runtime
- image transformation logic

IAM roles for Lambda access to S3

Bucket policies allowing CloudFront access

Outputs:

cdn_domain
image_upload_bucket
cloudfront_distribution_id

---

# Upload Flow

Uploads should bypass the backend.

Steps:

1. Backend generates signed S3 upload URL
2. Client uploads original image directly to S3
3. S3 stores image under:

/originals/{imageId}.jpg

No transformations occur during upload.

---

# Edge Image Transformation Logic

Pseudocode:

parse request path

extract width height fit imageId

fetch original from S3:
/originals/{imageId}.jpg

resize image using sharp/libvips

set response headers:
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable

return image

---

# Expected Repository Structure

/infra
  terraform/
    cloudfront.tf
    s3.tf
    lambda_edge.tf
    iam.tf

/image-transformer
  handler.js
  resize.js

/docs
  architecture.md

---

# Deliverables

The system should produce:

1. Terraform infrastructure
2. Lambda@Edge image transformer
3. Upload instructions using signed URLs
4. Example HTML showing Open Graph metadata
5. Example requests for dynamic image variants

---

# Success Criteria

System must support:

direct S3 uploads
dynamic image resizing
global CDN caching
Open Graph rich previews
no dedicated image microservice

The infrastructure should scale automatically and minimize compute usage by relying on CDN caching.
