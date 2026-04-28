const express = require('express');
const propertyController = require('../controllers/propertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo, optionalAuth } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.get('/', optionalAuth, propertyController.list);
router.get('/saved/mine', protect, propertyController.mySaved);
router.get('/mine/listings', protect, restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE), propertyController.myListings);
router.get('/:id', optionalAuth, validateParams(schemas.paramId), propertyController.getOne);

router.post(
  '/',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateBody(schemas.createProperty),
  propertyController.create,
);

router.post(
  '/:id/lister-residents',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramId),
  validateBody(schemas.listerResidentPostBody),
  propertyController.addListerResident,
);

router.patch(
  '/:id/lister-residents/:residentId',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyResident),
  validateBody(schemas.patchListerResidentBody),
  propertyController.updateListerResident,
);

router.delete(
  '/:id/lister-residents/:residentId',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER, USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateParams(schemas.paramPropertyResident),
  propertyController.deleteListerResident,
);

router.patch(
  '/:id',
  protect,
  strictLimiter,
  validateParams(schemas.paramId),
  validateBody(schemas.updateProperty),
  propertyController.update,
);

router.delete('/:id', protect, validateParams(schemas.paramId), propertyController.remove);

router.post('/:id/save', protect, validateParams(schemas.paramId), propertyController.saveListing);
router.delete('/:id/save', protect, validateParams(schemas.paramId), propertyController.unsaveListing);

module.exports = router;
