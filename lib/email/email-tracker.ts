/**
 * Email Tracking Infrastructure — DORMANT.
 *
 * Tracks email sends in the `email_tracking` database table.
 *
 * Same DORMANT flag as email-sender.ts: when EMAIL_ENABLED is not "true",
 * tracking operations log to console but do NOT write to the database.
 * This keeps the code ready for activation without side effects.
 */

import { prisma } from '@/lib/prisma';

// ── DORMANT Flag ───────────────────────────────────────────────────────────────

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmailTrackingParams {
  userId?: string;
  emailAddress: string;
  emailType: string;
  templateId?: string;
  messageId?: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailRecord {
  id: string;
  userId: string | null;
  emailAddress: string;
  emailType: string;
  templateId: string | null;
  messageId: string | null;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date;
  openedAt: Date | null;
  clickedAt: Date | null;
  createdAt: Date;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Record that an email was sent.
 *
 * When DORMANT, logs to console without writing to the database.
 */
export async function trackEmailSent(
  params: EmailTrackingParams,
  messageId?: string,
): Promise<string | null> {
  // ── DORMANT mode: log but don't write ──
  if (!EMAIL_ENABLED) {
    console.log(
      `[email-tracker] DORMANT — would track email to="${params.emailAddress}" type="${params.emailType}" messageId="${messageId ?? 'N/A'}"`,
    );
    return null;
  }

  // ── ACTIVE mode: persist to database ──
  try {
    const record = await prisma.email_tracking.create({
      data: {
        user_id: params.userId || null,
        email_address: params.emailAddress,
        email_type: params.emailType,
        template_id: params.templateId || null,
        message_id: messageId || null,
        subject: params.subject || null,
        status: 'sent',
        metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
        sent_at: new Date(),
      },
    });

    return record.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] trackEmailSent failed:', msg);
    // Don't throw — tracking failure should not break email sending
    return null;
  }
}

/**
 * Update an email tracking record when delivery fails.
 */
export async function trackEmailFailed(
  params: EmailTrackingParams,
  errorMessage: string,
): Promise<string | null> {
  if (!EMAIL_ENABLED) {
    console.log(
      `[email-tracker] DORMANT — would track failed email to="${params.emailAddress}" error="${errorMessage}"`,
    );
    return null;
  }

  try {
    const record = await prisma.email_tracking.create({
      data: {
        user_id: params.userId || null,
        email_address: params.emailAddress,
        email_type: params.emailType,
        template_id: params.templateId || null,
        message_id: params.messageId || null,
        subject: params.subject || null,
        status: 'failed',
        error_message: errorMessage,
        metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
        sent_at: new Date(),
      },
    });

    return record.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] trackEmailFailed failed:', msg);
    return null;
  }
}

/**
 * Get email history for a specific user.
 */
export async function getEmailHistory(
  userId: string,
  limit = 50,
): Promise<EmailRecord[]> {
  if (!EMAIL_ENABLED) {
    console.log(`[email-tracker] DORMANT — would fetch email history for userId="${userId}"`);
    return [];
  }

  try {
    const records = await prisma.email_tracking.findMany({
      where: { user_id: userId },
      orderBy: { sent_at: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.user_id,
      emailAddress: r.email_address,
      emailType: r.email_type,
      templateId: r.template_id,
      messageId: r.message_id,
      subject: r.subject,
      status: r.status,
      errorMessage: r.error_message,
      sentAt: r.sent_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      createdAt: r.created_at,
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] getEmailHistory failed:', msg);
    return [];
  }
}

/**
 * Get email history for a specific email address.
 */
export async function getEmailHistoryByAddress(
  emailAddress: string,
  limit = 50,
): Promise<EmailRecord[]> {
  if (!EMAIL_ENABLED) {
    console.log(`[email-tracker] DORMANT — would fetch email history for address="${emailAddress}"`);
    return [];
  }

  try {
    const records = await prisma.email_tracking.findMany({
      where: { email_address: emailAddress },
      orderBy: { sent_at: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.user_id,
      emailAddress: r.email_address,
      emailType: r.email_type,
      templateId: r.template_id,
      messageId: r.message_id,
      subject: r.subject,
      status: r.status,
      errorMessage: r.error_message,
      sentAt: r.sent_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      createdAt: r.created_at,
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] getEmailHistoryByAddress failed:', msg);
    return [];
  }
}

/**
 * Mark an email as opened (e.g. via tracking pixel).
 */
export async function markEmailOpened(
  trackingId: string,
): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    console.log(`[email-tracker] DORMANT — would mark email opened id="${trackingId}"`);
    return true;
  }

  try {
    await prisma.email_tracking.update({
      where: { id: trackingId },
      data: { opened_at: new Date() },
    });
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] markEmailOpened failed:', msg);
    return false;
  }
}

/**
 * Mark an email as clicked (e.g. via link tracking).
 */
export async function markEmailClicked(
  trackingId: string,
): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    console.log(`[email-tracker] DORMANT — would mark email clicked id="${trackingId}"`);
    return true;
  }

  try {
    await prisma.email_tracking.update({
      where: { id: trackingId },
      data: { clicked_at: new Date() },
    });
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[email-tracker] markEmailClicked failed:', msg);
    return false;
  }
}
