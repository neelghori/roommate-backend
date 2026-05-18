const express = require('express');
const bookingController = require('../controllers/bookingController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect } = require('../middlewares/auth');
const { writeLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post(
  '/',
  protect,
  writeLimiter,
  validateBody(schemas.createBooking),
  bookingController.create,
);

router.get('/me', protect, bookingController.listMine);

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
