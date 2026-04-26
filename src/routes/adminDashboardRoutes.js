const express = require('express');
const adminDashboardController = require('../controllers/adminDashboardController');
const { adminProtect } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(adminProtect);

router.get('/overview', strictLimiter, adminDashboardController.getOverview);

module.exports = router;
