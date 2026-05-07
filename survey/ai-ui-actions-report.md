# AI-Driven UI Actions — Architecture Report

## 1. What Already Exists (Your Backend is Sophisticated)

Your backend ALREADY has a full tool-calling agent loop:

- **AgentLoop** (`backend/app/services/agent_loop.py`): Full ReAct-style loop with Gemini
  - Builds system prompt from persona config
  - Injects tool declarations based on `persona.allowed_tools`
  - Executes tools via MCP Gateway
  - Feeds results back into conversation
  - Returns `tool_calls`, `tool_results`, `rounds`

- **MCP Gateway** (`backend/app/mcp_servers/gateway.py`): 9 servers, ~30 tools
  - Wiki (read/write/search/list)
  - Gemini (query/classify/draft)
  - ERP (customer_lookup, stock_check, pricing, sales_order)
  - SAP, Outlook, Document Output, Search, Mutator, Media

- **Personas** have `allowed_tools`, `allowed_mcp_servers`, `allowed_collections`
  - Dex: wiki + gemini
  - Viz: + erp_accounts, erp_stock, generate_dashboard, generate_report
  - Avery: + erp_personnel, erp_assets, erp_projects

- **Chat endpoint** (`POST /ai/chat/{persona_id}`) returns:
  ```json
  { "conversation_id", "message_id", "role", "content", "tool_calls" }
  ```
  BUT `tool_calls` is NOT currently returned in `ChatResponse` schema — the field exists but the Pydantic model filters it out. Backend saves tool calls to DB, frontend never sees them.

## 2. What I Broke in Phase 1 Port

**ALL 12 ported ERP pages are missing `usePageContext()` calls.**

The `usePageContext(dataSummary)` hook feeds page state into the Zustand store so the AI chat panel knows what the user is looking at. Without it:
- AI chat has ZERO context about what ERP page the user is on
- The `[Context: User is on the "X" page...]` prefix in `sendMessage()` is empty
- AI replies are generic instead of page-aware

**Fix needed:** Add `usePageContext()` back to every ported page with a meaningful data summary.

## 3. The Gap: Backend Tools vs. UI Actions

Your backend tools are **data/query tools** — they fetch/manipulate data:
- `erp_stock_check("SKU-001")` → returns stock level
- `wiki_search("BOSIET requirements")` → returns wiki content

What you want are **UI action tools** — they manipulate the frontend:
- `open_create_customer_dialog()` → opens the "Add Customer" dialog
- `fill_form_field({ field: "customer_name", value: "ADNOC" })` → fills a field
- `set_filter({ category: "EQUIPMENT" })` → filters the table
- `navigate_to("/erp/quotations")` → changes page

**Critical insight:** These should NOT execute on the backend. The backend has no DOM, no React state, no component refs. UI actions MUST execute client-side.

## 4. Architecture Options (Without Vercel AI SDK)

### Option A: Backend-Forwards Client Tools (Recommended)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│    Gemini    │
│  (React)     │◀────│  (FastAPI)   │◀────│   (Google)   │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │
        │ 1. Send message    │
        │    + page context  │
        │    + server tools  │
        │    + client tools  │
        │────────────────────▶│
        │                    │
        │                    │ 2. Call Gemini with ALL tools
        │                    │    (server + client declarations)
        │                    │
        │                    │ 3. Gemini returns tool call
        │                    │    → "open_create_customer_dialog"
        │                    │
        │ 4. Backend detects │
        │    this is a       │
        │    CLIENT tool     │
        │◀───────────────────│
        │    Returns special │
        │    response type   │
        │                    │
        │ 5. Frontend executes
        │    the UI action   │
        │    (opens dialog)  │
        │                    │
        │ 6. Frontend sends  │
        │    "tool result"   │
        │    back to backend │
        │────────────────────▶│
        │                    │
        │                    │ 7. Backend feeds result to Gemini
        │                    │    → gets final text response
        │                    │
        │ 8. Final text      │
        │◀───────────────────│
```

**Pros:** Single LLM call, natural conversation flow, backend controls tool scoping  
**Cons:** Requires backend to distinguish client vs server tools, needs SSE/streaming for real-time feel

### Option B: Frontend-First Tool Calling (Simpler for Demo)

```
┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│    Gemini    │
│  (React)     │◀────│   (Direct)   │
└──────────────┘     └──────────────┘

1. User sends message
2. Frontend calls Gemini API DIRECTLY with:
   - system prompt (page context)
   - function declarations (UI actions only)
3. If Gemini returns function call → execute in browser
4. If Gemini returns text → show in chat
5. For data queries → call existing backend chat endpoint
```

**Pros:** No backend changes, instant UI feedback, full control  
**Cons:** Two API surfaces (frontend→Gemini + frontend→Backend), no shared conversation history

### Option C: Prompt-Based Action Parsing (Quickest)

```
1. Frontend sends message to backend as usual
2. Backend prompt includes:
   "You can also suggest UI actions using this format:
    [UI_ACTION:open_dialog|dialog=create_customer]
    [UI_ACTION:fill_field|field=customer_name|value=ADNOC]"
3. Frontend parses `[UI_ACTION:...]` markers from response text
4. Executes them immediately
```

**Pros:** Zero backend schema changes, works with existing endpoint  
**Cons:** Fragile (LLM might not follow format), no structured validation, hacky

## 5. Recommended Approach for Your Stack

**Go with Option A (Backend-Forwards) but with a hybrid twist:**

### Step 1: Extend ChatResponse to expose tool_calls

Currently `ChatResponse` only returns `content`. The backend SAVES `tool_calls` to DB but doesn't return them. Fix:

```python
class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    role: str
    content: str
    tool_calls: list | None = None      # Already defined but not populated
    client_actions: list | None = None  # NEW: UI actions for frontend
```

### Step 2: Mark tools as "client" vs "server"

Two ways:

**A) Naming convention:** `ui_*` prefix = client tool (e.g., `ui_open_dialog`, `ui_fill_field`)
**B) Separate registry:** `client_tools = [...]` alongside `allowed_tools`

### Step 3: AgentLoop detects client tools

In `_execute_tool()`, before executing, check if it's a client tool:

```python
async def _execute_tool(self, tool_name: str, args: dict) -> str:
    if tool_name.startswith("ui_"):
        # Don't execute — mark for frontend
        raise ClientToolException(tool_name, args)
    # ... existing server tool execution
```

Agent loop catches `ClientToolException`, stops the loop, returns:
```json
{
  "content": "I'll open the create customer dialog for you.",
  "client_actions": [
    {"name": "ui_open_dialog", "args": {"dialog": "create_customer"}}
  ]
}
```

### Step 4: Frontend executes client actions

```typescript
// In useAppStore sendMessage()
const data = await res.json();

// Execute any client actions
if (data.client_actions) {
  for (const action of data.client_actions) {
    executeClientAction(action.name, action.args);
  }
}
```

### Step 5: Page-scoped action registry

Each page exports what UI actions it supports:

```typescript
// app/erp/customers/page.tsx
export const customerPageActions = [
  {
    name: "ui_open_create_dialog",
    description: "Open the 'Add New Customer' dialog",
    parameters: {}
  },
  {
    name: "ui_filter_customers",
    description: "Filter the customer list by status or search term",
    parameters: {
      status: { type: "string", enum: ["active", "inactive", "all"] },
      search: { type: "string" }
    }
  },
  {
    name: "ui_fill_customer_form",
    description: "Fill a field in the customer creation form",
    parameters: {
      field: { type: "string", enum: ["customer_name", "customer_code", ...] },
      value: { type: "string" }
    }
  }
];
```

These get sent to backend alongside the message:
```typescript
body: JSON.stringify({
  message: fullMessage,
  channel: "web",
  client_actions: customerPageActions  // NEW
})
```

Backend includes them in Gemini tool declarations.

### Step 6: Global action dispatcher

```typescript
// store/useActionDispatcher.ts
const actionHandlers: Record<string, Function> = {};

export function registerAction(name: string, handler: Function) {
  actionHandlers[name] = handler;
}

export function executeClientAction(name: string, args: any) {
  const handler = actionHandlers[name];
  if (handler) handler(args);
  else console.warn(`No handler for action: ${name}`);
}
```

Each page registers its handlers on mount:
```typescript
useEffect(() => {
  registerAction("ui_open_create_dialog", () => setDialogOpen(true));
  registerAction("ui_fill_customer_form", ({ field, value }) => 
    setForm(prev => ({ ...prev, [field]: value }))
  );
  return () => { unregisterAction("ui_open_create_dialog"); ... };
}, []);
```

## 6. Without Vercel AI SDK — Raw Implementation

Since you want to avoid Vercel AI SDK, here's the raw Gemini function calling flow:

```typescript
// Direct Gemini API call from frontend (or backend)
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: message }] }],
      tools: [{
        function_declarations: pageActions.map(a => ({
          name: a.name,
          description: a.description,
          parameters: { type: "object", properties: a.parameters }
        }))
      }]
    })
  }
);

const data = await response.json();
const candidate = data.candidates[0];

// Check for function calls
for (const part of candidate.content.parts) {
  if (part.functionCall) {
    executeClientAction(part.functionCall.name, part.functionCall.args);
  }
}
```

## 7. What I Should Do Now

1. **Fix the broken `usePageContext()` calls** on all 12 ported ERP pages
2. **Pick ONE page** (Customers is ideal — simple CRUD, clear actions) and implement:
   - Page-scoped `aiActions` export
   - Action registration in the component
   - Backend schema extension for `client_actions`
   - AgentLoop modification to detect/handle client tools
   - Frontend execution of returned actions
3. **Demo flow:** User types "Create a new customer called Gulf Marine" → AI opens dialog → fills "customer_name" → user sees it happen live

## 8. Files to Touch

| File | Change |
|------|--------|
| `backend/app/api/routes/ai.py` | Add `client_actions` to ChatResponse, pass to AgentLoop |
| `backend/app/services/agent_loop.py` | Detect client tools, return without executing |
| `frontend/src/store/useAppStore.ts` | Execute client_actions from response, send page actions |
| `frontend/src/store/useActionDispatcher.ts` | NEW: Global action registry |
| `frontend/src/app/erp/customers/page.tsx` | Add usePageContext, aiActions export, register handlers |
| All `frontend/src/app/erp/*/page.tsx` | Add usePageContext with data summary |
