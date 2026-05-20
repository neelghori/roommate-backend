const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { MAX_PROPERTY_IMAGE_BYTES } = require('../constants/uploads');

const MAX_IMAGE_MB = Math.round(MAX_PROPERTY_IMAGE_BYTES / (1024 * 1024));

const GENERIC_500 = 'Something went wrong. Please try again later.';
const GENERIC_400_BODY = 'Invalid request body.';

function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let message = GENERIC_500;

  if (err instanceof ApiError) {
    statusCode = err.statusCode || 500;
    if (err.isOperational && statusCode !== 500) {
      message = err.message;
    } else {
      message = GENERIC_500;
    }
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Invalid input. Please check your data and try again.';
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = 'Invalid identifier or data format.';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'This record already exists or conflicts with existing data.';
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = GENERIC_400_BODY;
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = GENERIC_400_BODY;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Each file must be ${MAX_IMAGE_MB} MB or smaller.`
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files in this upload.'
          : err.message || 'Upload failed.';
  } else if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500 && err.message) {
    statusCode = err.statusCode;
    message = err.message;
  }

  if (statusCode === 500) {
    message = GENERIC_500;
  }

  if (statusCode >= 500) {
    /* eslint-disable no-console */
    console.error('[API]', req.method, req.originalUrl, err);
  } else if (env.NODE_ENV === 'development') {
    /* eslint-disable no-console */
    console.error('[API]', req.method, req.originalUrl, err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(statusCode === 413
      ? {
          hint:
            'Request body exceeds reverse-proxy limit. Set nginx client_max_body_size to at least 64m (see deploy/nginx-api-uploads.conf).',
        }
      : {}),
  });
}

module.exports = errorHandler;
