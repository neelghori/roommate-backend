const ApiError = require('../utils/ApiError');
const { verifyToken, verifyAdminToken } = require('../utils/jwt');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { USER_ROLES, ADMIN_PANEL_ROLES } = require('../constants/roles');

const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);
    if (user && user.isActive) req.user = user;
  } catch {
    /* invalid token — treat as guest */
  }
  return next();
});

const protect = catchAsync(async (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) throw new ApiError(401, 'Not authenticated');

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'User not found or deactivated');

  req.user = user;
  next();
});

/** Accept either app JWT or admin JWT — use for staff routes called from mobile app or admin panel */
const protectAppOrAdmin = catchAsync(async (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);

  if (!token) throw new ApiError(401, 'Not authenticated');

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    try {
      decoded = verifyAdminToken(token);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'User not found or deactivated');

  req.user = user;
  next();
});

const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(403, 'Not allowed for this role'));
  }
  const userRole =
    req.user.role == null ? '' : String(req.user.role).trim().toLowerCase();
  const allowed = roles.map((r) => String(r).trim().toLowerCase());
  if (!allowed.includes(userRole)) {
    return next(new ApiError(403, 'Not allowed for this role'));
  }
  return next();
};

const requireStaff = (req, res, next) => {
  if (!req.user) return next(new ApiError(403, 'Staff only'));
  if (
    req.user.isStaff ||
    req.user.role === USER_ROLES.SUPERADMIN ||
    req.user.role === USER_ROLES.SUB_ADMIN
  ) {
    return next();
  }
  return next(new ApiError(403, 'Staff only'));
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.SUPERADMIN) {
    return next(new ApiError(403, 'Only a super administrator can perform this action.'));
  }
  return next();
};

const adminProtect = catchAsync(async (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) throw new ApiError(401, 'Not authenticated');

  let decoded;
  try {
    decoded = verifyAdminToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired admin token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'User not found or deactivated');
  if (!ADMIN_PANEL_ROLES.includes(user.role)) throw new ApiError(403, 'Admin access denied');

  req.user = user;
  next();
});

module.exports = {
  optionalAuth,
  protect,
  protectAppOrAdmin,
  adminProtect,
  restrictTo,
  requireStaff,
  requireSuperAdmin,
};
