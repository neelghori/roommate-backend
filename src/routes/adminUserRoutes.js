const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const { validateBody, validateQuery, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect, requireSuperAdmin } = require('../middlewares/auth');
const { writeLimiter, authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.post(
  '/',
  requireSuperAdmin,
  authLimiter,
  validateBody(schemas.createAdminUser),
  adminUserController.create,
);
router.get('/', validateQuery(schemas.adminUserListQuery), adminUserController.list);

router.get(
  '/:id',
  validateParams(schemas.paramAdminUserId),
  adminUserController.getById,
);

router.patch(
  '/:id',
  requireSuperAdmin,
  writeLimiter,
  validateParams(schemas.paramAdminUserId),
  validateBody(schemas.adminUserPatch),
  adminUserController.patchUser,
);

router.post(
  '/:id/identity-review',
  requireSuperAdmin,
  writeLimiter,
  validateParams(schemas.paramAdminUserId),
  validateBody(schemas.adminUserIdentityReview),
  adminUserController.reviewIdentity,
);

module.exports = router;
