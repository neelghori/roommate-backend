const Amenity = require('../models/Amenity');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.list = catchAsync(async (req, res) => {
  const items = await Amenity.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ status: 'ok', data: { items } });
});

exports.create = catchAsync(async (req, res) => {
  const doc = await Amenity.create(req.body);
  res.status(201).json({ status: 'ok', data: { amenity: doc } });
});

exports.update = catchAsync(async (req, res) => {
  const doc = await Amenity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Amenity not found');
  res.json({ status: 'ok', data: { amenity: doc } });
});

exports.remove = catchAsync(async (req, res) => {
  const doc = await Amenity.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) throw new ApiError(404, 'Amenity not found');
  res.json({ status: 'ok', data: { amenity: doc } });
});
