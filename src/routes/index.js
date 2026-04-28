const express = require('express');

const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/admin/auth', require('./adminAuthRoutes'));
router.use('/admin/users', require('./adminUserRoutes'));
router.use('/admin/properties', require('./adminPropertyRoutes'));
router.use('/admin/bookings', require('./adminBookingRoutes'));
router.use('/admin/dashboard', require('./adminDashboardRoutes'));
router.use('/properties', require('./propertyRoutes'));
router.use('/upload', require('./uploadRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/amenities', require('./amenityRoutes'));
router.use('/faqs', require('./faqRoutes'));
router.use('/support', require('./supportRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/tenant-roommate-profiles', require('./tenantRoommateProfileRoutes'));

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'roommate-api' });
});

module.exports = router;
