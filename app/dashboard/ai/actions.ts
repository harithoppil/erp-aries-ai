'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AgentLoop } from '@/lib/agent-loop';
import { generateId, generateShortCode } from '@/lib/uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export type ClientSafePersona = {
  id: string;
  username: string;
  nickname: string;
  position: string;
  category: string;
  about: string | null;
  greeting: string | null;
  model: string;
  temperature: number;
  allowed_tools: string[] | null;
  allowed_collections: string[] | null;
  allowed_mcp_servers: string[] | null;
  enable_knowledge_base: boolean;
  knowledge_base_prompt: string | null;
  enabled: boolean;
  built_in: boolean;
  created_at: Date;
  updated_at: Date;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function parsePersona(p: any): ClientSafePersona {
  return {
    id: p.id,
    username: p.username,
    nickname: p.nickname,
    position: p.position,
    category: String(p.category),
    about: p.about,
    greeting: p.greeting,
    model: p.model,
    temperature: p.temperature,
    allowed_tools: p.allowed_tools ? (typeof p.allowed_tools === 'string' ? JSON.parse(p.allowed_tools) : p.allowed_tools) : null,
    allowed_collections: p.allowed_collections ? (typeof p.allowed_collections === 'string' ? JSON.parse(p.allowed_collections) : p.allowed_collections) : null,
    allowed_mcp_servers: p.allowed_mcp_servers ? (typeof p.allowed_mcp_servers === 'string' ? JSON.parse(p.allowed_mcp_servers) : p.allowed_mcp_servers) : null,
    enable_knowledge_base: p.enable_knowledge_base,
    knowledge_base_prompt: p.knowledge_base_prompt,
    enabled: p.enabled,
    built_in: p.built_in,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

// ── Persona CRUD ───────────────────────────────────────────────────────────

export async function listPersonas(filters?: {
  category?: string;
  enabled?: boolean;
}): Promise<
  { success: true; personas: ClientSafePersona[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.enabled !== undefined) where.enabled = filters.enabled;

    const personas = await prisma.ai_personas.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    // List view: truncate about/greeting for performance
    return {
      success: true,
      personas: personas.map((p) => ({
        ...parsePersona(p),
        about: p.about ? p.about.slice(0, 200) + (p.about.length > 200 ? '...' : '') : null,
        greeting: p.greeting ? p.greeting.slice(0, 100) + (p.greeting.length > 100 ? '...' : '') : null,
      }))
    };
  } catch (error: any) {
    console.error('[ai] listPersonas failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch personas' };
  }
}

export async function getPersona(id: string): Promise<
  { success: true; persona: ClientSafePersona } | { success: false; error: string }
> {
  try {
    const persona = await prisma.ai_personas.findUnique({ where: { id } });
    if (!persona) return { success: false, error: 'Persona not found' };
    return { success: true, persona: parsePersona(persona) };
  } catch (error: any) {
    console.error('[ai] getPersona failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch persona' };
  }
}

export async function createPersona(data: {
  username: string;
  nickname: string;
  position: string;
  category?: string;
  about?: string;
  greeting?: string;
  model?: string;
  temperature?: number;
  allowed_tools?: string[];
  allowed_collections?: string[];
  allowed_mcp_servers?: string[];
  enable_knowledge_base?: boolean;
  knowledge_base_prompt?: string;
  enabled?: boolean;
}): Promise<
  { success: true; persona: ClientSafePersona } | { success: false; error: string }
> {
  try {
    const persona = await prisma.ai_personas.create({
      data: {
        id: generateId(),
        username: data.username,
        nickname: data.nickname,
        position: data.position,
        category: data.category || 'BUSINESS',
        about: data.about || null,
        greeting: data.greeting || null,
        model: data.model || 'gemini-3-flash-preview',
        temperature: data.temperature ?? 0.7,
        allowed_tools: data.allowed_tools ? JSON.stringify(data.allowed_tools) : null,
        allowed_collections: data.allowed_collections ? JSON.stringify(data.allowed_collections) : null,
        allowed_mcp_servers: data.allowed_mcp_servers ? JSON.stringify(data.allowed_mcp_servers) : null,
        enable_knowledge_base: data.enable_knowledge_base ?? false,
        knowledge_base_prompt: data.knowledge_base_prompt || null,
        enabled: data.enabled ?? true,
        built_in: false,
      }
    });
    revalidatePath('/ai');
    revalidatePath('/settings');
    return { success: true, persona: parsePersona(persona) };
  } catch (error: any) {
    console.error('[ai] createPersona failed:', error?.message);
    if (error.code === 'P2002') return { success: false, error: 'Username already exists' };
    return { success: false, error: error?.message || 'Failed to create persona' };
  }
}

export async function updatePersona(id: string, data: {
  nickname?: string;
  position?: string;
  category?: string;
  about?: string;
  greeting?: string;
  model?: string;
  temperature?: number;
  allowed_tools?: string[];
  allowed_collections?: string[];
  allowed_mcp_servers?: string[];
  enable_knowledge_base?: boolean;
  knowledge_base_prompt?: string;
  enabled?: boolean;
}): Promise<
  { success: true; persona: ClientSafePersona } | { success: false; error: string }
> {
  try {
    const updateData: any = { updated_at: new Date() };
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.about !== undefined) updateData.about = data.about;
    if (data.greeting !== undefined) updateData.greeting = data.greeting;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.allowed_tools !== undefined) updateData.allowed_tools = JSON.stringify(data.allowed_tools);
    if (data.allowed_collections !== undefined) updateData.allowed_collections = JSON.stringify(data.allowed_collections);
    if (data.allowed_mcp_servers !== undefined) updateData.allowed_mcp_servers = JSON.stringify(data.allowed_mcp_servers);
    if (data.enable_knowledge_base !== undefined) updateData.enable_knowledge_base = data.enable_knowledge_base;
    if (data.knowledge_base_prompt !== undefined) updateData.knowledge_base_prompt = data.knowledge_base_prompt;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const persona = await prisma.ai_personas.update({
      where: { id },
      data: updateData,
    });
    revalidatePath('/ai');
    revalidatePath('/settings');
    return { success: true, persona: parsePersona(persona) };
  } catch (error: any) {
    console.error('[ai] updatePersona failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update persona' };
  }
}

export async function seedPersonas(): Promise<
  { success: true; seeded: number } | { success: false; error: string }
> {
  try {
    const builtIn = [
      {
        username: 'presales_assistant',
        nickname: 'Dex',
        position: 'Pre-sales Consultant',
        category: 'BUSINESS',
        about: 'You are Dex, an expert pre-sales consultant for the marine industry. You help craft proposals, analyze client requirements, and provide technical specifications for offshore diving, NDT, and subsea projects. Always prioritize safety compliance and industry standards.',
        greeting: 'Hey! I\'m Dex, your pre-sales consultant. I can help with proposals, technical specs, and client analysis for marine projects. What are we working on today?',
        model: 'gemini-3-flash-preview',
        temperature: 0.7,
        allowed_tools: JSON.stringify(['wiki_read', 'gemini_query', 'erp_customer_search', 'erp_quotation_create']),
        allowed_mcp_servers: JSON.stringify(['wiki']),
        enable_knowledge_base: true,
        knowledge_base_prompt: 'Prioritize wiki knowledge base for technical specifications and project precedents.',
        enabled: true,
        built_in: true,
      },
      {
        username: 'financial_advisor',
        nickname: 'Viz',
        position: 'Financial Analyst',
        category: 'BUSINESS',
        about: 'You are Viz, a financial analyst specializing in marine industry economics. You provide cost-benefit analysis, pricing strategies, margin calculations, and financial projections. You understand vessel day rates, equipment costing, and project P&L structures.',
        greeting: 'Hi! I\'m Viz, your financial analyst. I can help with pricing strategies, margin analysis, and financial projections. What numbers are we looking at?',
        model: 'gemini-3-flash-preview',
        temperature: 0.3,
        allowed_tools: JSON.stringify(['erp_accounts_read', 'erp_invoices_read', 'erp_payments_read', 'erp_quotation_create']),
        allowed_mcp_servers: JSON.stringify([]),
        enable_knowledge_base: true,
        knowledge_base_prompt: 'Cross-reference financial data with wiki articles on margin calculation and pricing strategies.',
        enabled: true,
        built_in: true,
      },
      {
        username: 'field_engineer',
        nickname: 'Avery',
        position: 'Field Engineer',
        category: 'TECHNICAL',
        about: 'You are Avery, a senior field engineer with expertise in offshore diving operations, NDT inspection, and subsea construction. You provide technical guidance on dive planning, equipment specifications, safety protocols, and certification requirements.',
        greeting: 'Hey there! I\'m Avery, your field engineer. I can advise on dive operations, NDT procedures, equipment specs, and safety compliance. What do you need help with?',
        model: 'gemini-3-flash-preview',
        temperature: 0.5,
        allowed_tools: JSON.stringify(['wiki_read', 'erp_assets_read', 'erp_personnel_read', 'erp_certifications_read']),
        allowed_mcp_servers: JSON.stringify(['wiki']),
        enable_knowledge_base: true,
        knowledge_base_prompt: 'Prioritize safety-critical wiki articles and equipment specifications.',
        enabled: true,
        built_in: true,
      },
    ];

    let seeded = 0;
    for (const data of builtIn) {
      const existing = await prisma.ai_personas.findUnique({ where: { username: data.username } });
      if (!existing) {
        await prisma.ai_personas.create({ data: { id: generateId(), ...data } });
        seeded++;
      }
    }

    revalidatePath('/ai');
    revalidatePath('/settings');
    return { success: true, seeded };
  } catch (error: any) {
    console.error('[ai] seedPersonas failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to seed personas' };
  }
}

// ── Chat (now uses in-process AgentLoop — no Python needed) ──────────────
// The AgentLoop calls Gemini Chat Completions API directly from Next.js.

export async function chatWithPersona(
  personaId: string,
  message: string,
  conversationId?: string
): Promise<{ success: true; content: string; message_id: string; conversation_id: string; model?: string } | { success: false; error: string }> {
  try {
    // Load persona from Prisma
    const persona = await prisma.ai_personas.findUnique({ where: { id: personaId } });
    if (!persona) return { success: false, error: 'Persona not found' };

    // Get or create conversation
    let conversation = conversationId
      ? await prisma.ai_conversations.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      conversation = await prisma.ai_conversations.create({
        data: {
          id: generateId(),
          persona_id: personaId,
          channel: 'web',
          title: message.slice(0, 60),
        },
      });
    }

    // Save user message
    const userMsg = await prisma.ai_messages.create({
      data: {
        id: generateId(),
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // Load conversation history (last 20 messages)
    const historyMessages = await prisma.ai_messages.findMany({
      where: { conversation_id: conversation.id },
      orderBy: { created_at: 'asc' },
      take: 20,
    });

    // Build history in Chat Completions format
    const history = historyMessages
      .filter(m => m.role !== 'system')
      .map(m => {
        const msg: Record<string, any> = { role: m.role, content: m.content };
        if (m.tool_calls) {
          try {
            msg.tool_calls = typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls;
          } catch {}
        }
        if (m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id;
        }
        return msg;
      });

    // Parse allowed tools
    let allowedTools: string[] | null = null;
    if (persona.allowed_tools) {
      try {
        allowedTools = typeof persona.allowed_tools === 'string'
          ? JSON.parse(persona.allowed_tools)
          : persona.allowed_tools;
      } catch {
        allowedTools = null;
      }
    }

    // Run AgentLoop
    const loop = new AgentLoop({
      persona: {
        id: persona.id,
        nickname: persona.nickname,
        about: persona.about || undefined,
        greeting: persona.greeting || undefined,
        model: persona.model || undefined,
        temperature: persona.temperature ?? undefined,
        allowed_tools: allowedTools,
        allowed_mcp_servers: persona.allowed_mcp_servers
          ? (typeof persona.allowed_mcp_servers === 'string'
              ? JSON.parse(persona.allowed_mcp_servers)
              : persona.allowed_mcp_servers)
          : null,
        knowledge_base_prompt: persona.knowledge_base_prompt || null,
        enable_knowledge_base: persona.enable_knowledge_base,
      },
    });

    const result = await loop.run(message, history as any);

    // Save assistant message
    const assistantMsg = await prisma.ai_messages.create({
      data: {
        id: generateId(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: result.content,
        tool_calls: result.toolCalls.length > 0
          ? JSON.stringify(result.toolCalls.map(tc => ({ name: tc.name, args: tc.args, callId: tc.callId })))
          : undefined,
      },
    });

    return {
      success: true,
      content: result.content,
      message_id: assistantMsg.id,
      conversation_id: conversation.id,
      model: result.model,
    };
  } catch (error: any) {
    console.error('[ai] chatWithPersona failed:', error?.message);
    return { success: false, error: error?.message || 'Chat request failed' };
  }
}

// ── Conversations (now uses Prisma directly — no Python needed) ──────────

export async function listConversations(personaId?: string): Promise<
  { success: true; conversations: any[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (personaId) where.persona_id = personaId;
    const conversations = await prisma.ai_conversations.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: 50,
    });
    return { success: true, conversations };
  } catch (error: any) {
    console.error('[ai] listConversations failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch conversations' };
  }
}

export async function getConversationMessages(conversationId: string): Promise<
  { success: true; messages: any[] } | { success: false; error: string }
> {
  try {
    const messages = await prisma.ai_messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });
    return { success: true, messages };
  } catch (error: any) {
    console.error('[ai] getMessages failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch messages' };
  }
}

// ── UI Token (for direct Gemini API calls from client) ────────────────────
// Mints OAuth access token locally using GCA_KEY service account — no Python needed.

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGeminiToken(): Promise<
  { success: true; token: string } | { success: false; error: string }
> {
  try {
    // Return cached token if valid for at least 5 more minutes
    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      return { success: true, token: cachedToken.token };
    }

    const { GoogleAuth } = await import('google-auth-library');
    const keyJson = process.env.GCA_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!keyJson) {
      throw new Error('GCA_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON env var not set');
    }

    const parsedKey = typeof keyJson === 'string' ? JSON.parse(keyJson) : keyJson;
    const auth = new GoogleAuth({
      credentials: parsedKey,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('No access token returned');

    cachedToken = {
      token,
      expiresAt: Date.now() + 3600 * 1000, // ~1 hour
    };

    return { success: true, token };
  } catch (error: any) {
    console.error('[ai] getGeminiToken failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get Gemini token' };
  }
}
