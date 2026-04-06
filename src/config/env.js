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
  ADMIN_PASSWORD_RESET_BASE_URL: Joi.string().trim().allow('').default(''),
  PASSWORD_RESET_EXPIRES_MINUTES: Joi.number().integer().min(5).max(1440).default(60),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const msg = error.details.map((d) => d.message).join('; ');
  throw new Error(`Environment validation failed: ${msg}`);
}

module.exports = value;
