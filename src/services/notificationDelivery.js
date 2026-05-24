const { broadcastNotificationNew, isUserConnectedViaWebSocket } = require('./chatSocket');
const { sendWebPushForNotification } = require('./webPushService');

/**
 * Realtime in-app (WebSocket) + Web Push when the user has no active WS tab.
 * Chat messages always attempt Web Push so alerts work when the tab is closed or in the background.
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {object} notificationDoc - persisted Notification document
 */
async function deliverNotification(userId, notificationDoc) {
  broadcastNotificationNew(userId, notificationDoc);

  const plain =
    notificationDoc && typeof notificationDoc.toObject === 'function'
      ? notificationDoc.toObject()
      : notificationDoc;
  const isMessage = plain?.type === 'message';
  const wsConnected = isUserConnectedViaWebSocket(userId);

  if (!isMessage && wsConnected) return;

  try {
    await sendWebPushForNotification(userId, notificationDoc);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notificationDelivery] web push failed:', err?.message || err);
  }
}

module.exports = { deliverNotification };
