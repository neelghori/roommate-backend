const express = require('express');
const adminPropertyController = require('../controllers/adminPropertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect, requireSuperAdmin } = require('../middlewares/auth');
const { writeLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.get('/', adminPropertyController.list);
router.get('/:id', validateParams(schemas.paramId), adminPropertyController.getOne);
router.patch(
  '/:id/moderate',
  writeLimiter,
  validateParams(schemas.paramId),
  validateBody(schemas.moderateProperty),
  adminPropertyController.moderate,
);

router.patch(
  '/:id/featured',
  writeLimiter,
  validateParams(schemas.paramId),
  validateBody(schemas.setPropertyFeatured),
  adminPropertyController.setFeatured,
);

router.delete(
  '/:id',
  requireSuperAdmin,
  writeLimiter,
  validateParams(schemas.paramId),
  adminPropertyController.remove,
);

module.exports = router;
