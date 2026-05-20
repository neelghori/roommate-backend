const ApiError = require('./ApiError');
const { USER_ROLES } = require('../constants/roles');

/** Listing owner or platform staff (superadmin / sub_admin / isStaff). */
function canManageProperty(user, propertyDoc) {
  if (!user || !propertyDoc) return false;
  const ownerId = propertyDoc.owner?._id ?? propertyDoc.owner;
  if (ownerId && user._id && ownerId.equals(user._id)) return true;
  if (user.isStaff) return true;
  const role = String(user.role ?? '').trim().toLowerCase();
  return role === USER_ROLES.SUPERADMIN || role === USER_ROLES.SUB_ADMIN;
}

function assertCanManageProperty(user, propertyDoc) {
  if (!propertyDoc) throw new ApiError(404, 'Listing not found');
  if (!canManageProperty(user, propertyDoc)) {
    throw new ApiError(403, 'You can only edit your own listings');
  }
}

module.exports = { canManageProperty, assertCanManageProperty };
