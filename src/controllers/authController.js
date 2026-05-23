const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');
const { USER_ROLES } = require('../constants/roles');
const userAccountService = require('../services/userAccountService');
const env = require('../config/env');
const { generatePasswordResetToken, hashPasswordResetToken } = require('../utils/tokenHash');
const {
  sendSignupVerificationEmail,
  sendUserPasswordResetEmail,
  isEmailConfigured,
} = require('../services/emailService');
const { verifyGoogleIdToken, randomLocalPassword } = require('../services/googleAuthService');

const APP_SIGNUP_ROLES = new Set([USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE]);

function frontendBaseUrl() {
  let u = (env.APP_PUBLIC_FRONTEND_URL || '').trim();
  if (!u && env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
    const origins = String(env.CORS_ORIGIN)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    u = origins[0] || '';
  }
  if (!u || u === '*') return '';
  return u.replace(/\/$/, '');
}

function buildEmailVerificationUrl(plainToken) {
  const base = frontendBaseUrl();
  if (!base) return null;
  const path = `/verify-email?token=${encodeURIComponent(plainToken)}`;
  return `${base}${path}`;
}

function buildUserPasswordResetUrl(plainToken) {
  const base = frontendBaseUrl();
  if (!base) return null;
  return `${base}/reset-password?token=${encodeURIComponent(plainToken)}`;
}

exports.register = catchAsync(async (req, res) => {
  const body = req.body;
  const exists = await User.findOne({ email: body.email });
  if (exists) throw new ApiError(409, 'Email already registered');

  const plainToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const expiresMs = Math.max(1, Number(env.EMAIL_VERIFICATION_EXPIRES_HOURS) || 48) * 3600000;
  const expiresAt = new Date(Date.now() + expiresMs);

  const needsEmailVerification = APP_SIGNUP_ROLES.has(body.role);

  const user = await User.create({
    fullName: body.fullName,
    mobile: body.mobile,
    email: body.email,
    role: body.role,
    password: body.password,
    professionalType: body.professionalType,
    lifestyle: body.lifestyle,
    age: body.age,
    gender: body.gender,
    profileImageUrl: body.profileImageUrl || undefined,
    emailVerified: !needsEmailVerification,
    mobileVerifiedByAdmin: !needsEmailVerification,
    ...(needsEmailVerification
      ? {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: expiresAt,
        }
      : {}),
  });

  let emailVerificationSent = false;
  if (needsEmailVerification && isEmailConfigured()) {
    const verifyUrl = buildEmailVerificationUrl(plainToken);
    if (verifyUrl) {
      try {
        await sendSignupVerificationEmail({
          to: user.email,
          verifyUrl,
          fullName: user.fullName,
        });
        emailVerificationSent = true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[register] verification email failed:', err.message || err);
      }
    }
  }

  const token = signToken({ sub: user.id });

  res.status(201).json({
    status: 'ok',
    data: { user: user.toSafeObject(), token, emailVerificationSent },
  });
});

exports.verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;
  const hash = hashPasswordResetToken(token);
  const user = await User.findOne({
    emailVerificationTokenHash: hash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) {
    throw new ApiError(400, 'This verification link is invalid or has expired.');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  const jwt = signToken({ sub: user.id });
  res.json({
    status: 'ok',
    data: { user: user.toSafeObject(), token: jwt },
  });
});

exports.resendVerificationEmail = catchAsync(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const generic =
    'If an account exists for this email and still needs confirmation, we sent a verification message.';

  const user = await User.findOne({ email }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user || user.emailVerified || !APP_SIGNUP_ROLES.has(user.role)) {
    return res.json({ status: 'ok', message: generic });
  }

  const plainToken = generatePasswordResetToken();
  user.emailVerificationTokenHash = hashPasswordResetToken(plainToken);
  user.emailVerificationExpires = new Date(
    Date.now() + Math.max(1, Number(env.EMAIL_VERIFICATION_EXPIRES_HOURS) || 48) * 3600000,
  );
  await user.save({ validateBeforeSave: false });

  if (isEmailConfigured()) {
    const verifyUrl = buildEmailVerificationUrl(plainToken);
    if (verifyUrl) {
      try {
        await sendSignupVerificationEmail({
          to: user.email,
          verifyUrl,
          fullName: user.fullName,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[resendVerification] email failed:', err.message || err);
      }
    }
  }

  res.json({ status: 'ok', message: generic });
});

exports.googleAuth = catchAsync(async (req, res) => {
  const { idToken, role } = req.body;
  const profile = await verifyGoogleIdToken(idToken);

  if (
    profile.email === (env.SUPERADMIN_EMAIL || '').trim().toLowerCase() ||
    profile.email.endsWith('@roommate.local')
  ) {
    throw new ApiError(403, 'This account must sign in through the admin panel.');
  }

  let user = await User.findOne({ googleId: profile.googleId });
  let isNew = false;

  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      if (user.role === USER_ROLES.SUPERADMIN || user.role === USER_ROLES.SUB_ADMIN) {
        throw new ApiError(403, 'This account must sign in through POST /api/v1/admin/auth/login');
      }
      if (!user.googleId) {
        user.googleId = profile.googleId;
        if (!user.profileImageUrl && profile.profileImageUrl) {
          user.profileImageUrl = profile.profileImageUrl;
        }
        user.emailVerified = true;
      }
    } else {
      if (!role || !APP_SIGNUP_ROLES.has(role)) {
        throw new ApiError(
          400,
          'Choose tenant, owner, or roommate to finish signing up with Google.',
        );
      }
      user = await User.create({
        fullName: profile.fullName,
        email: profile.email,
        googleId: profile.googleId,
        authProvider: 'google',
        role,
        password: randomLocalPassword(),
        professionalType: 'other',
        profileImageUrl: profile.profileImageUrl,
        emailVerified: true,
        mobileVerifiedByAdmin: false,
      });
      isNew = true;
    }
  } else if (user.role === USER_ROLES.SUPERADMIN || user.role === USER_ROLES.SUB_ADMIN) {
    throw new ApiError(403, 'This account must sign in through POST /api/v1/admin/auth/login');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'This account is deactivated.');
  }

  if (profile.profileImageUrl) {
    user.profileImageUrl = profile.profileImageUrl;
  }
  user.emailVerified = true;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken({ sub: user.id });

  res.json({
    status: 'ok',
    data: { user: user.toSafeObject(), token, isNew },
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'The email or password you entered is incorrect.');
  }

  if (user.role === USER_ROLES.SUPERADMIN || user.role === USER_ROLES.SUB_ADMIN) {
    throw new ApiError(403, 'This account must sign in through POST /api/v1/admin/auth/login');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken({ sub: user.id });

  res.json({
    status: 'ok',
    data: { user: user.toSafeObject(), token },
  });
});

exports.me = catchAsync(async (req, res) => {
  const Property = require('../models/Property');
  const SavedProperty = require('../models/SavedProperty');
  const Booking = require('../models/Booking');
  const uid = req.user._id;
  const [listingCount, shortlistedCount, bookingCount] = await Promise.all([
    Property.countDocuments({ owner: uid }),
    SavedProperty.countDocuments({ user: uid }),
    Booking.countDocuments({ requester: uid }),
  ]);
  const o = req.user.toSafeObject();
  o.listingCount = listingCount;
  o.shortlistedCount = shortlistedCount;
  o.bookingCount = bookingCount;
  res.json({ status: 'ok', data: { user: o } });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const user = await userAccountService.updateProfileById(req.user.id, req.body);
  res.json({ status: 'ok', data: { user: user.toSafeObject() } });
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
  const generic = {
    status: 'ok',
    message: 'If an account exists for this email, you will receive reset instructions shortly.',
  };

  const user = await User.findOne({
    email,
    role: { $in: [USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE] },
  });

  if (!user) return res.json(generic);

  if (!isEmailConfigured()) {
    throw new ApiError(503, 'Password reset emails are not configured on this server.');
  }

  const plainToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const ttlMs = env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000;

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + ttlMs);
  await user.save();

  const resetUrl = buildUserPasswordResetUrl(plainToken);

  try {
    await sendUserPasswordResetEmail({
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

  return res.json(generic);
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  const tokenHash = hashPasswordResetToken(token);

  const user = await User.findOne({
    role: { $in: [USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE] },
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'This reset link is invalid or has expired. Please request a new reset.');
  }

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  if (user.authProvider === 'google') {
    user.authProvider = 'local';
  }
  await user.save();

  res.json({
    status: 'ok',
    message: 'Your password has been updated. You can sign in with your new password.',
  });
});

