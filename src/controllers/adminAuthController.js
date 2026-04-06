const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { signAdminToken } = require('../utils/jwt');
const { USER_ROLES, ADMIN_PANEL_ROLES } = require('../constants/roles');
const env = require('../config/env');
const { hashPasswordResetToken, generatePasswordResetToken } = require('../utils/tokenHash');
const { sendAdminPasswordResetEmail, isEmailConfigured } = require('../services/emailService');
const userAccountService = require('../services/userAccountService');

const FORGOT_PASSWORD_RESPONSE = {
  status: 'ok',
  message: 'If an account exists for this email, you will receive reset instructions shortly.',
};

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'The email or password you entered is incorrect.');
  }
  if (!ADMIN_PANEL_ROLES.includes(user.role)) {
    throw new ApiError(401, 'The email or password you entered is incorrect.');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signAdminToken({ sub: user.id });

  res.json({
    status: 'ok',
    data: {
      admin: user.toSafeObject(),
      token,
    },
  });
});

exports.me = catchAsync(async (req, res) => {
  res.json({ status: 'ok', data: { admin: req.user.toSafeObject() } });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const user = await userAccountService.updateProfileById(req.user.id, req.body);
  res.json({ status: 'ok', data: { admin: user.toSafeObject() } });
});

exports.changePassword = catchAsync(async (req, res) => {
  await userAccountService.changePasswordById(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({
    status: 'ok',
    message: 'Your password has been updated successfully.',
  });
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const user = await User.findOne({ email, role: { $in: ADMIN_PANEL_ROLES } });

  if (!user) {
    return res.json(FORGOT_PASSWORD_RESPONSE);
  }

  if (!isEmailConfigured()) {
    throw new ApiError(503, 'Password reset emails are not configured on this server.');
  }

  const plainToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const ttlMs = env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000;

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + ttlMs);

  await user.save();

  let resetUrl = null;
  if (env.ADMIN_PASSWORD_RESET_BASE_URL) {
    const base = env.ADMIN_PASSWORD_RESET_BASE_URL.replace(/\/$/, '');
    resetUrl = `${base}?token=${encodeURIComponent(plainToken)}`;
  }

  try {
    await sendAdminPasswordResetEmail({
      to: user.email,
      resetUrl,
      token: plainToken,
      expiresInMinutes: env.PASSWORD_RESET_EXPIRES_MINUTES,
    });
  } catch {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(503, 'We could not send the reset email. Please try again later.');
  }

  res.json(FORGOT_PASSWORD_RESPONSE);
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  const tokenHash = hashPasswordResetToken(token);

  const user = await User.findOne({
    role: { $in: ADMIN_PANEL_ROLES },
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'This reset link is invalid or has expired. Please request a new reset.');
  }

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({
    status: 'ok',
    message: 'Your password has been updated. You can sign in with your new password.',
  });
});
