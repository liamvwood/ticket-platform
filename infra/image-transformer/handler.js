'use strict';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { resize } = require('./resize');

// Path pattern: /img/{width}x{height}/{fit}/{imageId}.jpg
const PATH_RE = /^\/img\/(\d+)x(\d+)\/(cover|contain)\/([^/]+)\.(jpg|jpeg|webp)$/i;

const s3 = new S3Client({ region: process.env.AWS_BUCKET_REGION || 'us-east-1' });
const BUCKET = process.env.IMAGE_BUCKET;

/**
 * Lambda@Edge origin-request handler.
 * Parses the request URI, fetches the original from S3, resizes, and returns
 * the transformed image with long-lived cache headers.
 */
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;

  const match = PATH_RE.exec(uri);
  if (!match) {
    // Not an image transform request — pass through
    return request;
  }

  const width   = parseInt(match[1], 10);
  const height  = parseInt(match[2], 10);
  const fit     = match[3].toLowerCase();
  const imageId = match[4];

  try {
    const originalKey = `originals/${imageId}.jpg`;

    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: originalKey,
    }));

    const chunks = [];
    for await (const chunk of Body) {
      chunks.push(chunk);
    }
    const originalBuffer = Buffer.concat(chunks);

    const resizedBuffer = await resize(originalBuffer, width, height, fit);

    const base64Image = resizedBuffer.toString('base64');

    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'image/jpeg' }],
        'cache-control': [{
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        }],
      },
      body: base64Image,
      bodyEncoding: 'base64',
    };
  } catch (err) {
    console.error('Image transform error:', err);

    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return {
        status: '404',
        statusDescription: 'Not Found',
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
        },
        body: 'Image not found',
      };
    }

    return {
      status: '500',
      statusDescription: 'Internal Server Error',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
      },
      body: 'Image processing error',
    };
  }
};
