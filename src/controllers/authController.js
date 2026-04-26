const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');
const { USER_ROLES } = require('../constants/roles');
const userAccountService = require('../services/userAccountService');

exports.register = catchAsync(async (req, res) => {
  const body = req.body;
  const exists = await User.findOne({ email: body.email });
  if (exists) throw new ApiError(409, 'Email already registered');

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
  });

  const token = signToken({ sub: user.id });

  res.status(201).json({
    status: 'ok',
    data: { user: user.toSafeObject(), token },
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
