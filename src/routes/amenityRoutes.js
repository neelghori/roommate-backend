const express = require('express');
const amenityController = require('../controllers/amenityController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protectAppOrAdmin, requireStaff } = require('../middlewares/auth');

const router = express.Router();

router.get('/', amenityController.list);

router.post('/', protectAppOrAdmin, requireStaff, validateBody(schemas.createAmenity), amenityController.create);

router.patch(
  '/:id',
  protectAppOrAdmin,
  requireStaff,
  validateParams(schemas.paramId),
  validateBody(schemas.updateAmenity),
  amenityController.update,
);

router.delete('/:id', protectAppOrAdmin, requireStaff, validateParams(schemas.paramId), amenityController.remove);

module.exports = router;
