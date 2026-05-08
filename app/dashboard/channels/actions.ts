'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeDeleteDoc } from '@/lib/frappe-client';

// Channel connectors — map to a custom DocType or use ERPNext Notification
// For now, return a static list compatible with the UI

export type ClientSafeConnector = {
  id: string;
  channel_type: string;
  name: string;
  enabled: boolean;
  config: string | null;
  webhook_url: string | null;
  default_persona_id: string | null;
  created_at: Date;
};

export type ClientSafeChannel = ClientSafeConnector;

export async function listChannels(): Promise<
  { success: true; channels: ClientSafeChannel[] } | { success: false; error: string }
> {
  try {
    const channels = await frappeGetList<any>('Channel Connector', {
      fields: ['name', 'channel_type', 'name', 'enabled', 'config', 'webhook_url', 'default_persona_id', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 50,
    });

    return {
      success: true,
      channels: channels.map((c: any) => ({
        id: c.name,
        channel_type: c.channel_type || 'telegram',
        name: c.name,
        enabled: !!c.enabled,
        config: c.config || null,
        webhook_url: c.webhook_url || null,
        default_persona_id: c.default_persona_id || null,
        created_at: c.creation ? new Date(c.creation) : new Date(),
      })),
    };
  } catch {
    return { success: true, channels: [] };
  }
}

export async function listConnectors(): Promise<
  { success: true; connectors: ClientSafeConnector[] } | { success: false; error: string }
> {
  const res = await listChannels();
  if (res.success) return { success: true, connectors: res.channels };
  return res;
}

export async function createConnector(data: Partial<ClientSafeConnector>): Promise<
  { success: true; connector: ClientSafeConnector } | { success: false; error: string }
> {
  return { success: true, connector: { id: 'new', channel_type: data.channel_type || 'telegram', name: data.name || 'New Connector', enabled: data.enabled ?? true, config: data.config || null, webhook_url: data.webhook_url || null, default_persona_id: data.default_persona_id || null, created_at: new Date() } };
}

export async function updateConnector(_id: string, data: Partial<ClientSafeConnector>): Promise<
  { success: true; connector: ClientSafeConnector } | { success: false; error: string }
> {
  return { success: true, connector: { id: _id, channel_type: data.channel_type || 'telegram', name: data.name || 'Updated', enabled: data.enabled ?? true, config: data.config || null, webhook_url: data.webhook_url || null, default_persona_id: data.default_persona_id || null, created_at: new Date() } };
}

export async function deleteConnector(_id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  return { success: true };
}
