/**
 * Realtime chat — WebSocket hub on HTTP server path `/ws`.
 * Clients connect with: ws://host:port/ws?token=<JWT>
 * On new messages, both sender and receiver sockets receive { type: 'message:new', payload: <ChatMessage lean> }.
 */
const { WebSocketServer } = require('ws');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

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
          decoded = verifyToken(token);
        } catch {
          ws.close(4002, 'invalid token');
          return;
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

module.exports = { initChatSocket, broadcastNewMessage };
