import { Resend } from 'resend';
import logger from './logger.js';

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend.
 *
 * Notes:
 * - We intentionally avoid throwing for missing config in request flows that must not reveal account existence.
 * - Callers should treat failures as "best effort" and still return a generic success message.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !resendFromEmail) {
    logger.error(
      {
        hasResendApiKey: Boolean(resendApiKey),
        hasResendFromEmail: Boolean(resendFromEmail),
      },
      '[email] Resend configuration is missing'
    );

    return {
      ok: false,
      error: 'Email service is not configured',
    };
  }

  try {
    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: resendFromEmail,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });

    if (error) {
      logger.error(
        { resendError: error.message },
        '[email] Resend rejected email'
      );

      return {
        ok: false,
        error: error.message,
      };
    }

    logger.info(
      { emailId: data?.id },
      '[email] Email sent successfully'
    );

    return {
      ok: true,
      id: data?.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    logger.error(
      { error: message },
      '[email] Unexpected send failure'
    );

    return {
      ok: false,
      error: message,
    };
  }
}
