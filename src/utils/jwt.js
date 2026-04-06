const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { JWT_AUDIENCE } = require('../constants/roles');

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    audience: JWT_AUDIENCE.APP,
  });
}

function signAdminToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ADMIN_EXPIRES_IN,
    audience: JWT_AUDIENCE.ADMIN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { audience: JWT_AUDIENCE.APP });
}

function verifyAdminToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { audience: JWT_AUDIENCE.ADMIN });
}

module.exports = { signToken, signAdminToken, verifyToken, verifyAdminToken };
