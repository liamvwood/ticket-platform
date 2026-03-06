'use strict';

const sharp = require('sharp');

// Stub config before loading handler
jest.mock('../config', () => ({
  IMAGE_BUCKET: 'test-bucket',
  BUCKET_REGION: 'us-east-1',
}), { virtual: true });

// Mock S3Client
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn((params) => ({ _params: params })),
}));

const { handler } = require('../handler');

/** Build a minimal CloudFront origin-request event */
function cfEvent(uri) {
  return {
    Records: [{ cf: { request: { uri, headers: {} } } }],
  };
}

/** Create a small real JPEG buffer using sharp */
async function makeJpeg(w = 200, h = 150) {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 100, g: 100, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

/** Make a readable stream from a buffer (mimics S3 Body) */
async function* bufferStream(buf) {
  yield buf;
}

beforeEach(() => mockSend.mockReset());

describe('handler – pass-through', () => {
  test('returns the original request unchanged for unrecognised paths', async () => {
    const event = cfEvent('/health');
    const result = await handler(event);
    expect(result).toBe(event.Records[0].cf.request);
  });

  test('returns request unchanged for paths missing fit parameter', async () => {
    const event = cfEvent('/img/200x150/unknown/photo.jpg');
    const result = await handler(event);
    expect(result).toBe(event.Records[0].cf.request);
  });
});

describe('handler – image resize (200 OK)', () => {
  test('returns 200 with base64 JPEG for valid cover request', async () => {
    const jpegBuf = await makeJpeg(400, 300);
    mockSend.mockResolvedValueOnce({ Body: bufferStream(jpegBuf) });

    const result = await handler(cfEvent('/img/200x150/cover/abc123.jpg'));

    expect(result.status).toBe('200');
    expect(result.bodyEncoding).toBe('base64');
    expect(result.headers['content-type'][0].value).toMatch(/image\/jpeg/i);
    expect(result.headers['cache-control'][0].value).toMatch(/max-age=31536000/);

    const decoded = Buffer.from(result.body, 'base64');
    const meta = await sharp(decoded).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
    expect(meta.format).toBe('jpeg');
  });

  test('returns 200 with base64 JPEG for valid contain request', async () => {
    const jpegBuf = await makeJpeg(400, 300);
    mockSend.mockResolvedValueOnce({ Body: bufferStream(jpegBuf) });

    const result = await handler(cfEvent('/img/100x100/contain/abc123.jpg'));

    expect(result.status).toBe('200');
    const decoded = Buffer.from(result.body, 'base64');
    const meta = await sharp(decoded).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(100);
  });
});

describe('handler – error cases', () => {
  test('returns 404 when S3 throws NoSuchKey', async () => {
    const err = new Error('NoSuchKey');
    err.name = 'NoSuchKey';
    mockSend.mockRejectedValueOnce(err);

    const result = await handler(cfEvent('/img/100x100/cover/missing.jpg'));

    expect(result.status).toBe('404');
  });

  test('returns 404 when S3 returns 404 metadata', async () => {
    const err = new Error('Not Found');
    err.$metadata = { httpStatusCode: 404 };
    mockSend.mockRejectedValueOnce(err);

    const result = await handler(cfEvent('/img/100x100/cover/missing.jpg'));

    expect(result.status).toBe('404');
  });

  test('returns 500 on unexpected S3 error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

    const result = await handler(cfEvent('/img/100x100/cover/photo.jpg'));

    expect(result.status).toBe('500');
  });
});
