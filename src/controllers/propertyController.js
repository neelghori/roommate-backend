const mongoose = require('mongoose');
const Property = require('../models/Property');
const SavedProperty = require('../models/SavedProperty');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constants/roles');
const { notifyStaffNewPropertyListing } = require('../services/propertyNotifications');

/** `roommate_seeker` listings align with app role `roommate`; other roles use PG/flat/etc. */
function assertListingTypeAllowedForUser(user, listingType) {
  if (!listingType) return;
  const isRoommateSeeker = listingType === 'roommate_seeker';
  const role = user.role;
  if (isRoommateSeeker && role !== USER_ROLES.ROOMMATE) {
    throw new ApiError(403, 'Only roommate-seeker accounts can create this listing type.');
  }
  if (!isRoommateSeeker && role === USER_ROLES.ROOMMATE) {
    throw new ApiError(403, 'Roommate seekers can only create roommate-seeker listings.');
  }
}

/** Move single `listerSnapshot` into `listerSnapshots[]` so new APIs apply. */
function migrateLegacyListerSnapshot(doc) {
  if (doc.listerSnapshots?.length) return false;
  if (!doc.listerSnapshot) return false;
  const leg = doc.listerSnapshot.toObject ? doc.listerSnapshot.toObject() : { ...doc.listerSnapshot };
  const keys = Object.keys(leg).filter((k) => leg[k] != null && leg[k] !== '');
  if (!keys.length) return false;
  doc.listerSnapshots = [];
  doc.listerSnapshots.push(leg);
  doc.set('listerSnapshot', undefined);
  return true;
}

/** Legacy rows may lack subdoc `_id`; assign so PATCH/DELETE can target them. */
function ensureListerSnapshotSubdocIds(doc) {
  const arr = doc.listerSnapshots;
  if (!Array.isArray(arr) || arr.length === 0) return false;
  let changed = false;
  for (const el of arr) {
    if (el && !el._id) {
      el._id = new mongoose.Types.ObjectId();
      changed = true;
    }
  }
  return changed;
}

function bumpModerationIfNeeded(doc) {
  if (doc.isModified() && doc.moderationStatus === 'approved' && doc.isPublished) {
    doc.moderationStatus = 'pending';
    doc.isPublished = false;
    doc.rejectionReason = undefined;
  }
}

async function respondWithPopulatedProperty(docId) {
  const populated = await Property.findById(docId)
    .populate('owner', 'fullName profileImageUrl role professionalType email mobile')
    .populate('amenityIds');
  return populated;
}

/** Public browse: everything except rejected, on hold, and unpublished approved. */
function isPublicListed(doc) {
  if (!doc) return false;
  const ms = doc.moderationStatus;
  if (ms === 'rejected' || ms === 'on_hold') return false;
  if (ms === 'approved' && !doc.isPublished) return false;
  return true;
}

function publicListingFilter() {
  return {
    $nor: [
      { moderationStatus: 'rejected' },
      { moderationStatus: 'on_hold' },
      { $and: [{ moderationStatus: 'approved' }, { isPublished: false }] },
    ],
  };
}

/** WGS84 mean Earth radius in meters (Mongo `$centerSphere` uses radians). */
const EARTH_RADIUS_METERS = 6378100;

/**
 * Parse `lat` / `lng` / `radiusKm` from query. Returns null if geo should be skipped.
 * Uses `$geoWithin` + `$centerSphere` (not `$near`) so `find` + `countDocuments` work on current MongoDB.
 */
function parseListGeoQuery(req) {
  if (req.query.lng == null || req.query.lat == null) return null;
  const lng = Number(req.query.lng);
  const lat = Number(req.query.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new ApiError(400, 'Invalid geo query: latitude and longitude must be valid numbers.');
  }
  if (lat < -90 || lat > 90) {
    throw new ApiError(400, 'Invalid latitude: must be between -90 and 90.');
  }
  if (lng < -180 || lng > 180) {
    throw new ApiError(400, 'Invalid longitude: must be between -180 and 180.');
  }
  const radiusKm = Number(req.query.radiusKm);
  const maxKm = Math.min(100, Math.max(0.5, Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 10));
  const radiusMeters = maxKm * 1000;
  const radiusRadians = radiusMeters / EARTH_RADIUS_METERS;
  return { lng, lat, radiusRadians };
}

function geoWithinLocationFilter(lng, lat, radiusRadians) {
  return {
    $geoWithin: {
      $centerSphere: [[lng, lat], radiusRadians],
    },
  };
}

exports.list = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = publicListingFilter();
  if (req.query.listingType) filter.listingType = req.query.listingType;
  if (req.query.city) filter['address.city'] = new RegExp(req.query.city, 'i');
  if (req.query.minRent != null) filter['rentRange.min'] = { $gte: Number(req.query.minRent) };

  let query = Property.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('owner', 'fullName profileImageUrl role')
    .populate('amenityIds', 'name slug');

  let countFilter = filter;

  const geo = parseListGeoQuery(req);
  if (geo) {
    const { lng, lat, radiusRadians } = geo;
    const geoFilter = {
      ...filter,
      location: geoWithinLocationFilter(lng, lat, radiusRadians),
    };
    countFilter = geoFilter;

    query = Property.find(geoFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('owner', 'fullName profileImageUrl role')
      .populate('amenityIds', 'name slug');
  }

  const [items, total] = await Promise.all([query.lean(), Property.countDocuments(countFilter)]);

  let savedIds = new Set();
  if (req.user?._id) {
    const rows = await SavedProperty.find({ user: req.user._id }).select('property').lean();
    savedIds = new Set(rows.map((r) => String(r.property)));
  }
  const itemsOut = items.map((p) => ({
    ...p,
    isSaved: savedIds.has(String(p._id)),
  }));

  res.json({
    status: 'ok',
    data: { items: itemsOut, page, limit, total },
  });
});

exports.getOne = catchAsync(async (req, res) => {
  let doc = await Property.findById(req.params.id)
    .populate('owner', 'fullName profileImageUrl role professionalType email mobile')
    .populate('amenityIds');
  if (!doc) throw new ApiError(404, 'Listing not found');

  const uid = req.user?._id?.toString();
  const ownerId = doc.owner?._id?.toString?.() ?? doc.owner?.toString?.();
  const isOwner = Boolean(uid && ownerId && uid === ownerId);

  if (!isPublicListed(doc)) {
    if (!isOwner) throw new ApiError(404, 'Listing not found');
  }

  /** One-time shape fix: legacy `listerSnapshot` → `listerSnapshots` + subdoc `_id`s (owner only). */
  if (isOwner) {
    const didMigrate = migrateLegacyListerSnapshot(doc);
    const didEnsure = ensureListerSnapshotSubdocIds(doc);
    if (didMigrate || didEnsure) {
      doc.markModified('listerSnapshots');
      doc.set('listerSnapshot', undefined);
      await doc.save({ validateBeforeSave: true });
      doc = await Property.findById(doc._id)
        .populate('owner', 'fullName profileImageUrl role professionalType email mobile')
        .populate('amenityIds');
    }
  }

  let isSaved = false;
  if (req.user?._id) {
    isSaved = Boolean(await SavedProperty.exists({ user: req.user._id, property: doc._id }));
  }
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  plain.isSaved = isSaved;

  res.json({ status: 'ok', data: { property: plain } });
});

exports.create = catchAsync(async (req, res) => {
  const b = req.body;
  assertListingTypeAllowedForUser(req.user, b.listingType);
  const min = b.rentRange?.min;
  const max = b.rentRange?.max != null ? b.rentRange.max : min;
  const doc = await Property.create({
    owner: req.user._id,
    title: b.title,
    rentRange: { min, max },
    currency: b.currency || 'INR',
    listingType: b.listingType,
    coverImageUrl: b.coverImageUrl,
    imageUrls: b.imageUrls,
    offerText: b.offerText,
    location: b.location,
    address: b.address,
    genderPreference: b.genderPreference,
    peopleTypes: Array.isArray(b.peopleTypes) ? [...new Set(b.peopleTypes.filter(Boolean))] : [],
    description: b.description,
    websiteUrl: b.websiteUrl,
    socialLinks: b.socialLinks,
    contactPhone: b.contactPhone,
    verificationBadge: b.verificationBadge || 'none',
    amenityIds: b.amenityIds || [],
    listerSnapshot: b.listerSnapshot,
    listerSnapshots: b.listerSnapshots,
    availableSpots: b.availableSpots,
    isPublished: true,
    moderationStatus: 'pending',
    rejectionReason: undefined,
  });

  notifyStaffNewPropertyListing(doc).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[propertyController.create] notifyStaffNewPropertyListing:', err?.message || err);
  });

  const populatedCreate = await respondWithPopulatedProperty(doc._id);
  res.status(201).json({
    status: 'ok',
    message: 'Your listing is live. Staff may mark it verified after review.',
    data: { property: populatedCreate },
  });
});

exports.update = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only edit your own listings');

  const body = { ...req.body };
  delete body.isPublished;
  delete body.moderationStatus;
  delete body.rejectionReason;
  delete body.owner;
  delete body.savedCount;

  const effectiveListingType = body.listingType !== undefined ? body.listingType : doc.listingType;
  assertListingTypeAllowedForUser(req.user, effectiveListingType);

  Object.assign(doc, body);
  if (Array.isArray(req.body.listerSnapshots)) {
    doc.set('listerSnapshot', undefined);
  }
  if (doc.isModified() && doc.moderationStatus === 'approved' && doc.isPublished) {
    doc.moderationStatus = 'pending';
    doc.isPublished = false;
    doc.rejectionReason = undefined;
  }
  await doc.save();

  const populatedUpdate = await respondWithPopulatedProperty(doc._id);
  res.json({ status: 'ok', data: { property: populatedUpdate } });
});

/** POST — append one resident (does not re-send existing rows). */
exports.addListerResident = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only edit your own listings');

  if (migrateLegacyListerSnapshot(doc)) doc.markModified('listerSnapshots');

  const bodyKeys = Object.keys(req.body || {}).filter((k) => req.body[k] !== undefined && req.body[k] !== null);
  if (bodyKeys.length === 0) throw new ApiError(400, 'Provide at least one field for the new resident.');

  if (!Array.isArray(doc.listerSnapshots)) doc.listerSnapshots = [];
  if (ensureListerSnapshotSubdocIds(doc)) doc.markModified('listerSnapshots');

  if (doc.listerSnapshots.length >= 20) throw new ApiError(400, 'Maximum 20 residents per listing.');

  const row = { ...req.body };
  delete row._id;
  row.roomPhotoUrls = [];
  row.propertyOrPgName = String(doc.title || '').trim().slice(0, 200);

  doc.listerSnapshots.push(row);
  doc.set('listerSnapshot', undefined);

  bumpModerationIfNeeded(doc);
  await doc.save();

  const populated = await respondWithPopulatedProperty(doc._id);
  res.json({ status: 'ok', data: { property: populated } });
});

/** PATCH — update one resident by subdocument id. */
exports.updateListerResident = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only edit your own listings');

  if (migrateLegacyListerSnapshot(doc)) doc.markModified('listerSnapshots');

  const patchKeys = Object.keys(req.body || {}).filter((k) => req.body[k] !== undefined);
  if (patchKeys.length === 0) throw new ApiError(400, 'Provide at least one field to update.');

  if (ensureListerSnapshotSubdocIds(doc)) doc.markModified('listerSnapshots');

  const rid = req.params.residentId;
  const arr = doc.listerSnapshots || [];
  const idx = arr.findIndex((s) => s && s._id && String(s._id) === rid);
  if (idx === -1) throw new ApiError(404, 'Resident not found');
  const sub = arr[idx];

  for (const [k, v] of Object.entries(req.body)) {
    if (k === '_id' || v === undefined) continue;
    sub.set(k, v);
  }
  sub.set('roomPhotoUrls', []);
  sub.set('propertyOrPgName', String(doc.title || '').trim().slice(0, 200));

  doc.set('listerSnapshot', undefined);
  doc.markModified('listerSnapshots');

  bumpModerationIfNeeded(doc);
  await doc.save();

  const populated = await respondWithPopulatedProperty(doc._id);
  res.json({ status: 'ok', data: { property: populated } });
});

/** DELETE — remove one resident by subdocument id. */
exports.deleteListerResident = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only edit your own listings');

  if (migrateLegacyListerSnapshot(doc)) doc.markModified('listerSnapshots');

  if (ensureListerSnapshotSubdocIds(doc)) doc.markModified('listerSnapshots');

  const rid = req.params.residentId;
  const lenBefore = doc.listerSnapshots?.length || 0;
  doc.listerSnapshots = (doc.listerSnapshots || []).filter((s) => s && s._id && String(s._id) !== rid);
  if (doc.listerSnapshots.length === lenBefore) throw new ApiError(404, 'Resident not found');

  doc.markModified('listerSnapshots');
  if (!doc.listerSnapshots?.length) doc.set('listerSnapshots', undefined);
  doc.set('listerSnapshot', undefined);

  bumpModerationIfNeeded(doc);
  await doc.save();

  const populated = await respondWithPopulatedProperty(doc._id);
  res.json({ status: 'ok', data: { property: populated } });
});

exports.remove = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only delete your own listings');

  await Promise.all([doc.deleteOne(), SavedProperty.deleteMany({ property: doc._id })]);

  res.status(204).send();
});

exports.saveListing = catchAsync(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Listing not found');
  if (!isPublicListed(property)) throw new ApiError(400, 'This listing is not available to save.');

  const existing = await SavedProperty.findOne({ user: req.user._id, property: property._id });
  if (existing) {
    return res.json({ status: 'ok', data: { saved: true } });
  }

  await SavedProperty.create({ user: req.user._id, property: property._id });
  await Property.updateOne({ _id: property._id }, { $inc: { savedCount: 1 } });

  res.status(201).json({ status: 'ok', data: { saved: true } });
});

exports.unsaveListing = catchAsync(async (req, res) => {
  const deleted = await SavedProperty.findOneAndDelete({ user: req.user._id, property: req.params.id });
  if (deleted) {
    await Property.updateOne({ _id: req.params.id }, { $inc: { savedCount: -1 } });
  }
  res.json({ status: 'ok', data: { saved: false } });
});

exports.mySaved = catchAsync(async (req, res) => {
  const saved = await SavedProperty.find({ user: req.user._id })
    .populate({
      path: 'property',
      populate: [
        { path: 'owner', select: 'fullName profileImageUrl role' },
        { path: 'amenityIds', select: 'name slug' },
      ],
    })
    .sort({ updatedAt: -1 });
  res.json({ status: 'ok', data: { items: saved } });
});

exports.myListings = catchAsync(async (req, res) => {
  const items = await Property.find({ owner: req.user._id })
    .sort({ createdAt: -1 })
    .populate('amenityIds', 'name slug')
    .lean();
  res.json({ status: 'ok', data: { items } });
});
