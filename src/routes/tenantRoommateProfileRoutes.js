const express = require('express');
const tenantRoommateProfileController = require('../controllers/tenantRoommateProfileController');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo, optionalAuth } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/',
  optionalAuth,
  validateQuery(schemas.tenantRoommateProfileListQuery),
  tenantRoommateProfileController.list,
);

router.get('/me', protect, restrictTo(USER_ROLES.TENANT), tenantRoommateProfileController.getMine);

router.put(
  '/me',
  protect,
  restrictTo(USER_ROLES.TENANT),
  validateBody(schemas.tenantRoommateProfileUpsert),
  tenantRoommateProfileController.upsertMine,
);

router.get(
  '/:id',
  optionalAuth,
  validateParams(schemas.paramId),
  tenantRoommateProfileController.getOne,
);

module.exports = router;
