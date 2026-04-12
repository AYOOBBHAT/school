import { Resend } from 'resend';
import logger from './logger.js';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

/**
 * Sends an email via Resend.
 *
 * Notes:
 * - We intentionally avoid throwing for missing config in request flows that must not reveal account existence.
 * - Callers should treat failures as "best effort" and still return a generic success message.
 */
export async function sendEmail(opts: { to: string; subject: string; text: string }) {
  if (!resendApiKey || !resendFromEmail) {
    logger.warn('[email] Resend is not configured; email not sent');
    return { ok: false as const, error: 'Email not configured' };
  }

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: resendFromEmail,
      to: opts.to,
      subject: opts.subject,
      text: opts.text
    });
    return { ok: true as const };
  } catch {
    logger.error('[email] Send failed');
    return { ok: false as const, error: 'Failed to send email' };
  }
}

