const express = require('express');
const adminPropertyController = require('../controllers/adminPropertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect } = require('../middlewares/auth');
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

module.exports = router;
