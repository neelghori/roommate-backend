const express = require('express');

const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/admin/auth', require('./adminAuthRoutes'));
router.use('/admin/users', require('./adminUserRoutes'));
router.use('/properties', require('./propertyRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/amenities', require('./amenityRoutes'));
router.use('/faqs', require('./faqRoutes'));
router.use('/support', require('./supportRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/notifications', require('./notificationRoutes'));

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'roommate-api' });
});

module.exports = router;
