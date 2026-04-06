const crypto = require('crypto');

function hashPasswordResetToken(plainToken) {
  return crypto.createHash('sha256').update(plainToken, 'utf8').digest('hex');
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPasswordResetToken, generatePasswordResetToken };
