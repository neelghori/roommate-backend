const express = require('express');
const propertyController = require('../controllers/propertyController');
const { validateBody, validateParams } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect, restrictTo } = require('../middlewares/auth');
const { USER_ROLES } = require('../constants/roles');
const { strictLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.get('/', propertyController.list);
router.get('/saved/mine', protect, propertyController.mySaved);
router.get('/mine/listings', protect, restrictTo(USER_ROLES.OWNER), propertyController.myListings);
router.get('/:id', validateParams(schemas.paramId), propertyController.getOne);

router.post(
  '/',
  protect,
  strictLimiter,
  restrictTo(USER_ROLES.OWNER),
  validateBody(schemas.createProperty),
  propertyController.create,
);

router.patch(
  '/:id',
  protect,
  strictLimiter,
  validateParams(schemas.paramId),
  validateBody(schemas.updateProperty),
  propertyController.update,
);

router.delete('/:id', protect, validateParams(schemas.paramId), propertyController.remove);

router.post('/:id/save', protect, validateParams(schemas.paramId), propertyController.saveListing);
router.delete('/:id/save', protect, validateParams(schemas.paramId), propertyController.unsaveListing);

module.exports = router;
