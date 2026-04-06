const express = require('express');
const bookingController = require('../controllers/bookingController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { optionalAuth, protect } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post(
  '/',
  strictLimiter,
  optionalAuth,
  validateBody(schemas.createBooking),
  bookingController.create,
);

router.get(
  '/property/:propertyId',
  protect,
  validateParams(schemas.paramPropertyId),
  bookingController.listForProperty,
);

router.patch(
  '/:id/status',
  protect,
  validateParams(schemas.paramId),
  validateBody(schemas.updateBookingStatus),
  bookingController.updateStatus,
);

module.exports = router;
