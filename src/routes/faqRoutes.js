const express = require('express');
const faqController = require('../controllers/faqController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protectAppOrAdmin, requireStaff } = require('../middlewares/auth');

const router = express.Router();

router.get('/', faqController.listPublic);

router.post('/', protectAppOrAdmin, requireStaff, validateBody(schemas.createFaq), faqController.create);

router.patch(
  '/:id',
  protectAppOrAdmin,
  requireStaff,
  validateParams(schemas.paramId),
  validateBody(schemas.updateFaq),
  faqController.update,
);

router.delete('/:id', protectAppOrAdmin, requireStaff, validateParams(schemas.paramId), faqController.remove);

module.exports = router;
