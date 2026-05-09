/**
 * Email Sending Infrastructure — DORMANT.
 *
 * Uses `@azure/communication-email` (same pattern as Revolyzz).
 *
 * The `EMAIL_ENABLED` flag controls whether emails are actually sent.
 * When not "true", `sendEmail()` logs to console but does NOT send.
 * This way the code exists, is connected, but won't send emails
 * until explicitly enabled.
 */

import { EmailClient } from '@azure/communication-email';

// ── DORMANT Flag ───────────────────────────────────────────────────────────────

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// ── Connection ─────────────────────────────────────────────────────────────────

const CONNECTION_STRING = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aries.erp.dev';

function getEmailDomain(): string {
  try {
    const url = new URL(APP_URL);
    return url.hostname;
  } catch (_e: unknown) {
    return 'aries.erp.dev';
  }
}

// Lazy-initialize the EmailClient only when actually sending
let emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (!emailClient) {
    if (!CONNECTION_STRING) {
      throw new Error('COMMUNICATION_SERVICES_CONNECTION_STRING is not configured');
    }
    emailClient = new EmailClient(CONNECTION_STRING);
  }
  return emailClient;
}

// ── Return Type ────────────────────────────────────────────────────────────────

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  dormant?: boolean;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send an email. When EMAIL_ENABLED is not "true", logs to console
 * instead of actually sending.
 */
export async function sendEmail(
  html: string,
  subject: string,
  toEmail: string,
): Promise<SendEmailResult> {
  // ── DORMANT mode: log but don't send ──
  if (!EMAIL_ENABLED) {
    console.log(`[email-sender] DORMANT — would send email to="${toEmail}" subject="${subject}" (${html.length} bytes)`);
    return {
      success: true,
      dormant: true,
      messageId: `dormant-${Date.now()}`,
    };
  }

  // ── ACTIVE mode: actually send ──
  try {
    const client = getEmailClient();
    const domain = getEmailDomain();

    const emailMessage = {
      senderAddress: `DoNotReply@${domain}`,
      content: {
        subject,
        html,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
    };

    const poller = await client.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      return { success: true, messageId: result.id };
    }

    return {
      success: false,
      error: `Email sending failed with status: ${result.status}`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error occurred';
    console.error('[email-sender] sendEmail failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Send an email with a reply-to address.
 */
export async function sendEmailWithReplyTo(
  html: string,
  subject: string,
  toEmail: string,
  replyTo: string,
): Promise<SendEmailResult> {
  if (!EMAIL_ENABLED) {
    console.log(`[email-sender] DORMANT — would send email to="${toEmail}" replyTo="${replyTo}" subject="${subject}"`);
    return {
      success: true,
      dormant: true,
      messageId: `dormant-${Date.now()}`,
    };
  }

  try {
    const client = getEmailClient();
    const domain = getEmailDomain();

    const emailMessage = {
      senderAddress: `DoNotReply@${domain}`,
      content: {
        subject,
        html,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
      replyTo: [{ address: replyTo }],
    };

    const poller = await client.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      return { success: true, messageId: result.id };
    }

    return {
      success: false,
      error: `Email sending failed with status: ${result.status}`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error occurred';
    console.error('[email-sender] sendEmailWithReplyTo failed:', msg);
    return { success: false, error: msg };
  }
}
