const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { globalLimiter } = require('./middlewares/rateLimiter');

const env = require('./config/env');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' || !env.CORS_ORIGIN ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

app.use(mongoSanitize({ replaceWith: '_' }));
app.use(hpp());
app.use(compression());

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(globalLimiter);

app.use('/api/v1', routes);

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'The requested resource was not found.' });
});

app.use(errorHandler);

module.exports = app;
