const Faq = require('../models/Faq');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.listPublic = catchAsync(async (req, res) => {
  const items = await Faq.find({ isPublished: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ status: 'ok', data: { items } });
});

exports.create = catchAsync(async (req, res) => {
  const doc = await Faq.create(req.body);
  res.status(201).json({ status: 'ok', data: { faq: doc } });
});

exports.update = catchAsync(async (req, res) => {
  const doc = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'FAQ not found');
  res.json({ status: 'ok', data: { faq: doc } });
});

exports.remove = catchAsync(async (req, res) => {
  await Faq.findByIdAndDelete(req.params.id);
  res.status(204).send();
});
