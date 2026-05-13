const Booking = require('../models/Booking');
const Property = require('../models/Property');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.create = catchAsync(async (req, res) => {
  const b = req.body;
  const property = await Property.findById(b.propertyId);
  if (!property) throw new ApiError(404, 'Listing not found');
  if (property.owner.equals(req.user._id)) {
    throw new ApiError(400, 'You cannot book a visit to your own listing.');
  }

  const visitDay = new Date(b.preferredDate);
  if (Number.isNaN(visitDay.getTime())) throw new ApiError(400, 'Invalid visit date');
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (visitDay < startOfToday) throw new ApiError(400, 'Visit date cannot be in the past.');

  const booking = await Booking.create({
    property: property._id,
    requester: req.user._id,
    preferredDate: visitDay,
    preferredTimeStart: b.preferredTimeStart || undefined,
    preferredTimeEnd: b.preferredTimeEnd || undefined,
    contactName: b.contactName,
    contactPhone: b.contactPhone,
    notes: b.notes,
  });

  res.status(201).json({ status: 'ok', data: { booking } });
});

/** Visit requests you made, plus requests on listings you own (newest first). */
exports.listMine = catchAsync(async (req, res) => {
  const ownProperties = await Property.find({ owner: req.user._id }).select('_id').lean();
  const ownIds = ownProperties.map((p) => p._id);

  const filter =
    ownIds.length > 0
      ? { $or: [{ requester: req.user._id }, { property: { $in: ownIds } }] }
      : { requester: req.user._id };

  const items = await Booking.find(filter)
    .populate('property', 'title coverImageUrl imageUrls address location listingType owner')
    .populate('requester', 'fullName')
    .sort({ preferredDate: -1, createdAt: -1 })
    .lean();

  const uid = String(req.user._id);
  const itemsOut = items.map((b) => {
    const ownerRaw = b.property?.owner;
    const ownerStr =
      ownerRaw != null
        ? typeof ownerRaw === 'object' && ownerRaw._id != null
          ? String(ownerRaw._id)
          : String(ownerRaw)
        : '';
    const viewerAsOwner = Boolean(ownerStr && ownerStr === uid);

    let requesterStr = '';
    if (b.requester != null) {
      requesterStr =
        typeof b.requester === 'object' && b.requester._id != null
          ? String(b.requester._id)
          : String(b.requester);
    }

    const requesterUserId = requesterStr || null;
    const propertyOwnerId = ownerStr || null;
    const chatWithUserId = viewerAsOwner ? requesterUserId : propertyOwnerId;

    return {
      ...b,
      viewerAsOwner,
      requesterUserId,
      propertyOwnerId,
      chatWithUserId,
    };
  });

  res.json({ status: 'ok', data: { items: itemsOut } });
});

exports.listForProperty = catchAsync(async (req, res) => {
  const property = await Property.findById(req.params.propertyId);
  if (!property) throw new ApiError(404, 'Listing not found');
  if (!property.owner.equals(req.user._id)) throw new ApiError(403, 'Not allowed');

  const items = await Booking.find({ property: property._id }).sort({ preferredDate: 1 });
  res.json({ status: 'ok', data: { items } });
});

exports.updateStatus = catchAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('property');
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!booking.property.owner.equals(req.user._id)) throw new ApiError(403, 'Not allowed');

  booking.status = req.body.status || booking.status;
  booking.notes = req.body.notes ?? booking.notes;
  await booking.save();

  res.json({ status: 'ok', data: { booking } });
});
