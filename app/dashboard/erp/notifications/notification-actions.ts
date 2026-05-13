'use server';

import { prisma } from '@/lib/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'Info' | 'Alert' | 'Warning' | 'Success' | 'Error';

export interface NotificationInfo {
  id: string;
  name: string;
  subject: string;
  doctype: string | null;
  docname: string | null;
  forUser: string | null;
  type: NotificationType;
  read: boolean;
  creation: string;
}

export interface CreateNotificationInput {
  subject: string;
  doctype?: string;
  docname?: string;
  forUser?: string;
  type?: NotificationType;
  emailContent?: string;
  documentType?: string;
  documentName?: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listNotifications(
  forUser?: string,
  unreadOnly?: boolean,
  limit?: number,
): Promise<{ success: boolean; notifications?: NotificationInfo[]; error?: string }> {
  try {
    const where: Record<string, unknown> = {};
    if (forUser) where.for_user = forUser;
    if (unreadOnly) where.read = false;

    const rows = await prisma.notificationLog.findMany({
      where,
      orderBy: { creation: 'desc' },
      take: limit ?? 50,
    });

    const notifications: NotificationInfo[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      doctype: r.doctype,
      docname: r.docname,
      forUser: r.for_user,
      type: (r.type as NotificationType) ?? 'Info',
      read: r.read,
      creation: r.creation.toISOString(),
    }));

    return { success: true, notifications };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function getUnreadCount(forUser?: string): Promise<number> {
  try {
    const where: Record<string, unknown> = { read: false };
    if (forUser) where.for_user = forUser;
    return await prisma.notificationLog.count({ where });
  } catch {
    return 0;
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const row = await prisma.notificationLog.create({
      data: {
        subject: input.subject,
        doctype: input.doctype ?? null,
        docname: input.docname ?? null,
        for_user: input.forUser ?? null,
        type: input.type ?? 'Info',
        email_content: input.emailContent ?? null,
        document_type: input.documentType ?? null,
        document_name: input.documentName ?? null,
      },
    });
    return { success: true, id: row.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.notificationLog.update({ where: { id }, data: { read: true, opened: true } });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function markAllNotificationsRead(forUser?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const where: Record<string, unknown> = { read: false };
    if (forUser) where.for_user = forUser;
    const result = await prisma.notificationLog.updateMany({ where, data: { read: true, opened: true } });
    return { success: true, count: result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function deleteNotification(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.notificationLog.delete({ where: { id } });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function clearAllNotifications(forUser?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const where: Record<string, unknown> = {};
    if (forUser) where.for_user = forUser;
    const result = await prisma.notificationLog.deleteMany({ where });
    return { success: true, count: result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Auto-notify on DocType events ────────────────────────────────────────────

export async function notifyDocTypeEvent(
  doctype: string,
  docname: string,
  event: string,
  subject?: string,
): Promise<void> {
  try {
    const eventLabel = event.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    await createNotification({
      subject: subject ?? `${eventLabel}: ${doctype} "${docname}"`,
      doctype,
      docname,
      type: event === 'on_submit' ? 'Success' : event === 'on_cancel' ? 'Warning' : event === 'after_delete' ? 'Alert' : 'Info',
      documentType: doctype,
      documentName: docname,
    });
  } catch { /* non-blocking */ }
}