const express = require('express');
const propertyController = require('../controllers/propertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo, optionalAuth } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');
const { writeLimiter, uploadLimiter } = require('../middlewares/rateLimiter');
const { optionalPropertyGalleryUpload } = require('../middlewares/propertyMultipart');

const router = express.Router();

router.get('/', optionalAuth, propertyController.list);
router.get('/saved/mine', protect, propertyController.mySaved);
router.get('/mine/listings', protect, restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE), propertyController.myListings);
router.get('/:id', optionalAuth, validateParams(schemas.paramId), propertyController.getOne);

router.post(
  '/',
  protect,
  uploadLimiter,
  writeLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  optionalPropertyGalleryUpload,
  validateBody(schemas.createProperty),
  propertyController.create,
);

router.post(
  '/:id/lister-residents',
  protect,
  writeLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramId),
  validateBody(schemas.listerResidentPostBody),
  propertyController.addListerResident,
);

router.patch(
  '/:id/lister-residents/:residentId',
  protect,
  writeLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyResident),
  validateBody(schemas.patchListerResidentBody),
  propertyController.updateListerResident,
);

router.delete(
  '/:id/lister-residents/:residentId',
  protect,
  writeLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyResident),
  propertyController.deleteListerResident,
);

/**
 * PATCH /:id — partial update (only sent fields change; optional multipart `data` + `images`).
 * PUT is not used: our handler merges into the existing document, it does not replace the full resource.
 * POST /:id is not defined (create is POST / only).
 */
router.patch(
  '/:id',
  protect,
  uploadLimiter,
  writeLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramId),
  optionalPropertyGalleryUpload,
  validateBody(schemas.updateProperty),
  propertyController.update,
);

router.delete('/:id', protect, validateParams(schemas.paramId), propertyController.remove);

router.post('/:id/save', protect, validateParams(schemas.paramId), propertyController.saveListing);
router.delete('/:id/save', protect, validateParams(schemas.paramId), propertyController.unsaveListing);

module.exports = router;
