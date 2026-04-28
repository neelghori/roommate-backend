const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const { validateBody, validateQuery, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect, requireSuperAdmin } = require('../middlewares/auth');
const { strictLimiter, authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.post(
  '/',
  requireSuperAdmin,
  authLimiter,
  strictLimiter,
  validateBody(schemas.createAdminUser),
  adminUserController.create,
);
router.get('/', strictLimiter, validateQuery(schemas.adminUserListQuery), adminUserController.list);

router.get(
  '/:id',
  strictLimiter,
  validateParams(schemas.paramAdminUserId),
  adminUserController.getById,
);

router.patch(
  '/:id',
  requireSuperAdmin,
  strictLimiter,
  validateParams(schemas.paramAdminUserId),
  validateBody(schemas.adminUserPatch),
  adminUserController.patchUser,
);

router.post(
  '/:id/identity-review',
  requireSuperAdmin,
  strictLimiter,
  validateParams(schemas.paramAdminUserId),
  validateBody(schemas.adminUserIdentityReview),
  adminUserController.reviewIdentity,
);

module.exports = router;
