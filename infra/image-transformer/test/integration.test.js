'use strict';

/**
 * Integration tests for the image transformer pipeline.
 *
 * Requires the following environment variables (set by CI workflow):
 *   IMAGE_BUCKET  - S3 bucket holding original images
 *   BUCKET_REGION - AWS region of the bucket
 *   CDN_DOMAIN    - CloudFront distribution domain
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const { IMAGE_BUCKET, BUCKET_REGION, CDN_DOMAIN } = process.env;

const s3 = new S3Client({ region: BUCKET_REGION });
const TEST_KEY_ID = `integration-test-${Date.now()}`;

// Create a simple 400×300 blue JPEG in memory to use as the test original
async function makeTestImage() {
  return sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 70, g: 130, b: 200 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

beforeAll(async () => {
  const imageBuffer = await makeTestImage();
  await s3.send(new PutObjectCommand({
    Bucket: IMAGE_BUCKET,
    Key: `originals/${TEST_KEY_ID}.jpg`,
    Body: imageBuffer,
    ContentType: 'image/jpeg',
  }));
});

afterAll(async () => {
  await s3.send(new DeleteObjectCommand({
    Bucket: IMAGE_BUCKET,
    Key: `originals/${TEST_KEY_ID}.jpg`,
  }));
});

describe('Image transformer – CloudFront integration', () => {
  test('resizes image to requested dimensions (cover)', async () => {
    const url = `https://${CDN_DOMAIN}/img/200x150/cover/${TEST_KEY_ID}.jpg`;
    const response = await fetch(url);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/image\/jpeg/i);
    expect(response.headers.get('cache-control')).toMatch(/max-age=31536000/);

    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
    expect(meta.format).toBe('jpeg');
  });

  test('resizes image to requested dimensions (contain)', async () => {
    const url = `https://${CDN_DOMAIN}/img/100x100/contain/${TEST_KEY_ID}.jpg`;
    const response = await fetch(url);

    expect(response.status).toBe(200);
    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    // contain preserves aspect ratio — longest side will be 100
    expect(Math.max(meta.width, meta.height)).toBe(100);
  });

  test('returns 404 for a missing original', async () => {
    const url = `https://${CDN_DOMAIN}/img/100x100/cover/nonexistent-${Date.now()}.jpg`;
    const response = await fetch(url);
    expect(response.status).toBe(404);
  });

  test('passes through unrecognised paths without 5xx', async () => {
    // Lambda@Edge should pass through paths that don't match /img/...
    // CloudFront will return 403/404 from S3 origin — never a 500
    const response = await fetch(`https://${CDN_DOMAIN}/health`);
    expect(response.status).not.toBe(500);
    expect(response.status).not.toBe(502);
    expect(response.status).not.toBe(503);
  });
});
