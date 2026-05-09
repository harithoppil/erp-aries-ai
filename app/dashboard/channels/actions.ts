'use server';

import { prisma } from '@/lib/prisma';

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
    const rows = await prisma.channel_connectors.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return {
      success: true,
      channels: rows.map((c) => ({
        id: c.id,
        channel_type: c.channel_type || 'telegram',
        name: c.name,
        enabled: c.enabled,
        config: c.config || null,
        webhook_url: c.webhook_url || null,
        default_persona_id: c.default_persona_id || null,
        created_at: c.created_at,
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
  try {
    const record = await prisma.channel_connectors.create({
      data: {
        id: crypto.randomUUID(),
        channel_type: data.channel_type || 'telegram',
        name: data.name || 'New Connector',
        enabled: data.enabled ?? true,
        config: data.config || null,
        webhook_url: data.webhook_url || null,
        default_persona_id: data.default_persona_id || null,
      },
    });
    return {
      success: true,
      connector: {
        id: record.id,
        channel_type: record.channel_type,
        name: record.name,
        enabled: record.enabled,
        config: record.config,
        webhook_url: record.webhook_url,
        default_persona_id: record.default_persona_id,
        created_at: record.created_at,
      },
    };
  } catch (error:any) {
    return { success: false, error: error?.message || 'Failed to create connector' };
  }
}

export async function updateConnector(
  id: string,
  data: Partial<ClientSafeConnector>
): Promise<{ success: true; connector: ClientSafeConnector } | { success: false; error: string }> {
  try {
    const record = await prisma.channel_connectors.update({
      where: { id },
      data: {
        channel_type: data.channel_type || undefined,
        name: data.name || undefined,
        enabled: data.enabled !== undefined ? data.enabled : undefined,
        config: data.config !== undefined ? data.config : undefined,
        webhook_url: data.webhook_url !== undefined ? data.webhook_url : undefined,
        default_persona_id: data.default_persona_id !== undefined ? data.default_persona_id : undefined,
      },
    });
    return {
      success: true,
      connector: {
        id: record.id,
        channel_type: record.channel_type,
        name: record.name,
        enabled: record.enabled,
        config: record.config,
        webhook_url: record.webhook_url,
        default_persona_id: record.default_persona_id,
        created_at: record.created_at,
      },
    };
  } catch (error:any) {
    return { success: false, error: error?.message || 'Failed to update connector' };
  }
}

export async function deleteConnector(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    await prisma.channel_connectors.delete({ where: { id } });
    return { success: true };
  } catch (error:any) {
    return { success: false, error: error?.message || 'Failed to delete connector' };
  }
}
