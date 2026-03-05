'use strict';

const sharp = require('sharp');

/**
 * Resize an image buffer.
 *
 * @param {Buffer} inputBuffer  - Original image bytes
 * @param {number} width        - Target width (0 = auto)
 * @param {number} height       - Target height (0 = auto)
 * @param {'cover'|'contain'} fit - Resize fit mode
 * @returns {Promise<Buffer>} JPEG bytes
 */
async function resize(inputBuffer, width, height, fit) {
  const w = width > 0 ? width : null;
  const h = height > 0 ? height : null;

  const validFit = fit === 'contain' ? 'contain' : 'cover';

  return sharp(inputBuffer)
    .resize({
      width: w,
      height: h,
      fit: validFit,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

module.exports = { resize };
