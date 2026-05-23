const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

let oauthClient;

function getClient() {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new ApiError(503, 'Google sign-in is not configured on this server.');
  }
  if (!oauthClient) oauthClient = new OAuth2Client(clientId);
  return oauthClient;
}

/**
 * Verify Google Identity Services `credential` (ID token).
 * @returns {Promise<{ googleId: string, email: string, fullName: string, profileImageUrl?: string }>}
 */
async function verifyGoogleIdToken(idToken) {
  const client = getClient();
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch {
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }
  if (payload.email_verified !== true) {
    throw new ApiError(400, 'Your Google email must be verified to continue.');
  }
  const email = String(payload.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    throw new ApiError(400, 'Google did not provide an email address for this account.');
  }

  const fullName =
    String(payload.name || '').trim() ||
    [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim() ||
    email.split('@')[0] ||
    'User';

  const profileImageUrl = normalizeGooglePictureUrl(payload.picture);

  return {
    googleId: String(payload.sub),
    email,
    fullName: fullName.slice(0, 120),
    profileImageUrl,
  };
}

/** Stable https URL for display (256px); strips GIS size suffixes like =s96-c */
function normalizeGooglePictureUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  let url = raw.trim();
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  if (!/^https:\/\/.+/i.test(url)) return undefined;
  if (!/googleusercontent\.com/i.test(url)) {
    return url.length <= 2048 ? url : url.slice(0, 2048);
  }
  try {
    let base = url.replace(/=s\d+(-c)?$/i, '');
    const parsed = new URL(base);
    parsed.searchParams.set('sz', '256');
    const out = parsed.toString();
    return out.length <= 2048 ? out : out.slice(0, 2048);
  } catch {
    const base = url.replace(/=s\d+(-c)?$/i, '');
    const joiner = base.includes('?') ? '&' : '?';
    const out = `${base}${joiner}sz=256`;
    return out.length <= 2048 ? out : out.slice(0, 2048);
  }
}

function randomLocalPassword() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  verifyGoogleIdToken,
  randomLocalPassword,
};
