'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';

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

export async function listConnectors(): Promise<
  { success: true; connectors: ClientSafeConnector[] } | { success: false; error: string }
> {
  try {
    const connectors = await prisma.channel_connectors.findMany({
      orderBy: { created_at: 'desc' },
    });
    return {
      success: true,
      connectors: connectors.map((c) => ({
        ...c,
        enabled: c.enabled ?? false,
      })),
    };
  } catch (error) {
    console.error('Error fetching connectors:', error);
    return { success: false, error: 'Failed to fetch channel connectors' };
  }
}

export async function getConnector(
  id: string,
): Promise<
  { success: true; connector: ClientSafeConnector } | { success: false; error: string }
> {
  try {
    const connector = await prisma.channel_connectors.findUnique({ where: { id } });
    if (!connector) return { success: false, error: 'Connector not found' };
    return {
      success: true,
      connector: {
        ...connector,
        enabled: connector.enabled ?? false,
      },
    };
  } catch (error) {
    console.error('Error fetching connector:', error);
    return { success: false, error: 'Failed to fetch connector' };
  }
}

export async function createConnector(data: {
  channel_type: string;
  name: string;
  config?: string;
  enabled?: boolean;
  webhook_url?: string;
  default_persona_id?: string;
}): Promise<
  { success: true; connector: ClientSafeConnector } | { success: false; error: string }
> {
  try {
    const connector = await prisma.channel_connectors.create({
      data: {
        id: generateId(),
        channel_type: data.channel_type,
        name: data.name,
        config: data.config ?? null,
        enabled: data.enabled ?? true,
        webhook_url: data.webhook_url ?? null,
        default_persona_id: data.default_persona_id ?? null,
      },
    });
    revalidatePath('/channels');
    return {
      success: true,
      connector: {
        ...connector,
        enabled: connector.enabled ?? false,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create connector';
    return { success: false, error: message };
  }
}

export async function updateConnector(
  id: string,
  data: {
    channel_type?: string;
    name?: string;
    config?: string;
    enabled?: boolean;
    webhook_url?: string;
    default_persona_id?: string;
  },
): Promise<
  { success: true; connector: ClientSafeConnector } | { success: false; error: string }
> {
  try {
    const connector = await prisma.channel_connectors.update({
      where: { id },
      data,
    });
    revalidatePath('/channels');
    return {
      success: true,
      connector: {
        ...connector,
        enabled: connector.enabled ?? false,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update connector';
    return { success: false, error: message };
  }
}

export async function deleteConnector(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.channel_connectors.delete({ where: { id } });
    revalidatePath('/channels');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete connector';
    return { success: false, error: message };
  }
}
