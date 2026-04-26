const express = require('express');
const notificationController = require('../controllers/notificationController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protectAppOrAdmin, requireStaff } = require('../middlewares/auth');

const router = express.Router();

/** App or admin JWT — staff need admin token from the dashboard to load their inbox. */
router.get('/', protectAppOrAdmin, notificationController.listMine);
router.patch('/:id/read', protectAppOrAdmin, validateParams(schemas.paramId), notificationController.markRead);
router.post('/', protectAppOrAdmin, requireStaff, validateBody(schemas.createNotification), notificationController.create);

module.exports = router;
