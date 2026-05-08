# AgentLoop Port: File-by-File Modification Report

**Date:** 2026-05-08
**Scope:** De-link Next.js from Python backend for AI/chat, add unified AgentLoop
**Python code:** Stays as-is — we only touch Next.js files

---

## Executive Summary

The codebase has a **dual-track architecture** for AI:
- **Track 1 (Fast):** Browser → Gemini Vertex AI directly (ephemeral token from Python `/ai/token`) — for UI action planning
- **Track 2 (Slow):** Next.js Server Action → `fetch` to Python `:8001/ai/chat/{personaId}` → Python `AgentLoop` → Gemini with MCP tool-calling → response

**The goal:** Replace Track 2 with a unified `AgentLoop` running entirely in Next.js server-side, calling the **Gemini Chat Completions API** directly, and using the existing `mcp-gateway.ts` for tool execution. Track 1 stays but needs its token source ported to Next.js.

**Key discovery:** The Gemini Chat Completions API (`aiplatform.googleapis.com/v1beta1/.../endpoints/openapi/chat/completions`) works with both API key (`?key=`) and OAuth Bearer auth. No region prefix in hostname.

---

## Complete File Manifest

| # | File | Action | Priority | Summary |
|---|------|--------|----------|---------|
| 1 | `lib/agent-loop.ts` | **CREATE** | 🔴 High | The unified AgentLoop class — calls Gemini Chat Completions, loops on tool calls, returns final text |
| 2 | `app/api/ai/chat/route.ts` | **CREATE** | 🔴 High | SSE streaming chat endpoint — runs AgentLoop, streams tokens |
| 3 | `app/api/ai/token/route.ts` | **CREATE** | 🟡 Medium | Ephemeral token endpoint — replaces Python `/ai/token` |
| 4 | `app/api/ai/ui-plan/route.ts` | **CREATE** | 🟡 Medium | UI planning proxy — replaces Python `/ai/ui-plan` |
| 5 | `app/dashboard/ai/actions.ts` | **MODIFY** | 🔴 High | Replace `chatWithPersona()` fetch→Python with in-process AgentLoop. Replace conversation queries with direct Prisma. Remove `API_BASE` import. |
| 6 | `lib/gemini-client.ts` | **MODIFY** | 🟡 Medium | Change token source from `${API_BASE}/ai/token` to `/api/ai/token`. Change proxy from `${API_BASE}/ai/ui-plan` to `/api/ai/ui-plan`. |
| 7 | `store/useAppStore.ts` | **MODIFY** | 🟢 Low | Update error message (remove "port 8001"). Optional: SSE streaming. |
| 8 | `app/dashboard/ai-chat-panel.tsx` | **MODIFY** | 🟢 Low | Optional: streaming message display instead of typing dots. |
| 9 | `app/dashboard/ai/page.tsx` | **MODIFY** | 🟢 Low | Optional: streaming. Works automatically once Server Action is ported. |
| 10 | `app/dashboard/notebooks/editor/[id]/page.tsx` | **MODIFY** | 🟡 Medium | Replace raw `fetch` to Python with fetch to `/api/ai/chat` SSE endpoint. |
| 11 | `app/dashboard/documents/[id]/page.tsx` | **MODIFY** | 🟢 Low | Already uses Server Action — works automatically after port. |

### Files that stay unchanged:
- `lib/ai-tool-adapters.ts` — Reused as-is
- `lib/mcp-gateway.ts` — Reused as-is (media/doc-output Python calls stay out of scope)
- `store/useActionDispatcher.ts` — Reused as-is (Track 1)
- `lib/api-base.ts` — Stays for wiki/media/doc-output proxy calls
- `lib/api.ts` — Stays for non-AI ERP CRUD
- `prisma/schema.prisma` — No changes needed
- `app/api/mcp/*` — No changes (already use mcp-gateway)

---

## 1. Files That Currently Call the Python Backend for AI

### 1.1 `app/dashboard/ai/actions.ts` — **MODIFY** (core target)

**Current behavior:**
- `chatWithPersona()` (L274): `fetch(${API_BASE}/ai/chat/${personaId})` → Python AgentLoop
- `listConversations()` (L315): `fetch(${API_BASE}/ai/conversations)` → Python endpoint
- `getConversationMessages()` (L327): `fetch(${API_BASE}/ai/conversations/{id}/messages)` → Python endpoint
- `getGeminiToken()` (L340): Already mints tokens locally via `google-auth-library` — **no Python needed**

**Changes needed:**
- `chatWithPersona()`: Replace `fetch` to Python with call to new `AgentLoop` class that runs in-process:
  1. Look up persona from Prisma
  2. Load conversation history from Prisma
  3. Get persona's allowed tools from `mcp-gateway.ts`
  4. Run `AgentLoop.run()` which calls Gemini Chat Completions API
  5. Save messages to `ai_conversations`/`ai_messages` via Prisma
  6. Return the response
- `listConversations()` / `getConversationMessages()`: Replace `fetch` to Python with direct Prisma queries
- Remove `API_BASE` import

### 1.2 `lib/gemini-client.ts` — **MODIFY**

**Current behavior:**
- `callVertexAIDirect()`: fetches ephemeral token from `${API_BASE}/ai/token` (Python) then calls Vertex AI REST
- `callAIViaProxy()`: calls `${API_BASE}/ai/ui-plan` (Python) as fallback

**Changes needed:**
- Token source: Replace `fetch(${API_BASE}/ai/token)` (L137) with `fetch('/api/ai/token')` (new Next.js API route)
- Proxy fallback: Replace `fetch(${API_BASE}/ai/ui-plan)` (L168) with `fetch('/api/ai/ui-plan')` (new Next.js API route)
- Rest of file (adapter usage, function call execution) stays unchanged

### 1.3 `app/dashboard/notebooks/editor/[id]/page.tsx` — **MODIFY**

**Current behavior:**
- Directly calls `${apiBase}/ai/chat/presales_assistant` (L107) with SSE streaming — bypasses Server Action layer

**Changes needed:**
- Replace raw `fetch` to Python with `fetch('/api/ai/chat')` SSE endpoint (new Next.js route)
- This preserves the streaming UX already implemented here

### 1.4 `lib/mcp-gateway.ts` — **NO CHANGE** for AgentLoop port

**Current behavior:**
- 9 servers, ~20 tools with real handlers
- Media MCP (L612, L642) still calls `${API_BASE}/ai/generate-media`
- Document Output MCP (L757, L787, L817) still calls `${API_BASE}/documents/generate`
- Wiki helper (L119) calls `${API_BASE}/wiki/*`

**Why no change:** Media/Doc-Output/Wiki still need Python — out of scope for this port. The `getPersonaTools()` and `callTool()` methods will be used by the new AgentLoop as-is.

### 1.5 `store/useAppStore.ts` — **MODIFY** (minor)

**Current behavior:**
- `sendMessage()` (L160): dual-track — (1) `planUIActions()` Track 1, (2) `chatWithPersona()` Server Action Track 2
- Error message references "port 8001" (L172)

**Changes needed:**
- Update error message (remove "port 8001")
- The `chatWithPersona` import stays — Server Action signature won't change, only implementation
- Optional V2: refactor `sendMessage()` for SSE streaming consumption

---

## 2. New Files to Create

### 2.1 `lib/agent-loop.ts` — **CREATE** (the core deliverable)

```typescript
// Unified AgentLoop — calls Gemini Chat Completions API, loops on tool calls
// Mirrors backend/app/services/agent_loop.py but uses Chat Completions format

import { getGeminiToken } from "@/app/dashboard/ai/actions";
import { MCPGateway } from "@/lib/mcp-gateway";
import { getAdapter } from "@/lib/ai-tool-adapters";

interface AgentLoopOptions {
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];  // OpenAI format
  history: ChatCompletionMessage[];  // OpenAI format
  maxRounds?: number;
  model?: string;
  temperature?: number;
}

interface AgentLoopResult {
  content: string;
  toolCalls: { name: string; args: Record<string, any>; result: string }[];
  rounds: number;
}

export class AgentLoop {
  private gateway = MCPGateway.getInstance();

  async run(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const { systemPrompt, userMessage, tools, history, maxRounds = 10, model, temperature } = options;
    const messages = this.buildMessages(systemPrompt, userMessage, history);
    const allToolCalls = [];
    let rounds = 0;

    while (rounds < maxRounds) {
      rounds++;
      const response = await this.callGemini(messages, tools, model, temperature);
      const choice = response.choices[0];
      const msg = choice.message;

      if (!msg.tool_calls?.length) {
        return { content: msg.content || "", toolCalls: allToolCalls, rounds };
      }

      // Add assistant message with tool calls to conversation
      messages.push(msg);

      // Execute tool calls and feed results back
      for (const tc of msg.tool_calls) {
        const { name, arguments: argsJson } = tc.function;
        const args = JSON.parse(argsJson);
        const result = await this.gateway.callTool(name, args);
        allToolCalls.push({ name, args, result });

        // Feed result back as "tool" role message
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      }
    }

    return { content: "Max rounds reached", toolCalls: allToolCalls, rounds };
  }

  private buildMessages(systemPrompt, userMessage, history) { /* ... */ }
  private async callGemini(messages, tools, model, temperature) { /* fetch to Chat Completions endpoint */ }
}
```

**API to call:** `GEMINI_CHAT_COMPLETIONS_URL` from `.env`
**Auth:** API key as `?key=` query param (simplest, confirmed working)
**Dependencies:** `lib/ai-tool-adapters.ts`, `lib/mcp-gateway.ts`, `google-auth-library`

### 2.2 `app/api/ai/chat/route.ts` — **CREATE** (SSE streaming endpoint)

```typescript
// SSE streaming chat endpoint — replaces Python /ai/chat/{persona_id}
// POST { personaId, message, conversationId? }
// Returns: text/event-stream with tool_call, tool_result, text_delta, done events

export async function POST(req: Request) {
  const { personaId, message, conversationId } = await req.json();

  // 1. Load persona from Prisma
  // 2. Load/create conversation
  // 3. Save user message
  // 4. Get persona tools from mcp-gateway → convert to Chat Completions tools
  // 5. Build system prompt from persona config
  // 6. Run AgentLoop with streaming
  // 7. Stream SSE events:
  //    event: tool_call    → { name, args }
  //    event: tool_result  → { name, result }
  //    event: text_delta   → { content }
  //    event: done         → { rounds, tool_calls }
  // 8. Save assistant message to Prisma

  const stream = new ReadableStream({ async start(controller) { /* ... */ } });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### 2.3 `app/api/ai/token/route.ts` — **CREATE**

```typescript
// Ephemeral OAuth token endpoint — replaces Python /ai/token
// GET → { token, expires_at, project_id }
// Uses same google-auth-library code already in ai/actions.ts:getGeminiToken()
```

### 2.4 `app/api/ai/ui-plan/route.ts` — **CREATE**

```typescript
// UI planning proxy — replaces Python /ai/ui-plan
// POST { message, page_context, page_label, actions, provider, tool_spec }
// Returns: parsed function calls
// Logic already exists in gemini-client.ts:callAIViaProxy()
```

---

## 3. Existing AI Infrastructure (Reusable As-Is)

| File | What It Has | How AgentLoop Uses It |
|------|------------|----------------------|
| `lib/ai-tool-adapters.ts` | `toOpenAIToolSpec()`, `parseOpenAIResponse()`, `formatOpenAIToolResult()` | Convert MCP tools → Chat Completions format; parse Gemini responses |
| `lib/mcp-gateway.ts` | `getPersonaTools()`, `callTool()`, `listTools()` | Get available tools for persona; execute tool calls from model |
| `store/useActionDispatcher.ts` | Track 1 UI action registry | Not used by AgentLoop — Track 1 stays separate |
| `app/actions/rag.ts` | Reference pattern for Python→Next.js port | Follow same pattern: Prisma + direct Gemini calls |

---

## 4. Prisma Schema (No Changes Needed)

The schema already supports everything the AgentLoop needs:

| Model | Key Fields for AgentLoop |
|-------|------------------------|
| `ai_personas` | `model`, `temperature`, `allowed_tools`, `allowed_mcp_servers`, `about`, `knowledge_base_prompt`, `greeting` |
| `ai_conversations` | `id`, `persona_id`, `user_id`, `title` |
| `ai_messages` | `role`, `content`, `tool_calls` (JSON), `tool_call_id`, `tool_name`, `metadata_json` |

---

## 5. Dependency Graph

```
BEFORE (Python-dependent):
  ai/actions.ts ──fetch──→ Python :8001/ai/chat ──→ AgentLoop.py ──→ Gemini SDK ──→ MCP Gateway.py
  gemini-client.ts ──fetch──→ Python :8001/ai/token (for ephemeral token)
  gemini-client.ts ──fetch──→ Python :8001/ai/ui-plan (proxy fallback)
  notebooks/page.tsx ──fetch──→ Python :8001/ai/chat/presales_assistant (SSE)

AFTER (Next.js self-contained):
  ai/actions.ts ──→ AgentLoop.ts ──fetch──→ Gemini Chat Completions API ──→ mcp-gateway.ts
       ↓                    ↓                        ↓
  Prisma              toOpenAIToolSpec()        aiplatform.googleapis.com
  (personas,           from ai-tool-adapters.ts    ?key= or Bearer token
  conversations,
  messages)

  gemini-client.ts ──fetch──→ /api/ai/token (Next.js API route)
  gemini-client.ts ──fetch──→ /api/ai/ui-plan (Next.js API route)
  notebooks/page.tsx ──fetch──→ /api/ai/chat (Next.js SSE endpoint)
```

---

## 6. Environment Variables (Already in .env)

```env
GEMINI_CHAT_COMPLETIONS_URL=https://aiplatform.googleapis.com/v1beta1/projects/project-9a3e09d5-57ca-491d-a74/locations/us-central1/endpoints/openapi/chat/completions
GEMINI_CHAT_MODEL=google/gemini-3-flash-preview
GOOGLE_CLOUD_API_KEY=AQ.Ab8RN6LwLb1e...  # Works as ?key= query param
GCA_KEY={"type":"service_account",...}     # Works as Bearer OAuth token
```

---

## 7. Implementation Order

1. **Create `lib/agent-loop.ts`** — core loop, non-streaming first
2. **Create `app/api/ai/token/route.ts`** — so Track 1 doesn't need Python for tokens
3. **Create `app/api/ai/ui-plan/route.ts`** — so Track 1 proxy doesn't need Python
4. **Modify `app/dashboard/ai/actions.ts`** — replace Python fetch with AgentLoop call
5. **Modify `lib/gemini-client.ts`** — point token/ui-plan at new Next.js routes
6. **Create `app/api/ai/chat/route.ts`** — SSE streaming endpoint
7. **Modify `app/dashboard/notebooks/editor/[id]/page.tsx`** — point at new SSE route
8. **Modify `store/useAppStore.ts`** — update error message, optional streaming
9. **Modify `app/dashboard/ai-chat-panel.tsx`** — optional streaming display
10. **Test end-to-end** — "Create a customer named Acme Marine" through full AgentLoop
11. **Deprecate Python `/ai/chat/{personaId}`** — switch all chat traffic to Next.js

---

## 8. What Stays in Python (No Changes)

| Feature | Reason |
|---------|--------|
| Wiki git-vault CRUD | WikiService reads/writes markdown files from disk |
| Document upload + OCR | MarkItDown → Gemini extract pipeline |
| Media generation | Gemini Imagen + TTS — proxied through Python |
| PDF/Excel generation | reportlab/openpyxl — Python-only libraries |
| MCP media/doc-output tools | Still call `${API_BASE}` — out of scope |
| Non-AI CRUD endpoints | ERP data, RAG search, notebooks — via `lib/api.ts` SWR hooks |
