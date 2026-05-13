'use server';

// Webhook system server actions.
// CRUD for webhook entries, event dispatching, and log management.

import { prisma } from '@/lib/prisma';
import { getDelegate, toAccessor } from '@/lib/erpnext/prisma-delegate';

// ── Types ────────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'before_insert'
  | 'after_insert'
  | 'before_update'
  | 'after_update'
  | 'before_delete'
  | 'after_delete'
  | 'on_submit'
  | 'on_cancel'
  | 'on_update_after_submit';

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'before_insert', label: 'Before Insert' },
  { value: 'after_insert', label: 'After Insert' },
  { value: 'before_update', label: 'Before Update' },
  { value: 'after_update', label: 'After Update' },
  { value: 'before_delete', label: 'Before Delete' },
  { value: 'after_delete', label: 'After Delete' },
  { value: 'on_submit', label: 'On Submit' },
  { value: 'on_cancel', label: 'On Cancel' },
  { value: 'on_update_after_submit', label: 'On Update After Submit' },
];

export interface WebhookEntryInfo {
  id: string;
  webhookName: string;
  enabled: boolean;
  referenceDoctype: string;
  events: WebhookEvent[];
  requestUrl: string;
  requestMethod: string;
  headers: Record<string, string> | null;
  bodyTemplate: string | null;
  createdAt: Date;
}

export interface WebhookLogInfo {
  id: string;
  webhookId: string;
  webhookName: string;
  referenceDoctype: string;
  referenceName: string;
  event: string;
  requestUrl: string;
  responseStatus: number | null;
  error: string | null;
  durationMs: number | null;
  success: boolean;
  createdAt: Date;
}

export interface WebhookActionResult {
  success: boolean;
  error?: string;
  webhook?: WebhookEntryInfo;
  webhooks?: WebhookEntryInfo[];
  logs?: WebhookLogInfo[];
}

export interface CreateWebhookInput {
  webhookName: string;
  referenceDoctype: string;
  events: WebhookEvent[];
  requestUrl: string;
  requestMethod?: string;
  headers?: Record<string, string> | null;
  bodyTemplate?: string | null;
  enabled?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDbEvents(events: WebhookEvent[]): string {
  return events.join(',');
}

function fromDbEvents(events: string): WebhookEvent[] {
  return events.split(',').filter((e): e is WebhookEvent => e.length > 0);
}

function rowToInfo(row: {
  id: string;
  webhook_name: string;
  enabled: boolean;
  reference_doctype: string;
  events: string;
  request_url: string;
  request_method: string;
  headers: string | null;
  body_template: string | null;
  creation: Date;
}): WebhookEntryInfo {
  return {
    id: row.id,
    webhookName: row.webhook_name,
    enabled: row.enabled,
    referenceDoctype: row.reference_doctype,
    events: fromDbEvents(row.events),
    requestUrl: row.request_url,
    requestMethod: row.request_method,
    headers: row.headers ? JSON.parse(row.headers) : null,
    bodyTemplate: row.body_template,
    createdAt: row.creation,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listWebhooks(): Promise<WebhookActionResult> {
  try {
    const rows = await prisma.webhookEntry.findMany({
      orderBy: { creation: 'desc' },
    });
    return {
      success: true,
      webhooks: rows.map(rowToInfo),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function getWebhook(id: string): Promise<WebhookActionResult> {
  try {
    const row = await prisma.webhookEntry.findUnique({ where: { id } });
    if (!row) return { success: false, error: 'Webhook not found' };
    return { success: true, webhook: rowToInfo(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function createWebhook(input: CreateWebhookInput): Promise<WebhookActionResult> {
  try {
    const row = await prisma.webhookEntry.create({
      data: {
        webhook_name: input.webhookName,
        enabled: input.enabled !== false,
        reference_doctype: input.referenceDoctype,
        events: toDbEvents(input.events),
        request_url: input.requestUrl,
        request_method: input.requestMethod || 'POST',
        headers: input.headers ? JSON.stringify(input.headers) : null,
        body_template: input.bodyTemplate || null,
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    return { success: true, webhook: rowToInfo(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function updateWebhook(
  id: string,
  input: Partial<CreateWebhookInput>,
): Promise<WebhookActionResult> {
  try {
    const data: Record<string, unknown> = { modified: new Date(), modified_by: 'Administrator' };
    if (input.webhookName !== undefined) data.webhook_name = input.webhookName;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.referenceDoctype !== undefined) data.reference_doctype = input.referenceDoctype;
    if (input.events !== undefined) data.events = toDbEvents(input.events);
    if (input.requestUrl !== undefined) data.request_url = input.requestUrl;
    if (input.requestMethod !== undefined) data.request_method = input.requestMethod;
    if (input.headers !== undefined) data.headers = input.headers ? JSON.stringify(input.headers) : null;
    if (input.bodyTemplate !== undefined) data.body_template = input.bodyTemplate;

    const row = await prisma.webhookEntry.update({ where: { id }, data });
    return { success: true, webhook: rowToInfo(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function deleteWebhook(id: string): Promise<WebhookActionResult> {
  try {
    await prisma.webhookLog.deleteMany({ where: { webhook_id: id } });
    await prisma.webhookEntry.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function toggleWebhook(id: string): Promise<WebhookActionResult> {
  try {
    const current = await prisma.webhookEntry.findUnique({ where: { id } });
    if (!current) return { success: false, error: 'Webhook not found' };
    const row = await prisma.webhookEntry.update({
      where: { id },
      data: { enabled: !current.enabled, modified: new Date() },
    });
    return { success: true, webhook: rowToInfo(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ── Webhook logs ─────────────────────────────────────────────────────────────

export async function listWebhookLogs(limit: number = 50): Promise<WebhookActionResult> {
  try {
    const rows = await prisma.webhookLog.findMany({
      orderBy: { creation: 'desc' },
      take: limit,
    });
    return {
      success: true,
      logs: rows.map((r) => ({
        id: r.id,
        webhookId: r.webhook_id,
        webhookName: r.webhook_name,
        referenceDoctype: r.reference_doctype,
        referenceName: r.reference_name,
        event: r.event,
        requestUrl: r.request_url,
        responseStatus: r.response_status,
        error: r.error,
        durationMs: r.duration_ms,
        success: r.success,
        createdAt: r.creation,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function clearWebhookLogs(): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.webhookLog.deleteMany({});
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ── Webhook dispatch (called from server actions after CRUD) ─────────────────

export async function dispatchWebhookEvent(
  doctype: string,
  recordName: string,
  event: WebhookEvent,
  recordData?: Record<string, unknown>,
): Promise<void> {
  // Find all enabled webhooks for this doctype + event
  const webhooks = await prisma.webhookEntry.findMany({
    where: {
      reference_doctype: doctype,
      enabled: true,
    },
  });

  for (const wh of webhooks) {
    const events = fromDbEvents(wh.events);
    if (!events.includes(event)) continue;

    // Fire-and-forget: don't await (runs in background)
    fireWebhook(wh, doctype, recordName, event, recordData).catch(() => {
      // Error already logged in fireWebhook
    });
  }
}

async function fireWebhook(
  wh: {
    id: string;
    webhook_name: string;
    request_url: string;
    request_method: string;
    headers: string | null;
    body_template: string | null;
  },
  doctype: string,
  recordName: string,
  event: string,
  recordData?: Record<string, unknown>,
): Promise<void> {
  const start = Date.now();
  const logId = `WHL-${crypto.randomUUID().slice(0, 8)}`;

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;

  try {
    // Build request body from template or default
    let body: string;
    if (wh.body_template) {
      body = wh.body_template
        .replace(/\{\{doctype\}\}/g, doctype)
        .replace(/\{\{name\}\}/g, recordName)
        .replace(/\{\{event\}\}/g, event);
      // Replace {{field}} with record data if available
      if (recordData) {
        for (const [key, val] of Object.entries(recordData)) {
          body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val ?? ''));
        }
      }
    } else {
      body = JSON.stringify({
        doctype,
        name: recordName,
        event,
        data: recordData ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    // Parse headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Doctype': doctype,
    };
    if (wh.headers) {
      try {
        const parsed = JSON.parse(wh.headers) as Record<string, string>;
        Object.assign(headers, parsed);
      } catch { /* ignore invalid headers */ }
    }

    const resp = await fetch(wh.request_url, {
      method: wh.request_method || 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    responseStatus = resp.status;
    responseBody = await resp.text().catch(() => null);

    if (!resp.ok) {
      error = `HTTP ${resp.status}: ${responseBody?.slice(0, 500)}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - start;

  // Log the result
  try {
    await prisma.webhookLog.create({
      data: {
        id: logId,
        webhook_id: wh.id,
        webhook_name: wh.webhook_name,
        reference_doctype: doctype,
        reference_name: recordName,
        event,
        request_url: wh.request_url,
        request_method: wh.request_method,
        request_headers: wh.headers,
        request_body: wh.body_template,
        response_status: responseStatus,
        response_body: responseBody ? responseBody.slice(0, 10000) : null,
        error,
        duration_ms: durationMs,
        success: !error,
      },
    });
  } catch {
    // Logging failure shouldn't break anything
  }
}
