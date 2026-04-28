const express = require('express');
const tenantRoommateProfileController = require('../controllers/tenantRoommateProfileController');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/', validateQuery(schemas.tenantRoommateProfileListQuery), tenantRoommateProfileController.list);

router.get(
  '/me',
  protect,
  restrictTo(USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  tenantRoommateProfileController.getMine,
);

router.put(
  '/me',
  protect,
  restrictTo(USER_ROLES.TENANT, USER_ROLES.ROOMMATE),
  validateBody(schemas.tenantRoommateProfileUpsert),
  tenantRoommateProfileController.upsertMine,
);

router.get(
  '/:id',
  validateParams(schemas.tenantRoommateProfileParamId),
  tenantRoommateProfileController.getOne,
);

module.exports = router;
