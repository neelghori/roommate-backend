const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const { MAX_PROPERTY_IMAGE_BYTES } = require('../constants/uploads');
const { runMulter } = require('../middlewares/multerHandler');

const router = express.Router();

const storage = multer.memoryStorage();
const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

const imageFilter = (req, file, cb) => {
  const name = file.originalname || '';
  const mime = file.mimetype || '';
  const okMime =
    IMAGE_MIME.test(mime) ||
    (mime === 'application/octet-stream' && IMAGE_EXT.test(name));
  if (okMime || IMAGE_EXT.test(name)) {
    return cb(null, true);
  }
  const err = new Error('Only JPEG, PNG, WebP, GIF, or HEIC images are allowed');
  err.statusCode = 400;
  return cb(err);
};

const identityDocFilter = (req, file, cb) => {
  const ok =
    /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype) || file.mimetype === 'application/pdf';
  if (!ok) {
    const err = new Error('Only JPEG, PNG, WebP, or PDF files are allowed for identity verification');
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
};

const singleImage = multer({
  storage,
  limits: { fileSize: MAX_PROPERTY_IMAGE_BYTES, files: 1 },
  fileFilter: imageFilter,
});

const singleIdentityDoc = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: identityDocFilter,
});

router.post(
  '/properties/:propertyId/resident-profile',
  protect,
  uploadLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyId),
  runMulter(singleImage.single('image')),
  uploadController.uploadResidentProfileImage,
);

router.post(
  '/users/me/avatar',
  protect,
  uploadLimiter,
  runMulter(singleImage.single('image')),
  uploadController.uploadUserAvatar,
);

router.post(
  '/users/me/identity-document',
  protect,
  uploadLimiter,
  restrictTo(USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE),
  runMulter(singleIdentityDoc.single('document')),
  uploadController.uploadUserIdentityDocument,
);

module.exports = router;
