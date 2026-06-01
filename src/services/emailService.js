const { Resend } = require('resend');
const env = require('../config/env');

let resendClient;

function getResend() {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

function trimBaseUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '*') return '';
  return s.replace(/\/$/, '');
}

/** Absolute logo URL for `<img src>` — prefers EMAIL_LOGO_URL, else `{site}/logo.png`. */
function resolveSignupEmailLogoUrl() {
  const explicit = trimBaseUrl(env.EMAIL_LOGO_URL);
  if (explicit) return explicit;
  let base = trimBaseUrl(env.APP_PUBLIC_FRONTEND_URL);
  if (!base && env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
    const origins = String(env.CORS_ORIGIN)
      .split(',')
      .map((x) => trimBaseUrl(x))
      .filter(Boolean);
    base = origins[0] || '';
  }
  if (!base) return '';
  return `${base}/logo.png`;
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {{ to: string; resetUrl: string | null; token: string; expiresInMinutes: number }} opts
 */
async function sendAdminPasswordResetEmail(opts) {
  const resend = getResend();
  if (!resend) {
    const err = new Error('Resend API key is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const { to, resetUrl, token, expiresInMinutes } = opts;
  const safeMinutes = Math.round(expiresInMinutes);
  const logoUrl = resolveSignupEmailLogoUrl();
  const safeResetHref = resetUrl ? escapeHtmlAttr(resetUrl) : '';
  const logoBlock = logoUrl
    ? `<img src="${escapeHtmlAttr(logoUrl)}" alt="Roommat" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<p style="margin:0;font-size:30px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;line-height:1;">Roommat</p>`;

  const actionBlock = safeResetHref
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 8px;">
         <tr>
           <td style="border-radius:12px;background:#0d9488;">
             <a href="${safeResetHref}" target="_blank" rel="noopener"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
               Reset password
             </a>
           </td>
         </tr>
       </table>`
    : `<p style="margin:0;padding:12px 14px;background:#f3f4f6;border-radius:8px;font-size:13px;word-break:break-all;color:#374151;line-height:1.5;">
         Reset token: ${token}
       </p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f7f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,118,110,0.08);">
          <tr>
            <td style="background:#ffffff;padding:36px 28px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
              ${logoBlock}
              <p style="margin:28px 0 0;font-size:30px;font-weight:800;color:#000000;line-height:1.15;letter-spacing:-0.03em;">
                Reset your password
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              <p style="margin:0 0 12px;font-size:16px;color:#111827;line-height:1.5;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                We received a request to reset the password for your <strong>Roommat admin</strong> account.
              </p>
              ${actionBlock}
              <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This link expires in <strong>${safeMinutes}</strong> minutes. If you did not ask for this, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">© Roommat · Account security</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: 'Reset your Roommat admin password',
    html,
  });

  if (error) {
    const msg =
      typeof error.message === 'string'
        ? error.message
        : error.name || 'The email could not be sent. Please try again later.';
    const err = new Error(msg);
    err.code = 'RESEND_ERROR';
    throw err;
  }
}

/**
 * @param {{ to: string; resetUrl: string | null; token: string; expiresInMinutes: number }} opts
 */
async function sendUserPasswordResetEmail(opts) {
  const resend = getResend();
  if (!resend) {
    const err = new Error('Resend API key is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const { to, resetUrl, token, expiresInMinutes } = opts;
  const safeMinutes = Math.round(expiresInMinutes);

  const logoUrl = resolveSignupEmailLogoUrl();
  const safeResetHref = resetUrl ? escapeHtmlAttr(resetUrl) : '';
  const logoBlock = logoUrl
    ? `<img src="${escapeHtmlAttr(logoUrl)}" alt="Roommat" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<p style="margin:0;font-size:30px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;line-height:1;">Roommat</p>`;

  const actionBlock = safeResetHref
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 8px;">
         <tr>
           <td style="border-radius:12px;background:#0d9488;">
             <a href="${safeResetHref}" target="_blank" rel="noopener"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
               Reset password
             </a>
           </td>
         </tr>
       </table>`
    : `<p style="margin:0;padding:12px 14px;background:#f3f4f6;border-radius:8px;font-size:13px;word-break:break-all;color:#374151;line-height:1.5;">
         Reset token: ${token}
       </p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f7f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,118,110,0.08);">
          <tr>
            <td style="background:#ffffff;padding:36px 28px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
              ${logoBlock}
              <p style="margin:28px 0 0;font-size:30px;font-weight:800;color:#000000;line-height:1.15;letter-spacing:-0.03em;">
                Reset your password
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              <p style="margin:0 0 12px;font-size:16px;color:#111827;line-height:1.5;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                We received a request to reset the password for your <strong>Roommat</strong> account.
              </p>
              ${actionBlock}
              <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This link expires in <strong>${safeMinutes}</strong> minutes. If you did not ask for this, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">© Roommat · Account security</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: 'Reset your Roommat password',
    html,
  });

  if (error) {
    const msg =
      typeof error.message === 'string'
        ? error.message
        : error.name || 'The email could not be sent. Please try again later.';
    const err = new Error(msg);
    err.code = 'RESEND_ERROR';
    throw err;
  }
}

/**
 * Signup / email confirmation — HTML tuned for Resend + major clients.
 * @param {{ to: string; verifyUrl: string; fullName: string }} opts
 */
async function sendSignupVerificationEmail(opts) {
  const resend = getResend();
  if (!resend) {
    const err = new Error('Resend API key is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const { to, verifyUrl, fullName } = opts;
  const rawName = (fullName && String(fullName).trim()) || 'there';
  const name = rawName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const logoUrl = resolveSignupEmailLogoUrl();
  const safeVerifyHref = escapeHtmlAttr(verifyUrl);
  const logoBlock = logoUrl
    ? `<img src="${escapeHtmlAttr(logoUrl)}" alt="Roommat" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<p style="margin:0;font-size:30px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;line-height:1;">Roommat</p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f7f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,118,110,0.08);">
          <tr>
            <td style="background:#ffffff;padding:36px 28px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
              ${logoBlock}
              <p style="margin:28px 0 0;font-size:30px;font-weight:800;color:#000000;line-height:1.15;letter-spacing:-0.03em;">
                Confirm your email
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              <p style="margin:0 0 12px;font-size:16px;color:#111827;line-height:1.5;">Hi ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                Thanks for joining Roommat. Please confirm your email address so we know this account belongs to you.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 8px;">
                <tr>
                  <td style="border-radius:12px;background:#0d9488;">
                    <a href="${safeVerifyHref}" target="_blank" rel="noopener"
                      style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Verify my email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                If you didn’t create an account, you can ignore this message.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">© Roommat · Account security</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: 'Confirm your Roommat email',
    html,
  });

  if (error) {
    const msg =
      typeof error.message === 'string'
        ? error.message
        : error.name || 'The email could not be sent. Please try again later.';
    const err = new Error(msg);
    err.code = 'RESEND_ERROR';
    throw err;
  }
}

module.exports = {
  sendAdminPasswordResetEmail,
  sendUserPasswordResetEmail,
  sendSignupVerificationEmail,
  isEmailConfigured,
};

