const express = require('express');
const amenityController = require('../controllers/amenityController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, requireStaff } = require('../middlewares/auth');

const router = express.Router();

router.get('/', amenityController.list);

router.post('/', protect, requireStaff, validateBody(schemas.createAmenity), amenityController.create);

router.patch('/:id', protect, requireStaff, validateParams(schemas.paramId), validateBody(schemas.updateAmenity), amenityController.update);

router.delete('/:id', protect, requireStaff, validateParams(schemas.paramId), amenityController.remove);

module.exports = router;
