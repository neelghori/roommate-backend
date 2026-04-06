const express = require('express');
const supportController = require('../controllers/supportController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/', protect, validateBody(schemas.createSupport), supportController.create);
router.get('/mine', protect, supportController.myTickets);
router.patch('/:id', protect, validateParams(schemas.paramId), validateBody(schemas.patchSupport), supportController.update);

module.exports = router;
