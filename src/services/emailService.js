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

  const linkSection = resetUrl
    ? `<p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>
       <p style="word-break:break-all;color:#444;">If the button does not work, open this link in your browser:<br/>${resetUrl}</p>`
    : `<p style="word-break:break-all;">Open your admin "Reset password" screen and paste this token:</p>
       <p style="font-family:monospace;background:#f4f4f4;padding:12px;word-break:break-all;">${token}</p>`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5">
      <p>Hello,</p>
      <p>We received a request to reset the password for your <strong>RoomMate admin</strong> account.</p>
      ${linkSection}
      <p>This link and token expire in <strong>${safeMinutes}</strong> minutes. If you did not ask for this, you can ignore this email.</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: 'Reset your RoomMate admin password',
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
  isEmailConfigured,
};
