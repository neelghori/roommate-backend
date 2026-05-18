const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { verifyToken, verifyAdminToken } = require('../utils/jwt');

const isDev = env.NODE_ENV === 'development';

const shouldSkip = (req) => {
  if (isDev) return true;
  if (req.method === 'OPTIONS') return true;
  if (req.path === '/api/v1/health' || req.originalUrl === '/api/v1/health') return true;
  return false;
};

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Bucket by user when a valid JWT is present; otherwise by IP (avoids shared-proxy collisions). */
const userOrIpKey = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const decoded = verifyToken(token);
      if (decoded?.sub) return `user:${decoded.sub}`;
    } catch {
      try {
        const decoded = verifyAdminToken(token);
        if (decoded?.sub) return `user:${decoded.sub}`;
      } catch {
        /* invalid token — fall through to IP */
      }
    }
  }

  if (req.user?._id) return `user:${req.user._id}`;
  if (req.user?.id) return `user:${req.user.id}`;

  return `ip:${clientIp(req)}`;
};

const ipOnlyKey = (req) => `ip:${clientIp(req)}`;

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  validate: { trustProxy: false },
};

const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 2000,
  keyGenerator: userOrIpKey,
  message: { status: 'error', message: 'Too many requests. Please try again later.' },
});

/** Login, register, verification — IP-based (no account yet). */
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 40,
  keyGenerator: ipOnlyKey,
  message: { status: 'error', message: 'Too many authentication attempts. Please try again later.' },
});

/** Mutations (create/update/delete) — per user when authenticated. */
const writeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: userOrIpKey,
  message: { status: 'error', message: 'Too many requests. Please slow down and try again.' },
});

/** File uploads — separate, moderate cap. */
const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 80,
  keyGenerator: userOrIpKey,
  message: { status: 'error', message: 'Too many uploads. Please try again later.' },
});

/** Forgot-password can trigger outbound email */
const passwordResetLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 8,
  keyGenerator: ipOnlyKey,
  message: { status: 'error', message: 'Too many password reset requests. Please try again later.' },
});

/** Authenticated password change */
const passwordChangeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 15,
  keyGenerator: userOrIpKey,
  message: { status: 'error', message: 'Too many password changes. Please try again later.' },
});

/** @deprecated Use writeLimiter — kept so existing imports keep working during rollout */
const strictLimiter = writeLimiter;

module.exports = {
  globalLimiter,
  authLimiter,
  writeLimiter,
  uploadLimiter,
  strictLimiter,
  passwordResetLimiter,
  passwordChangeLimiter,
};
