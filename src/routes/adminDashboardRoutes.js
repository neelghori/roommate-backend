const express = require('express');
const adminDashboardController = require('../controllers/adminDashboardController');
const { adminProtect } = require('../middlewares/auth');

const router = express.Router();

router.use(adminProtect);

router.get('/overview', adminDashboardController.getOverview);

module.exports = router;
