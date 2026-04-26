const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');
const { strictLimiter } = require('../middlewares/rateLimiter');
const ApiError = require('../utils/ApiError');

const router = express.Router();

const storage = multer.memoryStorage();
const imageFilter = (req, file, cb) => {
  if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
    return cb(new ApiError(400, 'Only JPEG, PNG, WebP, or GIF images are allowed'));
  }
  cb(null, true);
};

const identityDocFilter = (req, file, cb) => {
  const ok =
    /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype) || file.mimetype === 'application/pdf';
  if (!ok) {
    return cb(new ApiError(400, 'Only JPEG, PNG, WebP, or PDF files are allowed for identity verification'));
  }
  cb(null, true);
};

const uploadMemory = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: imageFilter,
});

const singleImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFilter,
});

const singleIdentityDoc = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: identityDocFilter,
});

router.post(
  '/properties/:propertyId/gallery',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyId),
  uploadMemory.array('images', 10),
  uploadController.uploadPropertyGallery,
);

router.post(
  '/properties/:propertyId/resident-profile',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyId),
  singleImage.single('image'),
  uploadController.uploadResidentProfileImage,
);

router.post(
  '/users/me/avatar',
  protect,
  strictLimiter,
  singleImage.single('image'),
  uploadController.uploadUserAvatar,
);

router.post(
  '/users/me/identity-document',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE),
  singleIdentityDoc.single('document'),
  uploadController.uploadUserIdentityDocument,
);

module.exports = router;
