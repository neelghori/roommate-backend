const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { runMulter } = require('./multerHandler');
const { MAX_PROPERTY_IMAGE_BYTES, MAX_PROPERTY_GALLERY_FILES } = require('../constants/uploads');

const storage = multer.memoryStorage();
const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

const imageFilter = (req, file, cb) => {
  const name = (file.originalname || '').trim();
  const mime = (file.mimetype || '').trim().toLowerCase();
  const okMime =
    IMAGE_MIME.test(mime) || (mime === 'application/octet-stream' && IMAGE_EXT.test(name));
  if (okMime || IMAGE_EXT.test(name)) {
    return cb(null, true);
  }
  // iOS/Android camera: empty type or generic name "image" / "image.jpg"
  if (!mime || mime === 'application/octet-stream') {
    const lower = name.toLowerCase();
    if (!lower || lower === 'image' || /^image\.(jpe?g|png|heic|heif)?$/i.test(lower)) {
      return cb(null, true);
    }
  }
  const err = new Error('Only JPEG, PNG, WebP, GIF, or HEIC images are allowed');
  err.statusCode = 400;
  return cb(err);
};

const galleryUpload = multer({
  storage,
  limits: { fileSize: MAX_PROPERTY_IMAGE_BYTES, files: MAX_PROPERTY_GALLERY_FILES },
  fileFilter: imageFilter,
});

function isMultipart(req) {
  const ct = req.headers['content-type'] || '';
  return ct.includes('multipart/form-data');
}

/** Parse JSON from `data` field after multer (create/update listing with images). */
function parsePropertyMultipart(req, res, next) {
  try {
    if (typeof req.body?.data === 'string') {
      const parsed = JSON.parse(req.body.data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return next(new ApiError(400, 'Invalid property data JSON in form field "data".'));
      }
      req.body = parsed;
    }
    return next();
  } catch {
    return next(new ApiError(400, 'Invalid property data JSON in form field "data".'));
  }
}

/** Apply multer only when Content-Type is multipart; otherwise pass through (JSON body). */
function optionalPropertyGalleryUpload(req, res, next) {
  if (!isMultipart(req)) return next();
  return runMulter(galleryUpload.array('images', MAX_PROPERTY_GALLERY_FILES))(
    req,
    res,
    (err) => {
      if (err) return next(err);
      return parsePropertyMultipart(req, res, next);
    },
  );
}

module.exports = {
  optionalPropertyGalleryUpload,
  parsePropertyMultipart,
  galleryUpload,
};
