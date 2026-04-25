const TenantRoommateProfile = require('../models/TenantRoommateProfile');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

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

function toPublicShape(doc, { matchPercent = 85 } = {}) {
  if (!doc) return null;
  const id = doc._id.toString();
  const userId = doc.user?._id?.toString?.() ?? doc.user?.toString?.() ?? '';
  return {
    id,
    userId,
    name: doc.displayName,
    avatarInitial: initialsFromName(doc.displayName),
    matchPercent,
    tags: doc.lifestyleTags || [],
    role: doc.displayRole,
    isConnected: false,
    location: doc.location,
    budget: doc.monthlyBudget,
    moveInDate: doc.moveInDate instanceof Date ? doc.moveInDate.toISOString() : doc.moveInDate,
    bio: doc.bio,
    occupation: doc.occupation,
  };
}

exports.list = catchAsync(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tags = parseTagsParam(req.query.tags);

  const filter = { isActive: true };
  if (req.user?._id) {
    filter.user = { $ne: req.user._id };
  }

  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ displayName: re }, { occupation: re }, { location: re }, { bio: re }];
  }
  if (tags.length > 0) {
    filter.lifestyleTags = { $all: tags };
  }

  const docs = await TenantRoommateProfile.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate('user', 'fullName profileImageUrl role')
    .lean();

  const items = docs.map((d) => {
    let matchPercent = 85;
    if (tags.length > 0 && Array.isArray(d.lifestyleTags)) {
      const hit = tags.filter((t) => d.lifestyleTags.includes(t)).length;
      matchPercent = Math.min(95, 60 + Math.round((hit / tags.length) * 35));
    }
    return toPublicShape(d, { matchPercent });
  });

  res.json({ status: 'ok', data: { items } });
});

exports.getOne = catchAsync(async (req, res) => {
  const doc = await TenantRoommateProfile.findOne({
    _id: req.params.id,
    isActive: true,
  })
    .populate('user', 'fullName profileImageUrl role')
    .lean();

  if (!doc) throw new ApiError(404, 'Profile not found');

  res.json({
    status: 'ok',
    data: { profile: toPublicShape(doc, { matchPercent: 88 }) },
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
