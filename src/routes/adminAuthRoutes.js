const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const { validateBody } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { adminProtect } = require('../middlewares/auth');
const {
  authLimiter,
  passwordResetLimiter,
  strictLimiter,
  passwordChangeLimiter,
} = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/login', authLimiter, validateBody(schemas.adminLogin), adminAuthController.login);
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validateBody(schemas.adminForgotPassword),
  adminAuthController.forgotPassword,
);
router.post('/reset-password', strictLimiter, validateBody(schemas.adminResetPassword), adminAuthController.resetPassword);
router.get('/me', adminProtect, adminAuthController.me);
router.patch('/me', adminProtect, strictLimiter, validateBody(schemas.updateProfile), adminAuthController.updateProfile);
router.post(
  '/change-password',
  adminProtect,
  passwordChangeLimiter,
  validateBody(schemas.changePassword),
  adminAuthController.changePassword,
);

module.exports = router;
