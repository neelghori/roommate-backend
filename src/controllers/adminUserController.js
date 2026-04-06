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
