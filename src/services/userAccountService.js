const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/** Scalar fields end users may update — never role, email, password, flags (mass-assignment safe) */
const PROFILE_FIELDS = [
  'fullName',
  'mobile',
  'professionalType',
  'age',
  'gender',
  'profileImageUrl',
  'bio',
  'location',
  'monthlyBudget',
  'moveInDate',
  'roommateGenderPreference',
];

function clearableStringField(key) {
  return ['profileImageUrl', 'bio', 'location'].includes(key);
}

/** Parse `YYYY-MM-DD` to a UTC Date at noon (stable calendar day). */
function parseYmdUtcNoon(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function computeAgeYearsFromDobUtc(dobUtc, now = new Date()) {
  let age = now.getUTCFullYear() - dobUtc.getUTCFullYear();
  const md = now.getUTCMonth() - dobUtc.getUTCMonth();
  if (md < 0 || (md === 0 && now.getUTCDate() < dobUtc.getUTCDate())) age -= 1;
  return age;
}

async function updateProfileById(userId, body) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (!user.isActive) throw new ApiError(403, 'This account is deactivated.');

  if (body.lifestyle !== undefined) {
    const L = body.lifestyle;
    if (L && typeof L === 'object' && Array.isArray(L.tags)) {
      user.set('lifestyleTags', L.tags.length ? L.tags : undefined);
    } else if (L && typeof L === 'object' && !Array.isArray(L)) {
      const next = { ...(user.lifestyle && user.lifestyle.toObject ? user.lifestyle.toObject() : user.lifestyle || {}) };
      if (L.diet !== undefined) next.diet = L.diet;
      if (L.smoking !== undefined) next.smoking = L.smoking;
      if (L.maritalStatus !== undefined) next.maritalStatus = L.maritalStatus;
      if (Object.keys(next).length) user.set('lifestyle', next);
    }
  }

  for (const key of PROFILE_FIELDS) {
    if (body[key] === undefined) continue;
    if (clearableStringField(key) && (body[key] === '' || body[key] === null)) {
      user.set(key, undefined);
    } else if (key === 'moveInDate' && (body[key] === '' || body[key] === null)) {
      user.set(key, undefined);
    } else if (key === 'roommateGenderPreference' && (body[key] === '' || body[key] === null)) {
      user.set(key, undefined);
    } else if (key === 'monthlyBudget' && (body[key] === null || body[key] === '')) {
      user.set(key, undefined);
    } else {
      user.set(key, body[key]);
    }
  }

  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === '' || body.dateOfBirth === null) {
      user.set('dateOfBirth', undefined);
      user.set('age', undefined);
    } else {
      const dob = parseYmdUtcNoon(body.dateOfBirth);
      if (!dob) throw new ApiError(400, 'Invalid date of birth.');
      const now = new Date();
      if (dob.getTime() > now.getTime()) {
        throw new ApiError(400, 'Date of birth cannot be in the future.');
      }
      const age = computeAgeYearsFromDobUtc(dob, now);
      if (age < 16 || age > 120) {
        throw new ApiError(400, 'Age from date of birth must be between 16 and 120.');
      }
      user.set('dateOfBirth', dob);
      user.set('age', age);
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
