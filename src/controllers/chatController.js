const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.send = catchAsync(async (req, res) => {
  const { receiverId, message } = req.body;
  if (receiverId === req.user.id) throw new ApiError(400, 'Cannot message yourself');

  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, 'Receiver not found');

  const doc = await ChatMessage.create({
    sender: req.user._id,
    receiver: receiver._id,
    message,
  });

  res.status(201).json({ status: 'ok', data: { message: doc } });
});

exports.thread = catchAsync(async (req, res) => {
  const otherId = req.params.userId;
  const items = await ChatMessage.find({
    $or: [
      { sender: req.user._id, receiver: otherId },
      { sender: otherId, receiver: req.user._id },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(500);

  res.json({ status: 'ok', data: { items } });
});

exports.markRead = catchAsync(async (req, res) => {
  await ChatMessage.updateMany(
    { sender: req.params.userId, receiver: req.user._id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  res.json({ status: 'ok' });
});
