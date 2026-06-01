require('dotenv').config();
const http = require('http');
const connectDB = require('./config/db');
const app = require('./app');
const env = require('./config/env');
const { initChatSocket } = require('./services/chatSocket');

async function start() {
  try {
    await connectDB();
    const server = http.createServer(app);
    initChatSocket(server);
    server.listen(env.PORT, () => {
      /* eslint-disable no-console */
      console.log(`Roommat API listening on port ${env.PORT} (${env.NODE_ENV})`);
      console.log(`WebSocket (chat + notifications): ws://localhost:${env.PORT}/ws?token=<app-or-admin-JWT>`);
    });
  } catch (err) {
    /* eslint-disable no-console */
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
