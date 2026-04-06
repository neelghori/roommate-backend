const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.listMine = catchAsync(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ status: 'ok', data: { items } });
});

exports.markRead = catchAsync(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new ApiError(404, 'Notification not found');
  n.isRead = true;
  await n.save();
  res.json({ status: 'ok', data: { notification: n } });
});

exports.create = catchAsync(async (req, res) => {
  const b = req.body;
  const doc = await Notification.create({
    user: b.userId,
    title: b.title,
    description: b.description,
    type: b.type,
    payload: b.payload,
  });
  res.status(201).json({ status: 'ok', data: { notification: doc } });
});
