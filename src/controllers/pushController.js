const PushSubscription = require('../models/PushSubscription');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const {
  getVapidPublicKey,
  isWebPushEnabled,
  removeSubscriptionByEndpoint,
} = require('../services/webPushService');

exports.getVapidPublicKey = catchAsync(async (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    throw new ApiError(503, 'Web push is not configured on this server.');
  }
  res.json({ status: 'ok', data: { publicKey } });
});

exports.subscribe = catchAsync(async (req, res) => {
  if (!isWebPushEnabled()) {
    throw new ApiError(503, 'Web push is not configured on this server.');
  }

  const { endpoint, keys, expirationTime } = req.body;
  const exp =
    expirationTime != null && Number.isFinite(Number(expirationTime))
      ? new Date(Number(expirationTime))
      : undefined;

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: req.user._id,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      expirationTime: exp,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 512) || undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json({ status: 'ok', message: 'Push subscription saved.' });
});

exports.unsubscribe = catchAsync(async (req, res) => {
  const { endpoint } = req.body;
  const doc = await PushSubscription.findOne({ endpoint, user: req.user._id });
  if (doc) await doc.deleteOne();
  else await removeSubscriptionByEndpoint(endpoint);
  res.json({ status: 'ok', message: 'Push subscription removed.' });
});
