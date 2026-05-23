const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(5000),
  MONGODB_URI: Joi.string().trim().min(1).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ADMIN_EXPIRES_IN: Joi.string().default('1d'),
  CORS_ORIGIN: Joi.string().allow('*', '').default('*'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),
  RESEND_API_KEY: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.string().trim().allow('').default(''),
  /** Optional absolute URL to logo image for transactional emails (https://…). */
  EMAIL_LOGO_URL: Joi.string().trim().allow('').max(2048).default(''),
  /** Public website origin for signup email verification links, e.g. https://app.roommat.com */
  APP_PUBLIC_FRONTEND_URL: Joi.string().trim().allow('').default(''),
  ADMIN_PASSWORD_RESET_BASE_URL: Joi.string().trim().allow('').default(''),
  PASSWORD_RESET_EXPIRES_MINUTES: Joi.number().integer().min(5).max(1440).default(60),
  EMAIL_VERIFICATION_EXPIRES_HOURS: Joi.number().integer().min(1).max(168).default(48),
  /** S3 image uploads — bucket + region required when using /api/v1/upload/* */
  AWS_REGION: Joi.string().trim().allow('').default(''),
  AWS_S3_BUCKET: Joi.string().trim().allow('').default(''),
  AWS_ACCESS_KEY_ID: Joi.string().trim().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().trim().allow('').default(''),
  /** Optional CDN or path-style origin, e.g. https://d111111abcdef8.cloudfront.net (no trailing slash) */
  AWS_S3_PUBLIC_BASE_URL: Joi.string().trim().allow('').max(500).default(''),
  /** Google OAuth client ID (Web) — same value as website NEXT_PUBLIC_GOOGLE_CLIENT_ID */
  GOOGLE_CLIENT_ID: Joi.string().trim().allow('').default(''),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const msg = error.details.map((d) => d.message).join('; ');
  throw new Error(`Environment validation failed: ${msg}`);
}

module.exports = value;
