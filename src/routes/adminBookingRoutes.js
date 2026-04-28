const express = require('express');
const adminBookingController = require('../controllers/adminBookingController');
const { adminProtect } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.get('/', strictLimiter, adminBookingController.list);

module.exports = router;
