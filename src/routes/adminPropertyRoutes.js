const express = require('express');
const adminPropertyController = require('../controllers/adminPropertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.get('/', strictLimiter, adminPropertyController.list);
router.get('/:id', strictLimiter, validateParams(schemas.paramId), adminPropertyController.getOne);
router.patch(
  '/:id/moderate',
  strictLimiter,
  validateParams(schemas.paramId),
  validateBody(schemas.moderateProperty),
  adminPropertyController.moderate,
);

module.exports = router;
