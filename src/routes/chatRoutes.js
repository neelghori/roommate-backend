const express = require('express');
const chatController = require('../controllers/chatController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect } = require('../middlewares/auth');
const { writeLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(protect);

router.get('/conversations', chatController.conversations);
router.post('/messages', writeLimiter, validateBody(schemas.sendChat), chatController.send);
router.get('/thread/:userId', validateParams(schemas.paramUserId), chatController.thread);
router.post('/thread/:userId/read', validateParams(schemas.paramUserId), chatController.markRead);

module.exports = router;
