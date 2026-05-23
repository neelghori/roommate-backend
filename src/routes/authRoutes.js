const express = require('express');
const authController = require('../controllers/authController');
const { validateBody } = require('../middlewares/validate');
const schemas = require('../validators/schemas');
const { protect } = require('../middlewares/auth');
const { authLimiter, writeLimiter, passwordChangeLimiter, passwordResetLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, validateBody(schemas.register), authController.register);
router.post('/verify-email', authLimiter, validateBody(schemas.verifyEmail), authController.verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validateBody(schemas.resendVerificationEmail),
  authController.resendVerificationEmail,
);
router.post('/login', authLimiter, validateBody(schemas.login), authController.login);
router.post('/google', authLimiter, validateBody(schemas.googleAuth), authController.googleAuth);
router.post('/forgot-password', passwordResetLimiter, validateBody(schemas.userForgotPassword), authController.forgotPassword);
router.post('/reset-password', authLimiter, validateBody(schemas.userResetPassword), authController.resetPassword);
router.get('/me', protect, authController.me);
router.patch('/me', protect, writeLimiter, validateBody(schemas.updateProfile), authController.updateProfile);
router.post(
  '/change-password',
  protect,
  passwordChangeLimiter,
  validateBody(schemas.changePassword),
  authController.changePassword,
);

module.exports = router;
