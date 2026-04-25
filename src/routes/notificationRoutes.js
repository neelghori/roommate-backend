const express = require('express');
const notificationController = require('../controllers/notificationController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, protectAppOrAdmin, requireStaff } = require('../middlewares/auth');

const router = express.Router();

router.get('/', protect, notificationController.listMine);
router.patch('/:id/read', protect, validateParams(schemas.paramId), notificationController.markRead);
router.post('/', protectAppOrAdmin, requireStaff, validateBody(schemas.createNotification), notificationController.create);

module.exports = router;
