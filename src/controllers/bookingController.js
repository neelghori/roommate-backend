const Booking = require('../models/Booking');
const Property = require('../models/Property');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.create = catchAsync(async (req, res) => {
  const b = req.body;
  const property = await Property.findById(b.propertyId);
  if (!property) throw new ApiError(404, 'Listing not found');

  const booking = await Booking.create({
    property: property._id,
    requester: req.user ? req.user._id : undefined,
    preferredDate: b.preferredDate,
    preferredTimeStart: b.preferredTimeStart,
    preferredTimeEnd: b.preferredTimeEnd,
    contactName: b.contactName,
    contactPhone: b.contactPhone,
    notes: b.notes,
  });

  res.status(201).json({ status: 'ok', data: { booking } });
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
