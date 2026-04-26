const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constants/roles');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.list = catchAsync(async (req, res) => {
  const { page, limit, role, search, isActive } = req.query;

  if (req.user.role === USER_ROLES.SUB_ADMIN && role === USER_ROLES.SUPERADMIN) {
    return res.json({
      status: 'ok',
      data: { items: [], page, limit, total: 0, pages: 0 },
    });
  }

  const conditions = [];

  if (role) {
    conditions.push({ role });
  } else if (req.user.role === USER_ROLES.SUB_ADMIN) {
    conditions.push({ role: { $ne: USER_ROLES.SUPERADMIN } });
  }

  if (isActive === 'true') conditions.push({ isActive: true });
  if (isActive === 'false') conditions.push({ isActive: false });

  if (search) {
    const safe = escapeRegExp(search);
    conditions.push({
      $or: [{ email: new RegExp(safe, 'i') }, { fullName: new RegExp(safe, 'i') }],
    });
  }

  const filter =
    conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-password -passwordResetTokenHash -passwordResetExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limit) || 1;

  res.json({
    status: 'ok',
    data: {
      items,
      page,
      limit,
      total,
      pages,
    },
  });
});

exports.create = catchAsync(async (req, res) => {
  const { fullName, email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    password,
    role: USER_ROLES.SUB_ADMIN,
  });

  res.status(201).json({
    status: 'ok',
    data: { admin: user.toSafeObject() },
  });
});

function assertCanAccessUserDoc(requester, target) {
  if (requester.role === USER_ROLES.SUB_ADMIN && target.role === USER_ROLES.SUPERADMIN) {
    throw new ApiError(403, 'You cannot view this user.');
  }
}

exports.getById = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -passwordResetTokenHash -passwordResetExpires')
    .lean();
  if (!user) throw new ApiError(404, 'User not found');
  assertCanAccessUserDoc(req.user, user);
  res.json({ status: 'ok', data: { user } });
});

exports.reviewIdentity = catchAsync(async (req, res) => {
  const { action, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanAccessUserDoc(req.user, user);

  if (user.identityVerificationStatus !== 'pending') {
    throw new ApiError(400, 'No pending identity verification for this user.');
  }

  if (action === 'verify') {
    user.identityVerificationStatus = 'verified';
    user.identityReviewedAt = new Date();
    user.identityReviewedBy = req.user._id;
    user.identityRejectionReason = undefined;
  } else {
    user.identityVerificationStatus = 'rejected';
    user.identityReviewedAt = new Date();
    user.identityReviewedBy = req.user._id;
    user.identityRejectionReason = (reason && String(reason).trim()) || 'Document could not be verified.';
  }

  await user.save({ validateBeforeSave: false });
  res.json({ status: 'ok', data: { user: user.toSafeObject() } });
});

exports.patchUser = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanAccessUserDoc(req.user, user);

  if (typeof isActive === 'boolean') {
    if (!isActive && user._id.equals(req.user._id)) {
      throw new ApiError(400, 'You cannot deactivate your own account.');
    }
    user.isActive = isActive;
  }

  await user.save({ validateBeforeSave: false });
  res.json({ status: 'ok', data: { user: user.toSafeObject() } });
});
