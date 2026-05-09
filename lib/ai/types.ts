/**
 * Shared AI type definitions.
 *
 * Centralises interfaces used across AI route handlers,
 * dashboard server actions, and streaming SSE endpoints.
 */

// ── Chat message types (Chat Completions format) ────────────────────────────

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

// ── Persona types ───────────────────────────────────────────────────────────

/** Raw Prisma row shape for ai_personas (JSON fields still as strings) */
export interface PersonaRow {
  id: string;
  username: string;
  nickname: string;
  position: string;
  category: string;
  about: string | null;
  greeting: string | null;
  model: string;
  temperature: number;
  allowed_tools: string | string[] | null;
  allowed_collections: string | string[] | null;
  allowed_mcp_servers: string | string[] | null;
  enable_knowledge_base: boolean;
  knowledge_base_prompt: string | null;
  enabled: boolean;
  built_in: boolean;
  created_at: Date;
  updated_at: Date;
}

// ── AI tool call types ──────────────────────────────────────────────────────

/** Shape of a tool call returned by the Chat Completions API */
export interface APIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/** Parsed function call returned by the ui-plan route */
export interface ParsedFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

// ── SSE event types ─────────────────────────────────────────────────────────

export interface SSEToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  callId: string;
}

export interface SSEToolResultEvent {
  name: string;
  result: string;
  callId: string;
}

export interface SSETextDeltaEvent {
  content: string;
}

export interface SSEDoneEvent {
  content: string;
  rounds: number;
  model: string;
  toolCalls: number;
  conversationId: string;
}

export interface SSEErrorEvent {
  error: string;
}

// ── UI Action spec (for ui-plan route) ──────────────────────────────────────

export interface UIActionSpec {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

// ── Prisma where-clause helpers ─────────────────────────────────────────────

/** Generic where clause for Prisma queries with dynamic keys */
export type PrismaWhereClause = Record<string, unknown>;

// ── Conversation / Message list types ───────────────────────────────────────

export interface ConversationRow {
  id: string;
  persona_id: string;
  channel: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  tool_calls: string | unknown[] | null;
  tool_call_id: string | null;
  created_at: Date;
}

// ── Pipeline deal types ─────────────────────────────────────────────────────

export interface PipelineDeal {
  id: string;
  title: string;
  amount: number;
  stage: string;
  created_at: string;
}

// ── Enquiry status enum ─────────────────────────────────────────────────────

export const ENQUIRY_STATUSES = [
  "DRAFT",
  "OPEN",
  "POLICY_REVIEW",
  "LLM_DRAFTED",
  "QUOTATION",
  "APPROVED",
  "CONVERTED",
  "CLOSED",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

// ── Document extracted data ─────────────────────────────────────────────────

export interface ExtractedItem {
  description: string;
  quantity?: string | number;
  unit_price?: string | number;
  total: string | number;
}

export interface ExtractedData {
  seller?: { name: string; tax_id?: string };
  client?: { name: string; tax_id?: string };
  invoice_number?: string;
  date_of_issue?: string;
  summary?: { currency?: string; total?: number };
  items?: ExtractedItem[];
  [key: string]: unknown;
}
