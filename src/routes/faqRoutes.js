const express = require('express');
const faqController = require('../controllers/faqController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, requireStaff } = require('../middlewares/auth');

const router = express.Router();

router.get('/', faqController.listPublic);

router.post('/', protect, requireStaff, validateBody(schemas.createFaq), faqController.create);

router.patch('/:id', protect, requireStaff, validateParams(schemas.paramId), validateBody(schemas.updateFaq), faqController.update);

router.delete('/:id', protect, requireStaff, validateParams(schemas.paramId), faqController.remove);

module.exports = router;
