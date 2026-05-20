/** Max size per property gallery image (bytes). Keep in sync with website `uploadLimits.ts`. */
const MAX_PROPERTY_IMAGE_BYTES = 5 * 1024 * 1024;

const MAX_PROPERTY_GALLERY_FILES = 10;

/** Hint for ops when proxy rejects multipart before Node (nginx default is often 1m). */
const RECOMMENDED_PROXY_CLIENT_MAX_BODY = '64m';

module.exports = {
  MAX_PROPERTY_IMAGE_BYTES,
  MAX_PROPERTY_GALLERY_FILES,
  RECOMMENDED_PROXY_CLIENT_MAX_BODY,
};
