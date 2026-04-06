const Property = require('../models/Property');
const SavedProperty = require('../models/SavedProperty');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.list = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { isPublished: true };
  if (req.query.listingType) filter.listingType = req.query.listingType;
  if (req.query.city) filter['address.city'] = new RegExp(req.query.city, 'i');
  if (req.query.minRent != null) filter['rentRange.min'] = { $gte: Number(req.query.minRent) };

  let query = Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('owner', 'fullName profileImageUrl role');

  if (req.query.lng != null && req.query.lat != null) {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    const maxKm = Math.min(100, Number(req.query.radiusKm) || 10);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new ApiError(400, 'Invalid geo query');

    query = Property.find({
      ...filter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxKm * 1000,
        },
      },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('owner', 'fullName profileImageUrl role');
  }

  const [items, total] = await Promise.all([query.lean(), Property.countDocuments(filter)]);

  res.json({
    status: 'ok',
    data: { items, page, limit, total },
  });
});

exports.getOne = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id).populate('owner', 'fullName profileImageUrl role professionalType').populate('amenityIds');
  if (!doc) throw new ApiError(404, 'Listing not found');
  res.json({ status: 'ok', data: { property: doc } });
});

exports.create = catchAsync(async (req, res) => {
  const b = req.body;
  const doc = await Property.create({
    owner: req.user._id,
    title: b.title,
    rentRange: b.rentRange,
    currency: b.currency,
    listingType: b.listingType,
    coverImageUrl: b.coverImageUrl,
    imageUrls: b.imageUrls,
    offerText: b.offerText,
    location: b.location,
    address: b.address,
    genderPreference: b.genderPreference,
    description: b.description,
    websiteUrl: b.websiteUrl,
    socialLinks: b.socialLinks,
    contactPhone: b.contactPhone,
    verificationBadge: b.verificationBadge,
    amenityIds: b.amenityIds,
    listerSnapshot: b.listerSnapshot,
    isPublished: b.isPublished,
  });

  res.status(201).json({ status: 'ok', data: { property: doc } });
});

exports.update = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(req.user._id)) throw new ApiError(403, 'You can only edit your own listings');

  Object.assign(doc, req.body);
  await doc.save();

  res.json({ status: 'ok', data: { property: doc } });
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
  const saved = await SavedProperty.find({ user: req.user._id }).populate('property').sort({ updatedAt: -1 });
  res.json({ status: 'ok', data: { items: saved } });
});

exports.myListings = catchAsync(async (req, res) => {
  const items = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ status: 'ok', data: { items } });
});
