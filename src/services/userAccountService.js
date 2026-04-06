const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/** Fields end users may update — never role, email, password, flags (mass-assignment safe) */
const PROFILE_FIELDS = [
  'fullName',
  'mobile',
  'professionalType',
  'lifestyle',
  'age',
  'gender',
  'profileImageUrl',
];

async function updateProfileById(userId, body) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (!user.isActive) throw new ApiError(403, 'This account is deactivated.');

  for (const key of PROFILE_FIELDS) {
    if (body[key] === undefined) continue;
    if (key === 'profileImageUrl' && (body[key] === '' || body[key] === null)) {
      user.set(key, undefined);
    } else {
      user[key] = body[key];
    }
  }

  try {
    await user.save();
  } catch (err) {
    if (err.name === 'ValidationError') {
      throw new ApiError(400, 'Could not update profile. Please check your details and try again.');
    }
    throw err;
  }

  return user;
}

async function changePasswordById(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found.');
  if (!user.isActive) throw new ApiError(403, 'This account is deactivated.');

  const currentOk = await user.comparePassword(currentPassword);
  if (!currentOk) {
    throw new ApiError(401, 'Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();
  return user;
}

module.exports = {
  updateProfileById,
  changePasswordById,
  PROFILE_FIELDS,
};
