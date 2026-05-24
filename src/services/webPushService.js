const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const env = require('../config/env');

let configured = false;

function frontendBaseUrl() {
  let u = (env.APP_PUBLIC_FRONTEND_URL || '').trim();
  if (!u && env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
    const origins = String(env.CORS_ORIGIN)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    u = origins[0] || '';
  }
  if (!u || u === '*') return '';
  return u.replace(/\/$/, '');
}

function adminPanelBaseUrl() {
  let u = (env.ADMIN_PUBLIC_FRONTEND_URL || '').trim();
  if (!u && env.ADMIN_PASSWORD_RESET_BASE_URL) {
    try {
      u = new URL(env.ADMIN_PASSWORD_RESET_BASE_URL.trim()).origin;
    } catch {
      u = '';
    }
  }
  if (!u && env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
    const origins = String(env.CORS_ORIGIN)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const adminOrigin = origins.find((o) => /admin|3001/i.test(o));
    if (adminOrigin) u = adminOrigin;
  }
  if (!u || u === '*') return '';
  return u.replace(/\/$/, '');
}

function ensureWebPushConfigured() {
  if (configured) return true;
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || env.EMAIL_FROM || 'mailto:support@roommat.in').trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function isWebPushEnabled() {
  return Boolean((env.VAPID_PUBLIC_KEY || '').trim() && (env.VAPID_PRIVATE_KEY || '').trim());
}

function getVapidPublicKey() {
  return (env.VAPID_PUBLIC_KEY || '').trim();
}

function notificationUrl(doc) {
  const payload = doc?.payload && typeof doc.payload === 'object' ? doc.payload : {};
  const kind = payload.kind;
  const propertyId = payload.propertyId != null ? String(payload.propertyId) : '';
  const senderId = payload.senderId != null ? String(payload.senderId) : '';

  if (doc?.type === 'listing' && propertyId && kind === 'new_listing_pending') {
    const base = adminPanelBaseUrl() || frontendBaseUrl();
    const path = `/dashboard/properties/${propertyId}`;
    return base ? `${base}${path}` : path;
  }

  const base = frontendBaseUrl();
  let path = '/notifications';
  if (doc?.type === 'message' && senderId) path = `/chat/${senderId}`;
  else if (doc?.type === 'listing' && propertyId) path = `/listings/${propertyId}`;

  return base ? `${base}${path}` : path;
}

function pushIconUrl(doc) {
  const payload = doc?.payload && typeof doc.payload === 'object' ? doc.payload : {};
  const isAdminListing =
    doc?.type === 'listing' && payload.kind === 'new_listing_pending' && payload.propertyId;
  const base = isAdminListing ? adminPanelBaseUrl() || frontendBaseUrl() : frontendBaseUrl();
  return base ? `${base}/favicon.ico` : '/favicon.ico';
}

function buildPushPayload(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const title = String(o?.title || 'Roommat').slice(0, 120);
  const body = String(o?.description || '').slice(0, 240);
  const url = notificationUrl(o);
  return {
    title,
    body,
    url,
    notificationId: o?._id != null ? String(o._id) : undefined,
    type: o?.type,
    icon: pushIconUrl(o),
  };
}

async function removeSubscriptionByEndpoint(endpoint) {
  if (!endpoint) return;
  await PushSubscription.deleteOne({ endpoint: String(endpoint).trim() });
}

/**
 * Send Web Push to all devices registered for a user (best-effort).
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {object} notificationDoc
 */
async function sendWebPushForNotification(userId, notificationDoc) {
  if (!ensureWebPushConfigured()) return;

  const subs = await PushSubscription.find({ user: userId }).lean();
  if (!subs.length) return;

  const payload = JSON.stringify(buildPushPayload(notificationDoc));

  await Promise.all(
    subs.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };
      try {
        await webpush.sendNotification(pushSub, payload);
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await removeSubscriptionByEndpoint(sub.endpoint);
        } else {
          // eslint-disable-next-line no-console
          console.error('[webPushService] send failed:', status || err?.message || err);
        }
      }
    }),
  );
}

module.exports = {
  isWebPushEnabled,
  getVapidPublicKey,
  sendWebPushForNotification,
  removeSubscriptionByEndpoint,
};
