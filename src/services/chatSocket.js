/**
 * Realtime hub on HTTP server path `/ws`.
 * Clients connect with: ws://host:port/ws?token=<JWT>
 * JWT may be app user (`aud: app`) or admin dashboard (`aud: admin`) — same `sub` user id.
 *
 * Events:
 * - Chat: { type: 'message:new', payload: <ChatMessage lean> } to sender + receiver.
 * - In-app notifications: { type: 'notification:new', payload: <Notification plain> } to the recipient user.
 */
const { WebSocketServer } = require('ws');
const User = require('../models/User');
const { verifyToken, verifyAdminToken } = require('../utils/jwt');

/** @type {import('ws').WebSocketServer | null} */
let wss = null;

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const socketsByUserId = new Map();

function addSocket(userId, ws) {
  const id = String(userId);
  if (!socketsByUserId.has(id)) socketsByUserId.set(id, new Set());
  socketsByUserId.get(id).add(ws);
  // eslint-disable-next-line no-param-reassign
  ws._roommatUserId = id;
}

function removeSocket(ws) {
  const id = ws._roommatUserId;
  if (!id) return;
  const set = socketsByUserId.get(id);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) socketsByUserId.delete(id);
}

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcastToUser(userId, obj) {
  const set = socketsByUserId.get(String(userId));
  if (!set) return;
  const raw = JSON.stringify(obj);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
}

/** Plain shape for clients (matches REST list items). */
function notificationToWire(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!o || !o._id) return null;
  return {
    _id: String(o._id),
    title: o.title,
    description: o.description,
    type: o.type,
    payload: o.payload,
    isRead: Boolean(o.isRead),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
  };
}

/**
 * Push a newly persisted in-app notification to every open tab for that user (admin or app JWT).
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {object} notificationDoc - Mongoose doc or plain
 */
function broadcastNotificationNew(userId, notificationDoc) {
  const payload = notificationToWire(notificationDoc);
  if (!payload) return;
  broadcastToUser(String(userId), { type: 'notification:new', payload });
}

/**
 * Push a newly persisted message to every tab of sender + receiver.
 * @param {object} messageLean - Mongoose doc or plain object with sender, receiver, message, _id, createdAt, readAt
 */
function broadcastNewMessage(messageLean) {
  if (!messageLean) return;
  const senderId = String(messageLean.sender);
  const receiverId = String(messageLean.receiver);
  const envelope = { type: 'message:new', payload: messageLean };
  broadcastToUser(senderId, envelope);
  broadcastToUser(receiverId, envelope);
}

/**
 * @param {import('http').Server} httpServer
 */
function initChatSocket(httpServer) {
  if (wss) return;

  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    (async () => {
      try {
        const host = req.headers.host || 'localhost';
        const url = new URL(req.url || '/', `http://${host}`);
        const token = url.searchParams.get('token');
        if (!token) {
          ws.close(4001, 'auth required');
          return;
        }

        let decoded;
        try {
          decoded = verifyAdminToken(token);
        } catch {
          try {
            decoded = verifyToken(token);
          } catch {
            ws.close(4002, 'invalid token');
            return;
          }
        }

        const user = await User.findById(decoded.sub).select('_id isActive').lean();
        if (!user || !user.isActive) {
          ws.close(4003, 'user not found');
          return;
        }

        addSocket(user._id, ws);

        ws.on('close', () => removeSocket(ws));
        ws.on('error', () => removeSocket(ws));

        // Forward typing signals to the other party (optional UX)
        ws.on('message', (buf) => {
          let parsed;
          try {
            parsed = JSON.parse(String(buf));
          } catch {
            return;
          }
          const event = parsed && typeof parsed.event === 'string' ? parsed.event : '';
          const payload = parsed && parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {};
          const chatId = payload.chatId != null ? String(payload.chatId) : '';
          if (!chatId || chatId === String(user._id)) return;

          if (event === 'typing:start' || event === 'typing:stop') {
            const type = event === 'typing:start' ? 'typing:start' : 'typing:stop';
            broadcastToUser(chatId, { type, payload: { chatId: String(user._id) } });
          }
        });

        sendJson(ws, { type: 'connected', payload: { userId: String(user._id) } });
      } catch {
        try {
          ws.close(1011, 'server error');
        } catch {
          /* ignore */
        }
      }
    })();
  });
}

module.exports = { initChatSocket, broadcastNewMessage, broadcastNotificationNew };
