/**
 * MCP Gateway — central tool registry for AI persona tool calling.
 *
 * Replaces the Python backend MCP gateway (backend/app/mcp_servers/gateway.py).
 * Each MCP server registers its tools here with typed handler functions.
 * The gateway provides tool discovery, scoping, and dispatch.
 *
 * Tool handlers are async functions that return string results (same as Python).
 * They can call Prisma, Gemini, wiki API, or any Server Action.
 *
 * Usage:
 *   const gateway = getMCPGateway();
 *   const tools = gateway.listTools("wiki");
 *   const result = await gateway.callTool("wiki_read", { path: "entities/acme.md" });
 */

import { prisma } from '@/lib/prisma';
import { API_BASE } from '@/lib/api-base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  server: string;
  handler: (args: Record<string, unknown>) => Promise<string>;
  requiresAuth: boolean;
  parameters?: Record<string, MCPToolParameter>;
}

export interface MCPToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface MCPServerRegistration {
  name: string;
  description: string;
  tools: MCPTool[];
}

// ── Gateway class ───────────────────────────────────────────────────────────

class MCPGateway {
  private servers: Map<string, MCPServerRegistration> = new Map();
  private toolIndex: Map<string, MCPTool> = new Map();

  registerServer(name: string, description: string): void {
    this.servers.set(name, { name, description, tools: [] });
  }

  registerTool(serverName: string, tool: MCPTool): void {
    if (!this.servers.has(serverName)) {
      this.registerServer(serverName, `MCP Server: ${serverName}`);
    }
    this.servers.get(serverName)!.tools.push(tool);
    this.toolIndex.set(tool.name, tool);
  }

  listServers(): { name: string; description: string; tool_count: number }[] {
    return [...this.servers.values()].map(s => ({
      name: s.name,
      description: s.description,
      tool_count: s.tools.length,
    }));
  }

  listTools(serverName?: string): { name: string; description: string; server: string; requires_auth: boolean; parameters?: Record<string, MCPToolParameter> }[] {
    const tools: MCPTool[] = [];
    if (serverName) {
      const server = this.servers.get(serverName);
      if (server) tools.push(...server.tools);
    } else {
      for (const server of this.servers.values()) {
        tools.push(...server.tools);
      }
    }
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      server: t.server,
      requires_auth: t.requiresAuth,
      parameters: t.parameters,
    }));
  }

  async callTool(toolName: string, kwargs: Record<string, unknown> = {}): Promise<string> {
    const tool = this.toolIndex.get(toolName);
    if (!tool) throw new Error(`Tool not found: ${toolName}`);
    return tool.handler(kwargs);
  }

  /** Get tools filtered by persona's allowed_tools list */
  getPersonaTools(allowedTools: string[] | null): MCPTool[] {
    if (!allowedTools) return [];
    return allowedTools
      .map(name => this.toolIndex.get(name))
      .filter((t): t is MCPTool => t !== undefined);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _gateway: MCPGateway | null = null;

export { MCPGateway };
export function getMCPGateway(): MCPGateway {
  if (_gateway) return _gateway;

  _gateway = new MCPGateway();
  registerAllServers(_gateway);
  return _gateway;
}

// ── Wiki API helper ────────────────────────────────────────────────────────

/** Helper to safely extract string values from Record<string, unknown> args */
function strArg(args: Record<string, unknown>, key: string, fallback: string = ''): string {
  const val = args[key];
  return typeof val === 'string' ? val : fallback;
}

/** Helper to safely extract number values from Record<string, unknown> args */
function numArg(args: Record<string, unknown>, key: string, fallback: number = 0): number {
  const val = args[key];
  return typeof val === 'number' ? val : fallback;
}

async function wikiApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/wiki${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err));
  }
  return res.json();
}

// ── Gemini API helper ──────────────────────────────────────────────────────

async function geminiQuery(question: string, context: string = ''): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key configured');

  const ai = new GoogleGenAI({ apiKey });
  const prompt = context
    ? `Context: ${context}\n\nQuestion: ${question}`
    : question;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text || 'No response generated';
}

// ── Server registrations ───────────────────────────────────────────────────

function registerAllServers(gw: MCPGateway): void {
  registerWikiServer(gw);
  registerGeminiServer(gw);
  registerERPServer(gw);
  registerSearchServer(gw);
  registerMutatorServer(gw);
  registerMediaServer(gw);
  // SAP, Outlook, Document Output — stay as Python microservice stubs
  registerSAPServer(gw);
  registerOutlookServer(gw);
  registerDocumentOutputServer(gw);
}

// ── 1. Wiki MCP ─────────────────────────────────────────────────────────────

function registerWikiServer(gw: MCPGateway): void {
  gw.registerServer('wiki', 'LLM Wiki read/write/search');

  gw.registerTool('wiki', {
    name: 'wiki_read',
    description: 'Read a wiki page by path',
    server: 'wiki',
    requiresAuth: false,
    parameters: { path: { type: 'string', description: 'Wiki page path', required: true } },
    handler: async (args) => {
      try {
        const path = strArg(args, 'path');
        const page = await wikiApiFetch<{ content: string; path: string }>(`/pages/${encodeURIComponent(path)}`);
        return page?.content || `Page not found: ${path}`;
      } catch (e: any) {
        return `Error reading page: ${e?.message}`;
      }
    },
  });

  gw.registerTool('wiki', {
    name: 'wiki_write',
    description: 'Write or update a wiki page',
    server: 'wiki',
    requiresAuth: true,
    parameters: {
      path: { type: 'string', description: 'Wiki page path', required: true },
      content: { type: 'string', description: 'Page content in markdown', required: true },
      msg: { type: 'string', description: 'Commit message' },
    },
    handler: async (args) => {
      try {
        await wikiApiFetch('/pages', {
          method: 'POST',
          body: JSON.stringify({
            path: strArg(args, 'path'),
            content: strArg(args, 'content'),
            commit_message: strArg(args, 'msg', 'MCP write'),
          }),
        });
        return `Written: ${strArg(args, 'path')}`;
      } catch (e: any) {
        return `Error writing page: ${e?.message}`;
      }
    },
  });

  gw.registerTool('wiki', {
    name: 'wiki_search',
    description: 'Search the wiki by query',
    server: 'wiki',
    requiresAuth: false,
    parameters: { q: { type: 'string', description: 'Search query', required: true } },
    handler: async (args) => {
      try {
        const q = strArg(args, 'q');
        const results = await wikiApiFetch<{ path: string; title: string; snippet: string; score: number }[]>(
          `/search?q=${encodeURIComponent(q)}`
        );
        if (!results?.length) return 'No results';
        return results.map(r => `- [${r.title}] ${r.path}: ${r.snippet}`).join('\n');
      } catch (e: any) {
        return `Error searching: ${e?.message}`;
      }
    },
  });

  gw.registerTool('wiki', {
    name: 'wiki_list',
    description: 'List all wiki pages',
    server: 'wiki',
    requiresAuth: false,
    handler: async () => {
      try {
        const pages = await wikiApiFetch<string[]>('/pages');
        if (!pages?.length) return 'No pages';
        return pages.map(p => `- ${p}`).join('\n');
      } catch (e: any) {
        return `Error listing pages: ${e?.message}`;
      }
    },
  });
}

// ── 2. Gemini MCP ───────────────────────────────────────────────────────────

function registerGeminiServer(gw: MCPGateway): void {
  gw.registerServer('gemini', 'Gemini 2.5 Pro reasoning, classification, drafting');

  gw.registerTool('gemini', {
    name: 'gemini_query',
    description: 'Answer a question using Gemini',
    server: 'gemini',
    requiresAuth: true,
    parameters: {
      question: { type: 'string', description: 'Question to answer', required: true },
      ctx: { type: 'string', description: 'Optional context' },
    },
    handler: async (args) => {
      try {
        return await geminiQuery(strArg(args, 'question'), strArg(args, 'ctx'));
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('gemini', {
    name: 'gemini_classify',
    description: 'Classify an enquiry using Gemini',
    server: 'gemini',
    requiresAuth: true,
    parameters: {
      desc: { type: 'string', description: 'Enquiry description', required: true },
      industry: { type: 'string', description: 'Industry' },
      client: { type: 'string', description: 'Client name' },
    },
    handler: async (args) => {
      try {
        const desc = strArg(args, 'desc');
        const industry = strArg(args, 'industry', 'Unknown');
        const client = strArg(args, 'client', 'Unknown');
        const prompt = `Classify this enquiry:
Client: ${client}
Industry: ${industry}
Description: ${desc}

Return JSON with: scope_category, complexity (low/medium/high), estimated_value, key_requirements.`;
        return await geminiQuery(prompt);
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('gemini', {
    name: 'gemini_draft',
    description: 'Draft a proposal using Gemini',
    server: 'gemini',
    requiresAuth: true,
    parameters: {
      client: { type: 'string', description: 'Client name', required: true },
      desc: { type: 'string', description: 'Project description', required: true },
      industry: { type: 'string', description: 'Industry' },
      ctx: { type: 'string', description: 'Additional context' },
    },
    handler: async (args) => {
      try {
        const client = strArg(args, 'client');
        const desc = strArg(args, 'desc');
        const industry = strArg(args, 'industry', 'Marine/Offshore');
        const ctx = strArg(args, 'ctx');
        const prompt = `Draft a professional proposal for:
Client: ${client}
Industry: ${industry}
Description: ${desc}
${ctx ? `Context: ${ctx}` : ''}

Include: Executive summary, scope of work, methodology, timeline, pricing structure, terms and conditions.`;
        return await geminiQuery(prompt);
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}

// ── 3. ERP MCP ──────────────────────────────────────────────────────────────

function registerERPServer(gw: MCPGateway): void {
  gw.registerServer('erp', 'ERP integration: customers, products, stock, pricing, sales orders');

  gw.registerTool('erp', {
    name: 'erp_customer_lookup',
    description: 'Look up a customer in the ERP',
    server: 'erp',
    requiresAuth: true,
    parameters: { name: { type: 'string', description: 'Customer name to search', required: true } },
    handler: async (args) => {
      try {
        const name = strArg(args, 'name');
        const { listCustomers } = await import('@/app/dashboard/erp/customers/actions');
        const result = await listCustomers();
        if (!result.success) return `Error: ${result.error}`;
        const matches = result.customers.filter(c =>
          c.customer_name?.toLowerCase().includes(name.toLowerCase())
        );
        if (!matches.length) return `No customers found matching "${name}"`;
        return matches.map(c => `${c.customer_name} (${c.industry || 'N/A'})`).join('\n');
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('erp', {
    name: 'erp_product_catalog',
    description: 'Search the product catalog',
    server: 'erp',
    requiresAuth: true,
    parameters: { q: { type: 'string', description: 'Search query', required: true } },
    handler: async (args) => {
      try {
        const q = strArg(args, 'q').toLowerCase();
        const { listItems } = await import('@/app/dashboard/erp/stock/actions');
        const result = await listItems();
        if (!result.success) return `Error: ${result.error}`;
        const matches = result.items.filter(i =>
          i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q)
        );
        if (!matches.length) return `No products found matching "${strArg(args, 'q')}"`;
        return matches.slice(0, 10).map(i =>
          `${i.item_name} (${i.item_code}) — Rate: ${i.standard_rate || 'N/A'} ${i.item_group}`
        ).join('\n');
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('erp', {
    name: 'erp_stock_check',
    description: 'Check stock for a SKU',
    server: 'erp',
    requiresAuth: true,
    parameters: { sku: { type: 'string', description: 'Item code/SKU', required: true } },
    handler: async (args) => {
      try {
        const sku = strArg(args, 'sku');
        const { listItems } = await import('@/app/dashboard/erp/stock/actions');
        const result = await listItems();
        if (!result.success) return `Error: ${result.error}`;
        const item = result.items.find(i => i.item_code === sku);
        if (!item) return `Item not found: ${sku}`;
        return `${item.item_name} (${item.item_code}) — Safety stock: ${item.safety_stock || 'N/A'}, Rate: ${item.standard_rate || 'N/A'}`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('erp', {
    name: 'erp_pricing',
    description: 'Get pricing for a SKU and quantity',
    server: 'erp',
    requiresAuth: true,
    parameters: {
      sku: { type: 'string', description: 'Item code/SKU', required: true },
      qty: { type: 'number', description: 'Quantity' },
    },
    handler: async (args) => {
      try {
        const sku = strArg(args, 'sku');
        const qty = numArg(args, 'qty', 1);
        const { listItems } = await import('@/app/dashboard/erp/stock/actions');
        const result = await listItems();
        if (!result.success) return `Error: ${result.error}`;
        const item = result.items.find(i => i.item_code === sku);
        if (!item) return `Item not found: ${sku}`;
        const total = (item.standard_rate || 0) * qty;
        return `${item.item_name} — Unit rate: AED ${item.standard_rate || 0}, Qty: ${qty}, Total: AED ${total}`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('erp', {
    name: 'erp_sales_order',
    description: 'Create a sales order in ERP',
    server: 'erp',
    requiresAuth: true,
    parameters: {
      eid: { type: 'string', description: 'Enquiry ID' },
      items: { type: 'string', description: 'JSON array of items' },
    },
    handler: async (args) => {
      try {
        // Parse items and create a quotation (sales order creation needs customer)
        return `Sales order creation requires customer selection. Enquiry: ${strArg(args, 'eid')}, Items: ${strArg(args, 'items')}. Use the ERP UI to complete this action.`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}

// ── 4. Search MCP ───────────────────────────────────────────────────────────

function registerSearchServer(gw: MCPGateway): void {
  gw.registerServer('search', 'Hybrid RAG search: semantic + keyword + rerank');

  gw.registerTool('search', {
    name: 'rag_search',
    description: 'Search RAG vector store (semantic/keyword/hybrid)',
    server: 'search',
    requiresAuth: false,
    parameters: {
      q: { type: 'string', description: 'Search query', required: true },
      limit: { type: 'number', description: 'Max results' },
      method: { type: 'string', description: 'Search method: semantic, keyword, hybrid', enum: ['semantic', 'keyword', 'hybrid'] },
    },
    handler: async (args) => {
      try {
        const q = strArg(args, 'q');
        const method = strArg(args, 'method', 'hybrid');
        const limit = numArg(args, 'limit', 5);
        const { ragSearch } = await import('@/app/actions/rag');
        const result = await ragSearch(q, method, limit);
        if (!result.success) return `Error: ${result.error}`;
        if (!result.results.length) return 'No results';
        return result.results.map(r =>
          `[${r.score.toFixed(3)}] ${r.source_path || '?'} — ${r.content.slice(0, 300)}...`
        ).join('\n');
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}

// ── 5. Mutator MCP ──────────────────────────────────────────────────────────

function registerMutatorServer(gw: MCPGateway): void {
  gw.registerServer('mutator', 'AI-generated UI dashboards, forms, reports, kanban boards');

  gw.registerTool('mutator', {
    name: 'generate_ui_form',
    description: 'Generate a dynamic form UI schema',
    server: 'mutator',
    requiresAuth: true,
    parameters: {
      name: { type: 'string', description: 'Form name', required: true },
      desc: { type: 'string', description: 'Form description' },
      fields: { type: 'string', description: 'JSON array of field definitions' },
    },
    handler: async (args) => {
      try {
        const { generateId } = await import('@/lib/uuid');
        const fields = strArg(args, 'fields');
        const dashboard = await prisma.ui_dashboards.create({
          data: {
            id: generateId(),
            name: strArg(args, 'name', 'Untitled Form'),
            ui_type: 'form',
            schema_json: JSON.stringify({ fields: fields ? JSON.parse(fields) : [], description: strArg(args, 'desc') }),
            is_active: true,
          },
        });
        return `Form created: ${dashboard.name} (id: ${dashboard.id})`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('mutator', {
    name: 'generate_dashboard',
    description: 'Generate a dashboard UI with charts/stats/tables',
    server: 'mutator',
    requiresAuth: true,
    parameters: {
      name: { type: 'string', description: 'Dashboard name', required: true },
      desc: { type: 'string', description: 'Dashboard description' },
      metrics: { type: 'string', description: 'JSON array of metric definitions' },
    },
    handler: async (args) => {
      try {
        const { generateId } = await import('@/lib/uuid');
        const metrics = strArg(args, 'metrics');
        const dashboard = await prisma.ui_dashboards.create({
          data: {
            id: generateId(),
            name: strArg(args, 'name', 'Untitled Dashboard'),
            ui_type: 'dashboard',
            schema_json: JSON.stringify({ metrics: metrics ? JSON.parse(metrics) : [], description: strArg(args, 'desc') }),
            is_active: true,
          },
        });
        return `Dashboard created: ${dashboard.name} (id: ${dashboard.id})`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('mutator', {
    name: 'generate_report',
    description: 'Generate a structured report layout',
    server: 'mutator',
    requiresAuth: true,
    parameters: {
      name: { type: 'string', description: 'Report name', required: true },
      desc: { type: 'string', description: 'Report description' },
      sections: { type: 'string', description: 'JSON array of section definitions' },
    },
    handler: async (args) => {
      try {
        const { generateId } = await import('@/lib/uuid');
        const sections = strArg(args, 'sections');
        const dashboard = await prisma.ui_dashboards.create({
          data: {
            id: generateId(),
            name: strArg(args, 'name', 'Untitled Report'),
            ui_type: 'report',
            schema_json: JSON.stringify({ sections: sections ? JSON.parse(sections) : [], description: strArg(args, 'desc') }),
            is_active: true,
          },
        });
        return `Report created: ${dashboard.name} (id: ${dashboard.id})`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('mutator', {
    name: 'generate_kanban',
    description: 'Generate a kanban board layout',
    server: 'mutator',
    requiresAuth: true,
    parameters: {
      name: { type: 'string', description: 'Kanban name', required: true },
      desc: { type: 'string', description: 'Kanban description' },
      columns: { type: 'string', description: 'JSON array of column definitions' },
    },
    handler: async (args) => {
      try {
        const { generateId } = await import('@/lib/uuid');
        const columns = strArg(args, 'columns');
        const dashboard = await prisma.ui_dashboards.create({
          data: {
            id: generateId(),
            name: strArg(args, 'name', 'Untitled Kanban'),
            ui_type: 'kanban',
            schema_json: JSON.stringify({ columns: columns ? JSON.parse(columns) : [], description: strArg(args, 'desc') }),
            is_active: true,
          },
        });
        return `Kanban created: ${dashboard.name} (id: ${dashboard.id})`;
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}

// ── 6. Media MCP ────────────────────────────────────────────────────────────

function registerMediaServer(gw: MCPGateway): void {
  gw.registerServer('media', 'AI-generated images and speech');

  gw.registerTool('media', {
    name: 'generate_image',
    description: 'Generate an image from a text description',
    server: 'media',
    requiresAuth: true,
    parameters: {
      prompt: { type: 'string', description: 'Image description', required: true },
      aspect_ratio: { type: 'string', description: 'Aspect ratio (1:1, 16:9, etc.)' },
      image_size: { type: 'string', description: 'Image size' },
    },
    handler: async (args) => {
      try {
        // Gemini image generation — still calls Python backend for now
        const res = await fetch(`${API_BASE}/ai/generate-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'image',
            prompt: strArg(args, 'prompt'),
            aspect_ratio: strArg(args, 'aspect_ratio', '1:1'),
            image_size: strArg(args, 'image_size', '1024x1024'),
          }),
        });
        if (!res.ok) return `Error: Image generation failed (${res.status})`;
        const data = await res.json();
        return data.url || data.message || 'Image generated';
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('media', {
    name: 'generate_speech',
    description: 'Convert text to speech audio',
    server: 'media',
    requiresAuth: true,
    parameters: {
      text: { type: 'string', description: 'Text to speak', required: true },
      voice_name: { type: 'string', description: 'Voice name' },
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${API_BASE}/ai/generate-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speech',
            text: strArg(args, 'text'),
            voice_name: strArg(args, 'voice_name', 'Kore'),
          }),
        });
        if (!res.ok) return `Error: Speech generation failed (${res.status})`;
        const data = await res.json();
        return data.url || data.message || 'Speech generated';
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}

// ── 7. SAP MCP (stub — stays as Python microservice) ──────────────────────

function registerSAPServer(gw: MCPGateway): void {
  gw.registerServer('sap', 'SAP integration: material master, stock, transactional drafts');

  gw.registerTool('sap', {
    name: 'sap_material_master',
    description: 'Search SAP material master',
    server: 'sap',
    requiresAuth: true,
    parameters: { q: { type: 'string', description: 'Search query', required: true } },
    handler: async (args) => {
      return `SAP material master search for "${strArg(args, 'q')}" — Not yet implemented. Requires SAP integration.`;
    },
  });

  gw.registerTool('sap', {
    name: 'sap_stock',
    description: 'Check SAP stock for a SKU',
    server: 'sap',
    requiresAuth: true,
    parameters: { sku: { type: 'string', description: 'SKU', required: true } },
    handler: async (args) => {
      return `SAP stock check for "${strArg(args, 'sku')}" — Not yet implemented. Requires SAP integration.`;
    },
  });

  gw.registerTool('sap', {
    name: 'sap_sales_order',
    description: 'Create SAP sales order',
    server: 'sap',
    requiresAuth: true,
    parameters: {
      eid: { type: 'string', description: 'Enquiry ID' },
      items: { type: 'string', description: 'JSON array of items' },
    },
    handler: async (args) => {
      return `SAP sales order for enquiry ${strArg(args, 'eid')} — Not yet implemented. Requires SAP integration.`;
    },
  });
}

// ── 8. Outlook MCP (stub — stays as Python microservice) ──────────────────

function registerOutlookServer(gw: MCPGateway): void {
  gw.registerServer('outlook', 'Outlook/Email integration: send proposals, schedule meetings');

  gw.registerTool('outlook', {
    name: 'outlook_send_proposal',
    description: 'Send a proposal email via Outlook',
    server: 'outlook',
    requiresAuth: true,
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' },
    },
    handler: async (args) => {
      return `Email to ${strArg(args, 'to')} — Not yet implemented. Requires Outlook/Microsoft Graph integration.`;
    },
  });

  gw.registerTool('outlook', {
    name: 'outlook_schedule_meeting',
    description: 'Schedule a meeting via Outlook',
    server: 'outlook',
    requiresAuth: true,
    parameters: {
      subject: { type: 'string', description: 'Meeting subject', required: true },
      attendees: { type: 'string', description: 'Attendee emails (comma-separated)' },
      start: { type: 'string', description: 'Start time (ISO)' },
      duration: { type: 'number', description: 'Duration in minutes' },
    },
    handler: async (args) => {
      return `Meeting "${strArg(args, 'subject')}" — Not yet implemented. Requires Outlook/Microsoft Graph integration.`;
    },
  });
}

// ── 9. Document Output MCP (stays as Python microservice — reportlab/openpyxl) ─

function registerDocumentOutputServer(gw: MCPGateway): void {
  gw.registerServer('document_output', 'Generate PDF proposals, quote files, internal summaries');

  gw.registerTool('document_output', {
    name: 'generate_proposal_pdf',
    description: 'Generate a proposal PDF',
    server: 'document_output',
    requiresAuth: true,
    parameters: {
      eid: { type: 'string', description: 'Enquiry ID' },
      content: { type: 'string', description: 'Proposal content' },
      client: { type: 'string', description: 'Client name' },
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${API_BASE}/documents/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'proposal_pdf',
            enquiry_id: strArg(args, 'eid'),
            content: strArg(args, 'content'),
            client_name: strArg(args, 'client'),
          }),
        });
        if (!res.ok) return `Error: Document generation failed (${res.status})`;
        const data = await res.json();
        return data.url || data.message || 'Document generated';
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('document_output', {
    name: 'generate_quote_file',
    description: 'Generate a quote spreadsheet',
    server: 'document_output',
    requiresAuth: true,
    parameters: {
      eid: { type: 'string', description: 'Enquiry ID' },
      pricing: { type: 'string', description: 'Pricing data JSON' },
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${API_BASE}/documents/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'quote_file',
            enquiry_id: strArg(args, 'eid'),
            pricing_data: strArg(args, 'pricing'),
          }),
        });
        if (!res.ok) return `Error: Quote generation failed (${res.status})`;
        const data = await res.json();
        return data.url || data.message || 'Quote generated';
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });

  gw.registerTool('document_output', {
    name: 'generate_internal_summary',
    description: 'Generate an internal summary',
    server: 'document_output',
    requiresAuth: true,
    parameters: {
      eid: { type: 'string', description: 'Enquiry ID' },
      summary: { type: 'string', description: 'Summary content' },
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${API_BASE}/documents/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'internal_summary',
            enquiry_id: strArg(args, 'eid'),
            summary: strArg(args, 'summary'),
          }),
        });
        if (!res.ok) return `Error: Summary generation failed (${res.status})`;
        const data = await res.json();
        return data.url || data.message || 'Summary generated';
      } catch (e: any) {
        return `Error: ${e?.message}`;
      }
    },
  });
}
