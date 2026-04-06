require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const env = require('./config/env');

async function start() {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      /* eslint-disable no-console */
      console.log(`RoomMate API listening on port ${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    /* eslint-disable no-console */
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
