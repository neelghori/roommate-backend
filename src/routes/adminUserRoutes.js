const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const { validateBody, validateQuery } = require('../middlewares/validate');
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

module.exports = router;
