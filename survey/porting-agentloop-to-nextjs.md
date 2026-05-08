# Porting the Python AgentLoop to Next.js

**Date:** 2026-05-08  
**Scope:** Multi-round tool-calling loop, SSE/streaming chat, and feed-tool-results-back-to-model  
**Status:** Audit + Design — no code changes yet

---

## 1. What We Have Today

### Next.js Side (Current)

| Capability | Status | Implementation |
|------------|--------|---------------|
| Single AI call with function calling | ✅ WORKS | `planUIActions()` → one Gemini `generateContent` call → parse function calls → execute handlers |
| Tool schema conversion (Gemini/OpenAI/Anthropic) | ✅ WORKS | `ai-tool-adapters.ts` — `toToolSpec()`, `parseResponse()` |
| Tool result formatting helpers | ✅ BUILT BUT UNUSED | `formatGeminiFunctionResponse()`, `formatOpenAIToolResult()`, `formatAnthropicToolResult()` — never called |
| MCP tool registry + single dispatch | ✅ WORKS | `mcp-gateway.ts` — 9 servers, 20+ tools |
| Action dispatcher (14 ERP pages) | ✅ WORKS | `useActionDispatcher` — `create_customer`, `navigate_to_*`, `set_*_search`, etc. |
| **Multi-round tool-calling loop** | ❌ | Does not exist — Track 1 is single-shot |
| **SSE/streaming chat** | ❌ | Does not exist — `chatWithPersona()` waits for full JSON response |
| **Feed tool results back to model** | ❌ | Does not exist — `executeFunctionCalls()` is fire-and-forget |

### Python Side (Current — to be ported)

| Capability | File | How It Works |
|------------|------|-------------|
| Multi-round tool-calling loop | `backend/app/services/agent_loop.py` | `while rounds < 10: call model → parse tool_calls → execute tools via MCP gateway → feed results back → repeat` |
| MCP gateway with real handlers | `backend/app/mcp_servers/gateway.py` | 9 servers, 20+ tools — wiki, gemini, erp, search, mutator, media, document_output |
| Persona-driven system prompts | `agent_loop.py` `_build_system_prompt()` | Persona `about` + `knowledge_base_prompt` + wiki context + allowed tools list |
| Conversation history management | `agent_loop.py` `_build_contents()` | Last 20 messages from DB, system prompt as first user message |
| Tool declaration generation | `agent_loop.py` `_get_tool_declarations()` | Builds `types.FunctionDeclaration` from MCP gateway tools — **BUT uses lazy generic schema** (same 3 params for all tools) |
| Streaming | ❌ NOT implemented | Python AgentLoop uses non-streaming `generateContent()` too |

### Auth & API Access

| Method | Works? | Details |
|--------|--------|---------|
| Vertex AI native REST (`generateContent`) | ✅ | Uses ephemeral OAuth token from `/api/v1/ai/token` → `Bearer` auth → works today |
| Gemini SDK (Python `google.genai`) | ✅ | Python backend uses this — works with `GCA_KEY` service account |
| Chat Completions API (OpenAI-compatible) | ❌ TESTED | `https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/endpoints/openapi/chat/completions` returns 404 for all model names — project may not have access |
| `GOOGLE_CLOUD_API_KEY` (API key auth) | ❌ | Returns `API_KEY_SERVICE_BLOCKED` — Chat Completions endpoint requires OAuth token, not API key |

**Conclusion:** We should port using the **native Vertex AI REST API** (`generateContent` / `streamGenerateContent`), not the Chat Completions API. The native API is already proven to work with our project's auth setup.

---

## 2. The Three Missing Pieces

### 2.1 Multi-Round Tool-Calling Loop

**What it is:** An agentic loop where the AI can call tools, see the results, and decide whether to call more tools or return a final answer.

**Current gap:** `planUIActions()` calls Gemini once, gets function calls, executes them, and stops. If the AI needs to call `wiki_read` then `gemini_query` based on the wiki result, it can't — there's no loop.

**Python AgentLoop algorithm:**
```
while rounds < MAX_TOOL_ROUNDS:
  response = call_gemini(contents, tools)
  if no tool_calls in response:
    return response.text  # done!
  for each tool_call:
    result = execute_tool(tool_call.name, tool_call.args)
    append tool_call + tool_result to contents
  # loop continues — model sees all previous tool results
```

**Ported to Next.js:**
```typescript
async function agentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const { systemPrompt, userMessage, tools, history, maxRounds = 10 } = options;
  const contents = buildContents(systemPrompt, userMessage, history);
  const allToolCalls = [];
  const allToolResults = [];
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const response = await callVertexAI({ contents, tools });
    
    const { toolCalls, textParts } = parseResponse(response);
    
    if (toolCalls.length === 0) {
      return { content: textParts.join("\n"), toolCalls: allToolCalls, toolResults: allToolResults, rounds };
    }
    
    // Execute tool calls
    const toolResults = [];
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.args);
      toolResults.push({ name: tc.name, result });
      allToolCalls.push(tc);
      allToolResults.push({ name: tc.name, result });
    }
    
    // Feed results back into conversation
    contents.push({ role: "assistant", tool_calls: toolCalls });
    for (const tr of toolResults) {
      contents.push({ role: "tool", tool_call_id: tr.name, content: tr.result });
    }
  }
  
  return { content: "Max rounds reached", toolCalls: allToolCalls, toolResults: allToolResults, rounds };
}
```

### 2.2 SSE/Streaming Chat

**What it is:** The AI response streams token-by-token to the browser via Server-Sent Events, instead of waiting for the full response.

**Current gap:** `chatWithPersona()` does `await fetch(...) → await res.json()` — the user sees nothing until the entire AgentLoop finishes (can be 10-30 seconds with multiple tool rounds).

**How to implement in Next.js:**

**Option A: Server Action + streaming (simplest)**
- Next.js Server Actions can return `ReadableStream` via experimental streaming
- The server creates a `ReadableStream` that yields SSE-formatted chunks
- The client reads the stream with `EventSource` or `fetch` + `reader`

**Option B: API Route (recommended)**
- Create `app/api/ai/chat/route.ts` that returns `new Response(stream, { headers: { "Content-Type": "text/event-stream" } })`
- The route runs the AgentLoop server-side
- After each tool round, it yields an SSE event with the tool call/result
- After the final text response, it yields text tokens as they stream from Gemini
- Client uses `fetch()` with `reader = response.body.getReader()` to read events

**Gemini supports streaming:** The `streamGenerateContent` endpoint returns chunks via SSE. We can use this for the final text response.

**SSE event format:**
```
event: tool_call
data: {"name": "wiki_read", "args": {"path": "concepts/marine-insurance"}}

event: tool_result  
data: {"name": "wiki_read", "result": "Marine insurance covers..."}

event: tool_call
data: {"name": "gemini_query", "args": {"question": "What coverage types..."}

event: tool_result
data: {"name": "gemini_query", "result": "The main types are..."}

event: text_delta
data: {"content": "Based on"}

event: text_delta
data: {"content": " my research..."}

event: done
data: {"rounds": 2, "tool_calls": 2}
```

### 2.3 Feed Tool Results Back to Model

**What it is:** After executing a tool call, the result must be sent back to the model as a `role: "tool"` message (Chat Completions format) or `functionResponse` part (Gemini native format). The model then decides what to do next.

**Current gap:** `executeFunctionCalls()` in `gemini-client.ts` runs handlers and stops. The results never go back to the model.

**How to implement with Gemini native API:**

The Gemini `generateContent` API uses this format for multi-turn tool calling:

```json
// After model returns a functionCall:
{
  "contents": [
    { "role": "user", "parts": [{ "text": "..." }] },
    { "role": "model", "parts": [{ "functionCall": { "name": "wiki_read", "args": { "path": "..." } } }] },
    { "role": "user", "parts": [{ "functionResponse": { "name": "wiki_read", "response": { "result": "..." } } }] }
  ]
}
// Then call generateContent again with these contents — model sees the tool result
```

This is exactly what `ai-tool-adapters.ts` already has building blocks for:
- `formatGeminiFunctionResponse()` — formats tool results as `functionResponse` parts ✅ (just never called)
- `parseGeminiResponse()` — parses `functionCall` from response ✅
- `toGeminiToolSpec()` — converts actions to `functionDeclarations` ✅

---

## 3. Architecture After Porting

```
┌───────────────────────────────────────────────────────────┐
│  Next.js (Full AI Stack — No Python Backend Needed)      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  AgentLoop (lib/agent-loop.ts)                      │  │
│  │  while rounds < 10:                                │  │
│  │    call Gemini with tools + conversation history    │  │
│  │    if no tool_calls → stream text response → done   │  │
│  │    execute tool calls via MCP gateway               │  │
│  │    feed results back into conversation              │  │
│  │    yield SSE events to client                       │  │
│  └─────────────────────────────────────────────────────┘  │
│       │                    │                               │
│       ▼                    ▼                               │
│  ┌──────────┐    ┌──────────────────┐                     │
│  │ Vertex AI│    │ MCP Gateway      │                     │
│  │ REST API │    │ (lib/mcp-gateway)│                     │
│  │          │    │                  │                     │
│  │ generate │    │ wiki_read/write  │                     │
│  │ Content  │    │ erp_customer_*   │                     │
│  │ stream   │    │ gemini_query     │                     │
│  │ Generate │    │ rag_search       │                     │
│  │ Content  │    │ generate_dashboard│                    │
│  └──────────┘    └──────────────────┘                     │
│       │                                                   │
│  ┌────▼──────────────────────────────────────────────┐    │
│  │ Auth: Ephemeral Token via /api/ai/token           │    │
│  │ (minted from GCA_KEY service account)             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ SSE API Route (app/api/ai/chat/route.ts)           │  │
│  │ → Returns text/event-stream                        │  │
│  │ → Streams tool_call, tool_result, text_delta, done │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Chat Panel (ai-chat-panel.tsx)                     │  │
│  │ → fetch() with ReadableStream                      │  │
│  │ → Renders tool calls, streaming text, thinking     │  │
│  │ → UI actions from Track 1 still work in parallel   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘

Python backend still needed for:
- Wiki git-vault CRUD (wiki/*)
- Document upload/OCR
- Media generation (Imagen, TTS)
- PDF/Excel generation
```

---

## 4. Implementation Plan

### Phase 1: AgentLoop Core (lib/agent-loop.ts)

Create `lib/agent-loop.ts` with:
- `agentLoop()` — multi-round tool-calling loop using Gemini native REST API
- `buildContents()` — converts conversation history + tool results to Gemini `contents` format
- `callGemini()` — single `generateContent` call with retry logic
- `parseToolCalls()` — extract `functionCall` parts from response
- `formatFunctionResponse()` — uses `ai-tool-adapters.ts` helper (finally wired up!)
- Tool execution via `mcp-gateway.ts` `callTool()` method

**Key decision:** Run the AgentLoop on the **server side** (API route or Server Action), not in the browser. Reasons:
1. MCP gateway tool handlers import Prisma — server-only code
2. Tool results can be large — no need to send them to browser and back
3. Token minting happens server-side already
4. The browser just needs the streaming text output + tool call metadata for UI

### Phase 2: SSE Streaming API Route (app/api/ai/chat/route.ts)

Create `POST` handler that:
1. Validates auth cookie
2. Loads persona from Prisma
3. Runs `agentLoop()` 
4. Yields SSE events as the loop progresses
5. After loop completes, streams final text response using `streamGenerateContent`

### Phase 3: Chat Panel Upgrade (ai-chat-panel.tsx)

Update the chat panel to:
1. Replace `chatWithPersona()` (Server Action, waits for full JSON) with `fetch('/api/ai/chat')` + stream reading
2. Display tool calls as they happen (expandable cards showing tool name + result)
3. Stream text tokens progressively (character-by-character like ChatGPT)
4. Keep Track 1 (UI action planner) running in parallel for immediate UI actions

### Phase 4: Enhanced Tool Schemas

Fix the Python AgentLoop's lazy schema problem. Each MCP tool should have **proper typed schemas**:

```typescript
// Instead of generic { query, path, question } for every tool:
const toolSchemas = {
  wiki_read: { properties: { path: { type: "string", description: "Wiki page path" } }, required: ["path"] },
  wiki_search: { properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  erp_customer_lookup: { properties: { name: { type: "string" } }, required: ["name"] },
  gemini_query: { properties: { question: { type: "string" }, context: { type: "string" } }, required: ["question"] },
  // ...
};
```

The MCP gateway's `list_tools()` already returns `name` and `description` — we add `parameters` (JSON Schema) to each tool registration.

### Phase 5: Conversation Persistence

Port the Python conversation/message saving to Next.js:
- Save `user`, `assistant`, `tool_call`, `tool_result` messages to `ai_messages` table via Prisma
- Load last N messages as context for next conversation turn
- Show conversation history in the AI Chat page

---

## 5. File Map

| New File | Purpose |
|----------|---------|
| `lib/agent-loop.ts` | Multi-round tool-calling loop using Gemini native REST API |
| `app/api/ai/chat/route.ts` | SSE streaming API route that runs AgentLoop server-side |
| `lib/gemini-stream.ts` | Helper for reading `streamGenerateContent` SSE chunks |
| `lib/tool-schemas.ts` | Proper typed JSON Schema definitions for each MCP tool |

| Modified File | Change |
|---------------|--------|
| `lib/gemini-client.ts` | Add `callGeminiGenerateContent()` for agent loop use; keep `planUIActions()` for Track 1 |
| `lib/ai-tool-adapters.ts` | Wire up `formatGeminiFunctionResponse()` — used by agent loop |
| `lib/mcp-gateway.ts` | Add `parameters` (JSON Schema) to each tool registration |
| `app/dashboard/ai-chat-panel.tsx` | Replace `chatWithPersona()` with streaming fetch; add tool call display |
| `store/useAppStore.ts` | Update `sendMessage()` to use streaming endpoint |
| `app/dashboard/ai/actions.ts` | Add `saveMessage()`, `loadConversation()` for persistence |

---

## 6. Why Not Chat Completions API?

We tested the Gemini Chat Completions API (`/endpoints/openapi/chat/completions`) and it returned 404 for all model names. This endpoint:
- Requires the OpenAI-compatible `google/model-name` format
- Needs OAuth token (API key auth is blocked)
- May not be enabled for our GCP project
- Has limited model support compared to native API

The **native Vertex AI REST API** (`generateContent` / `streamGenerateContent`) works perfectly with our project. It supports:
- Function calling (tool use)
- Streaming
- Multi-turn conversations with `functionResponse`
- All Gemini models including `gemini-3-flash-preview`, `gemini-3.1-pro-preview`

**Recommendation:** Port using the native Gemini REST API. The `ai-tool-adapters.ts` already has OpenAI and Anthropic adapters ready if we want to add multi-provider support later.

---

## 7. What Stays in Python

After porting, the Python backend is still needed for:

| Feature | Reason |
|---------|--------|
| Wiki git-vault CRUD | WikiService reads/writes markdown files from disk — not portable to serverless |
| Document upload + OCR | MarkItDown → Gemini extract pipeline |
| Media generation | Gemini Imagen + TTS — proxied through Python |
| PDF/Excel generation | reportlab/openpyxl — Python-only libraries |
| SAP/Outlook integrations | External system connectors (currently stubs) |

The AgentLoop, chat, tool calling, and conversation management all move to Next.js.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Long-running AgentLoop may timeout on serverless/Vercel | Use `maxDuration` config; or self-host with `bun start` |
| Tool results can be large (wiki pages) | Truncate tool results to 10KB before feeding back (Python already does this) |
| Gemini rate limits during multi-round loops | Add tenacity retry logic (like Python's `@retry`) with exponential backoff |
| Browser CORS for direct Vertex AI calls | AgentLoop runs server-side in API route — no CORS issue |
| Streaming SSE may not work with Next.js middleware | API routes bypass page middleware; streaming is supported natively |

---

## 9. Migration Order (Recommended)

1. ✅ **Commit current work** (link fixes, sidebar, Python backend fixes)
2. **Create `lib/agent-loop.ts`** — core loop, non-streaming first
3. **Create `app/api/ai/chat/route.ts`** — SSE route
4. **Update chat panel** — streaming fetch + tool call display
5. **Add tool schemas** — proper JSON Schema for each MCP tool
6. **Add conversation persistence** — save messages to Prisma
7. **Test end-to-end** — verify "Create a customer named Acme Marine" works through full AgentLoop
8. **Deprecate Python `/ai/chat/{personaId}`** — switch all chat traffic to Next.js API route
9. **Remove Python AgentLoop** — once fully ported and tested
