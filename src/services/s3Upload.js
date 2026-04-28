const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');

let client;

function isS3Configured() {
  return Boolean(env.AWS_S3_BUCKET && env.AWS_REGION);
}

function getS3Client() {
  if (!isS3Configured()) return null;
  if (client) return client;
  const opts = { region: env.AWS_REGION };
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    opts.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    };
  }
  client = new S3Client(opts);
  return client;
}

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

function extFromMime(mimetype) {
  return MIME_TO_EXT[mimetype] || 'jpg';
}

function randomImageObjectName(mimetype) {
  return `${crypto.randomBytes(16).toString('hex')}.${extFromMime(mimetype)}`;
}

/**
 * Public URL for an object key. Uses AWS_S3_PUBLIC_BASE_URL when set (e.g. CloudFront),
 * otherwise virtual-hosted–style S3 URL.
 */
function publicUrlForKey(key) {
  const base = (env.AWS_S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const fallback = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  const origin = base || fallback;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${origin}/${encodedKey}`;
}

async function putImageObject(key, buffer, contentType) {
  const s3 = getS3Client();
  if (!s3) {
    const err = new Error('S3 is not configured');
    err.code = 'S3_NOT_CONFIGURED';
    throw err;
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    }),
  );
  return publicUrlForKey(key);
}

module.exports = {
  isS3Configured,
  getS3Client,
  randomImageObjectName,
  publicUrlForKey,
  putImageObject,
};
