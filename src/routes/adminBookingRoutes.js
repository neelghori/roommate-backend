const express = require('express');
const adminBookingController = require('../controllers/adminBookingController');
const { adminProtect } = require('../middlewares/auth');

const router = express.Router();

router.use(adminProtect);

router.get('/', adminBookingController.list);

module.exports = router;
