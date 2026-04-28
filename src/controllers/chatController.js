const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { broadcastNewMessage } = require('../services/chatSocket');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.send = catchAsync(async (req, res) => {
  const { receiverId, message } = req.body;
  const me = String(req.user._id);
  if (receiverId === me) throw new ApiError(400, 'Cannot message yourself');

  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, 'Receiver not found');

  const doc = await ChatMessage.create({
    sender: req.user._id,
    receiver: receiver._id,
    message,
  });

  const senderName = (req.user.fullName && String(req.user.fullName).trim()) || 'Someone';
  try {
    await Notification.create({
      user: receiver._id,
      title: `New message from ${senderName}`,
      description: String(message).slice(0, 200),
      type: 'message',
      payload: { senderId: me, messageId: String(doc._id) },
    });
  } catch {
    /* non-fatal */
  }

  try {
    const lean = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    broadcastNewMessage(lean);
  } catch {
    /* non-fatal — REST response still succeeds */
  }

  res.status(201).json({ status: 'ok', data: { message: doc } });
});

/** Inbox: one row per other user, sorted by latest activity. */
exports.conversations = catchAsync(async (req, res) => {
  const me = req.user._id;
  const meStr = String(me);

  const msgs = await ChatMessage.find({ $or: [{ sender: me }, { receiver: me }] })
    .sort({ createdAt: -1 })
    .limit(2000)
    .select('sender receiver message readAt createdAt')
    .lean();

  const byOther = new Map();
  for (const m of msgs) {
    const senderStr = String(m.sender);
    const receiverStr = String(m.receiver);
    const otherStr = senderStr === meStr ? receiverStr : senderStr;
    if (!byOther.has(otherStr)) {
      byOther.set(otherStr, { otherId: otherStr, last: m, unread: 0 });
    }
    const row = byOther.get(otherStr);
    if (receiverStr === meStr && (m.readAt == null || m.readAt === undefined)) {
      row.unread += 1;
    }
  }

  const rows = [...byOther.values()].sort(
    (a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime(),
  );

  const ids = rows.map((r) => r.otherId);
  const users = await User.find({ _id: { $in: ids } }).select('fullName profileImageUrl').lean();
  const umap = new Map(users.map((u) => [String(u._id), u]));

  const items = rows.slice(0, 100).map((o) => {
    const u = umap.get(o.otherId);
    const name = (u && u.fullName && String(u.fullName).trim()) || 'User';
    const initials = name
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
    const t = o.last.createdAt;
    const lastMessageTime = t instanceof Date ? t.toISOString() : new Date(t).toISOString();
    return {
      id: o.otherId,
      participantId: o.otherId,
      participantName: name,
      participantAvatar: initials,
      lastMessage: String(o.last.message || ''),
      lastMessageTime,
      unreadCount: o.unread,
      isOnline: false,
    };
  });

  res.json({ status: 'ok', data: { items } });
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
    .limit(500)
    .lean();

  const partner = await User.findById(otherId).select('fullName profileImageUrl').lean();

  res.json({
    status: 'ok',
    data: {
      items,
      partner: partner
        ? {
            id: String(partner._id),
            fullName: partner.fullName,
            profileImageUrl: partner.profileImageUrl || undefined,
          }
        : null,
    },
  });
});

exports.markRead = catchAsync(async (req, res) => {
  await ChatMessage.updateMany(
    { sender: req.params.userId, receiver: req.user._id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  res.json({ status: 'ok' });
});
