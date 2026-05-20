const ApiError = require('../utils/ApiError');
const { isS3Configured, putImageObject, randomImageObjectName } = require('./s3Upload');
const { MAX_PROPERTY_GALLERY_FILES } = require('../constants/uploads');

function requireS3() {
  if (!isS3Configured()) {
    throw new ApiError(
      503,
      'Image uploads are not configured. Set AWS_S3_BUCKET and AWS_REGION (and credentials if needed).',
    );
  }
}

/**
 * Upload gallery buffers to S3 under properties/{propertyId}/.
 * @param {string} propertyId
 * @param {import('multer').File[]} files
 * @returns {Promise<string[]>}
 */
async function uploadGalleryBuffers(propertyId, files) {
  if (!files?.length) return [];
  requireS3();
  const urls = [];
  for (const f of files) {
    const key = `properties/${propertyId}/${randomImageObjectName(f.mimetype)}`;
    try {
      const url = await putImageObject(key, f.buffer, f.mimetype);
      urls.push(url);
    } catch (e) {
      if (e.code === 'S3_NOT_CONFIGURED') throw new ApiError(503, 'S3 is not configured');
      throw e;
    }
  }
  return urls;
}

function mergeImageUrls(existing, uploaded) {
  const base = Array.isArray(existing) ? existing.map((u) => String(u).trim()).filter(Boolean) : [];
  const added = Array.isArray(uploaded) ? uploaded : [];
  return [...new Set([...base, ...added])].slice(0, MAX_PROPERTY_GALLERY_FILES);
}

module.exports = {
  uploadGalleryBuffers,
  mergeImageUrls,
};
