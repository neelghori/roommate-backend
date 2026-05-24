const express = require('express');
const pushController = require('../controllers/pushController');
const { validateBody } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protectAppOrAdmin } = require('../middlewares/auth');
const { writeLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post(
  '/subscribe',
  protectAppOrAdmin,
  writeLimiter,
  validateBody(schemas.pushSubscribe),
  pushController.subscribe,
);
router.post(
  '/unsubscribe',
  protectAppOrAdmin,
  writeLimiter,
  validateBody(schemas.pushUnsubscribe),
  pushController.unsubscribe,
);

module.exports = router;
