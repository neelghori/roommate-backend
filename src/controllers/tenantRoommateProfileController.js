const TenantRoommateProfile = require('../models/TenantRoommateProfile');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constants/roles');

const ALLOWED_TAGS = new Set([
  'Non-Smoker',
  'Vegetarian',
  'Non-Veg',
  'Early Bird',
  'Night Owl',
  'Pet Friendly',
  'Working',
  'Student',
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTagsParam(raw) {
  if (raw == null || raw === '') return [];
  const parts = String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.filter((t) => ALLOWED_TAGS.has(t));
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isoMaybe(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v.trim()) return v;
  return undefined;
}

const USER_ENUM_TO_SEEKER_TAG = {
  STUDENT: 'Student',
  WORKING: 'Working',
  VEGETARIAN: 'Vegetarian',
  NON_VEG: 'Non-Veg',
  NON_SMOKER: 'Non-Smoker',
  SMOKER: 'Non-Smoker',
  PET_FRIENDLY: 'Pet Friendly',
  NIGHT_OWL: 'Night Owl',
  EARLY_BIRD: 'Early Bird',
};

function mapUserLifestyleTagsToSeeker(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const t of arr) {
    const m = USER_ENUM_TO_SEEKER_TAG[t];
    if (m && ALLOWED_TAGS.has(m)) out.push(m);
  }
  return [...new Set(out)];
}

function occupationFromProfessionalType(pt) {
  const m = {
    student: 'Student',
    work_professional: 'Working professional',
    freelancer: 'Freelancer',
    business: 'Business',
    other: 'Other',
  };
  return m[pt] || 'Seeking a roommate';
}

function displayRoleFromUser(user) {
  if (user.professionalType === 'student') return 'Student';
  if (
    Array.isArray(user.lifestyleTags) &&
    user.lifestyleTags.includes('VEGETARIAN') &&
    !user.lifestyleTags.includes('NON_VEG')
  ) {
    return 'Veg Only';
  }
  return 'Working';
}

/** Public roommate row from `User` where `role === roommate` (no TenantRoommateProfile). */
function toPublicShapeFromUser(userDoc, { matchPercent = 82 } = {}) {
  const uid = userDoc._id.toString();
  let tags = mapUserLifestyleTagsToSeeker(userDoc.lifestyleTags);
  if (!tags.length) tags = ['Working'];
  const role = displayRoleFromUser(userDoc);
  const life =
    userDoc.lifestyle && typeof userDoc.lifestyle === 'object' && !Array.isArray(userDoc.lifestyle)
      ? userDoc.lifestyle
      : null;
  return {
    id: uid,
    profileId: null,
    userId: uid,
    listingSource: 'user_account',
    displayName: userDoc.fullName,
    name: userDoc.fullName,
    occupation: occupationFromProfessionalType(userDoc.professionalType),
    professionalType: userDoc.professionalType != null ? String(userDoc.professionalType) : undefined,
    location: typeof userDoc.location === 'string' && userDoc.location.trim() ? userDoc.location.trim() : undefined,
    monthlyBudget: typeof userDoc.monthlyBudget === 'number' ? userDoc.monthlyBudget : undefined,
    budget: typeof userDoc.monthlyBudget === 'number' ? userDoc.monthlyBudget : undefined,
    moveInDate: isoMaybe(userDoc.moveInDate),
    bio:
      typeof userDoc.bio === 'string' && userDoc.bio.trim().length >= 3
        ? userDoc.bio.trim()
        : 'Looking for a roommate.',
    lifestyleTags: tags,
    tags,
    displayRole: role,
    role,
    age: typeof userDoc.age === 'number' && Number.isFinite(userDoc.age) ? userDoc.age : undefined,
    gender: typeof userDoc.gender === 'string' ? userDoc.gender : undefined,
    roommateGenderPreference:
      typeof userDoc.roommateGenderPreference === 'string' ? userDoc.roommateGenderPreference : undefined,
    lifestyleSnippet: life
      ? {
          diet: life.diet,
          smoking: life.smoking,
          maritalStatus: life.maritalStatus,
        }
      : undefined,
    avatarUrl:
      typeof userDoc.profileImageUrl === 'string' && userDoc.profileImageUrl.trim()
        ? userDoc.profileImageUrl.trim()
        : undefined,
    avatarInitial: initialsFromName(userDoc.fullName),
    matchPercent,
    isConnected: false,
    accountFullName: typeof userDoc.fullName === 'string' ? userDoc.fullName.trim() : undefined,
    accountRole: userDoc.role != null ? String(userDoc.role) : undefined,
    email: typeof userDoc.email === 'string' ? userDoc.email.trim() : undefined,
    mobile: typeof userDoc.mobile === 'string' ? userDoc.mobile.trim() : undefined,
    createdAt: isoMaybe(userDoc.createdAt),
    updatedAt: isoMaybe(userDoc.updatedAt),
  };
}

function listItemMatchesFilters(item, { search, tags, tagsMatch, budgetCenter }) {
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    const blob = [item.name, item.displayName, item.occupation, item.location, item.bio, item.email, item.mobile]
      .filter((x) => x != null && String(x).trim())
      .join('\n');
    if (!re.test(blob)) return false;
  }
  if (tags.length > 0) {
    const itemTags = Array.isArray(item.tags) ? item.tags : [];
    if (tagsMatch === 'any') {
      if (!tags.some((t) => itemTags.includes(t))) return false;
    } else if (!tags.every((t) => itemTags.includes(t))) return false;
  }
  if (budgetCenter != null) {
    const b = item.monthlyBudget ?? item.budget;
    if (typeof b !== 'number' || !Number.isFinite(b)) return false;
    const low = Math.max(1000, Math.floor(budgetCenter * 0.55));
    const high = Math.min(500000, Math.ceil(budgetCenter * 1.45));
    if (b < low || b > high) return false;
  }
  return true;
}

function bumpMatchPercent(item, tags, tagsMatch, budgetCenter) {
  let matchPercent = item.matchPercent ?? 82;
  if (tags.length > 0 && Array.isArray(item.tags)) {
    const hit = tags.filter((t) => item.tags.includes(t)).length;
    if (tagsMatch === 'any') {
      matchPercent = Math.min(95, 50 + Math.round((hit / Math.max(tags.length, 1)) * 45));
    } else {
      matchPercent = Math.min(95, 60 + Math.round((hit / tags.length) * 35));
    }
  }
  if (budgetCenter != null && typeof item.monthlyBudget === 'number') {
    const diff = Math.abs(item.monthlyBudget - budgetCenter) / Math.max(budgetCenter, 1);
    const bump = Math.max(0, Math.round((1 - Math.min(diff, 1)) * 8));
    matchPercent = Math.min(98, matchPercent + bump);
  }
  return { ...item, matchPercent };
}

exports.list = catchAsync(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tags = parseTagsParam(req.query.tags);
  const tagsMatch = req.query.tagsMatch === 'any' ? 'any' : 'all';
  const budgetParam = req.query.budget;
  let budgetCenter = null;
  if (budgetParam !== undefined && budgetParam !== '' && budgetParam != null) {
    const n = Number(budgetParam);
    if (Number.isFinite(n) && n > 0) budgetCenter = n;
  }

  const userFilter = {
    role: USER_ROLES.ROOMMATE,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };

  const userDocs = await User.find(userFilter)
    .select(
      'fullName email mobile role profileImageUrl location monthlyBudget moveInDate bio lifestyleTags lifestyle professionalType roommateGenderPreference age gender isActive createdAt updatedAt',
    )
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  const filterCtx = { search, tags, tagsMatch, budgetCenter };
  const items = userDocs
    .map((u) => toPublicShapeFromUser(u))
    .filter((item) => listItemMatchesFilters(item, filterCtx))
    .map((item) => bumpMatchPercent(item, tags, tagsMatch, budgetCenter))
    .slice(0, 200);

  res.json({ status: 'ok', data: { items } });
});

exports.getOne = catchAsync(async (req, res) => {
  const rawId = String(req.params.id || '');
  const userId = /^user-[a-fA-F0-9]{24}$/i.test(rawId) ? rawId.slice(5) : rawId;

  const userDoc = await User.findById(userId)
    .select(
      'fullName email mobile role profileImageUrl location monthlyBudget moveInDate bio lifestyleTags lifestyle professionalType roommateGenderPreference age gender isActive createdAt updatedAt',
    )
    .lean();

  if (!userDoc || userDoc.isActive === false) throw new ApiError(404, 'Profile not found');
  if (userDoc.role !== USER_ROLES.ROOMMATE) throw new ApiError(404, 'Profile not found');

  res.json({
    status: 'ok',
    data: { profile: toPublicShapeFromUser(userDoc, { matchPercent: 88 }) },
  });
});

exports.getMine = catchAsync(async (req, res) => {
  const doc = await TenantRoommateProfile.findOne({ user: req.user._id }).lean();
  if (!doc) {
    return res.json({ status: 'ok', data: { profile: null } });
  }
  res.json({
    status: 'ok',
    data: {
      profile: {
        id: doc._id.toString(),
        displayName: doc.displayName,
        occupation: doc.occupation,
        location: doc.location,
        monthlyBudget: doc.monthlyBudget,
        moveInDate:
          doc.moveInDate instanceof Date ? doc.moveInDate.toISOString().slice(0, 10) : String(doc.moveInDate).slice(0, 10),
        bio: doc.bio,
        lifestyleTags: doc.lifestyleTags,
        displayRole: doc.displayRole,
      },
    },
  });
});

exports.upsertMine = catchAsync(async (req, res) => {
  const b = req.body;
  const set = {
    displayName: b.displayName,
    occupation: b.occupation,
    location: b.location,
    monthlyBudget: b.monthlyBudget,
    moveInDate: b.moveInDate,
    bio: b.bio,
    lifestyleTags: b.lifestyleTags,
    displayRole: b.displayRole,
    isActive: true,
  };

  const doc = await TenantRoommateProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: set, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true, runValidators: true, context: 'query' },
  ).lean();

  res.json({
    status: 'ok',
    data: {
      profile: {
        id: doc._id.toString(),
        displayName: doc.displayName,
        occupation: doc.occupation,
        location: doc.location,
        monthlyBudget: doc.monthlyBudget,
        moveInDate: doc.moveInDate instanceof Date ? doc.moveInDate.toISOString().slice(0, 10) : doc.moveInDate,
        bio: doc.bio,
        lifestyleTags: doc.lifestyleTags,
        displayRole: doc.displayRole,
      },
    },
  });
});
