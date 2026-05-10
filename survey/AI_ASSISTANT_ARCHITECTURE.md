# AI Assistant Architecture — Aries ERP

> A real-world, code-first guide to how the Aries ERP webapp's AI assistant works.  
> Every snippet below is copied directly from the project codebase.

---

## 1. What the User Sees

### Header Button (Top-Right)

Open `app/dashboard/app-layout.tsx`. On desktop, a button in the fixed header toggles the right-sidebar chat panel:

```tsx
// app/dashboard/app-layout.tsx  (lines 96-109)
<header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
  {/* ... left side: hamburger + "Aries ERP" ... */}

  {/* Right side: chat toggle */}
  <div className="flex items-center gap-2">
    <button
      onClick={toggleChat}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        chatOpen
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <MessageSquare size={14} />
      <span className="hidden sm:inline text-xs">AI Assistant</span>
    </button>
  </div>
</header>
```

When `chatOpen` is true, the main content area animates its right margin so the chat panel doesn't overlap:

```tsx
// app/dashboard/app-layout.tsx  (lines 123-132)
const chatWidth = chatOpen ? 320 : 0;

<motion.main
  className="min-h-screen p-4 pt-16"
  animate={{
    marginLeft: sidebarWidth,
    marginRight: chatWidth,
  }}
  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
>
  <ErrorBoundary>{children}</ErrorBoundary>
</motion.main>
```

### AI Chat Panel (Right Sidebar)

The panel lives in `app/dashboard/ai-chat-panel.tsx`. It shows:
- A header with the current page badge (e.g. **"Customers"**)
- A persona selector dropdown
- Message bubbles (markdown-rendered)
- Quick-action chips: *Summarize this page*, *Create Record*, *Export Data*, *Help*
- A textarea input

```tsx
// app/dashboard/ai-chat-panel.tsx  (lines 62-72)
<aside className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-slate-200 dark:border-slate-700 bg-[#f1f5f9] dark:bg-slate-900">
  {/* Header */}
  <div className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4">
    <div className="flex items-center gap-2">
      <Sparkles size={18} className="text-[#0ea5e9]" />
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Assistant</span>
      {currentPageLabel && (
        <span className="rounded-full bg-[#0ea5e9]/10 px-2 py-0.5 text-[10px] font-medium text-[#0ea5e9]">
          {currentPageLabel}
        </span>
      )}
    </div>
    {/* ... persona selector + close button ... */}
  </div>
```

---

## 2. How the AI Knows What Page You're On

### Step 1: Every Page Reports Its Context

Each ERP page calls `usePageContext(dataSummary)` — a hook that reads the current Next.js pathname and pushes a human-readable label + data summary into the global Zustand store.

```tsx
// hooks/usePageContext.ts
const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/erp/accounts": "Accounts & Finance",
  "/erp/assets": "Assets & Equipment",
  "/erp/stock": "Stock & Inventory",
  "/erp/projects": "Projects",
  "/erp/hr": "HR & Personnel",
  "/erp/procurement": "Procurement",
  "/documents": "Documents & OCR",
};

export function usePageContext(dataSummary?: string) {
  const pathname = usePathname();
  const { setPageContext } = useAppStore();

  useEffect(() => {
    const label =
      ROUTE_LABELS[pathname] ||
      pathname
        .split("/")
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" > ") ||
      "Unknown";

    setPageContext(label, dataSummary || "");
  }, [pathname, dataSummary, setPageContext]);
}
```

### Step 2: The Customers Page Builds a Live Summary

```tsx
// app/dashboard/erp/customers/customers-client.tsx  (lines 48-52)
const contextSummary = customers.length > 0
  ? `Customers page: ${customers.length} customers total. ${customers.filter(c => c.status === "active").length} active. Recent: ${customers.slice(0, 3).map(c => c.customer_name).join(", ")}.`
  : "Customers page: No customers loaded.";
usePageContext(contextSummary);
```

So if the user has 5 customers and 3 are active, the AI sees:

> `[Context: User is on the "Customers" page. Visible data summary: Customers page: 5 customers total. 3 active. Recent: Acme Corp, Beta Ltd, Gamma Inc.]`

### Step 3: Page Changes Inject a System Message

When the user navigates from one page to another, `setPageContext` adds a silent system message to the chat history so the LLM knows the context shifted:

```tsx
// store/useAppStore.ts  (lines 140-155)
setPageContext: (label, dataSummary) => {
  const prevLabel = get().currentPageLabel;
  set({ currentPageLabel: label, currentPageData: dataSummary });

  // Inject system message when user navigates to a different page
  if (prevLabel && prevLabel !== label && get().messages.length > 1) {
    const navMsg: ChatMessage = {
      id: `page-change-${Date.now()}`,
      sender: "system",
      content: `[User navigated to "${label}" page. Available actions and context have changed.]`,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, navMsg] }));
  }
},
```

---

## 3. Dual-Track Architecture

When the user sends a message, **two things happen in parallel**:

| Track | Speed | Purpose | Where |
|-------|-------|---------|-------|
| **Track 1 — Fast UI Actions** | ~50-150ms | Plan & execute UI mutations (open dialog, fill form, search, navigate) | Browser → Vertex AI directly |
| **Track 2 — Slow Streaming Chat** | ~1-5s | Full reasoning, data queries, conversational reply | Browser → `/api/ai/chat` → AgentLoop |

```tsx
// store/useAppStore.ts  (lines 197-222)
// ═══════════════════════════════════════════════════════════════
// DUAL-TRACK ARCHITECTURE
// ═══════════════════════════════════════════════════════════════

const dispatcher = useActionDispatcher.getState();
const registeredActions = dispatcher.actions;
const handlers = dispatcher.handlers;

// Track 1: Plan UI actions (only if we have registered actions on this page)
const uiPlanPromise =
  registeredActions.length > 0
    ? planUIActions({
        message: content,
        pageContext: context,
        pageLabel,
        actions: registeredActions,
        direct: true, // Use ephemeral token → direct Vertex AI call
      })
    : Promise.resolve([] as FunctionCall[]);

// Track 2: Chat with streaming — uses SSE endpoint /api/ai/chat
const chatStreamingPromise = fetch("/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ personaId, message: fullMessage }),
});
```

---

## 4. How the AI Reads Information

### 4a. Page Context is Prepended to Every Message

```tsx
// store/useAppStore.ts  (lines 188-195)
const context = pageContext || get().currentPageData;
const pageLabel = get().currentPageLabel;
const contextPrefix = context
  ? `[Context: User is on the "${pageLabel}" page. Visible data summary: ${context.slice(0, 800)}]`
  : "";

const actionDescriptions = useActionDispatcher.getState().getActionDescriptions();
const fullMessage = contextPrefix + actionDescriptions + "\n\n" + content;
```

The `fullMessage` sent to the LLM looks like this:

```
[Context: User is on the "Customers" page. Visible data summary: Customers page: 5 customers total. 3 active. Recent: Acme Corp, Beta Ltd, Gamma Inc.]

## Available UI Actions on this page:
- create_customer: Open and fill the create customer form... Parameters: customer_name* (string), customer_code* (string), industry (string: oil_gas/marine/renewable/construction/other), credit_limit (number)...
- set_customer_search: Filter the customer list by search term. Parameters: term* (string).
- navigate_to_customer: Navigate to a specific customer's detail page. Parameters: customer_id* (string).

Add a customer named Oceanic Drilling with code OD-2024 in the oil & gas industry
```

### 4b. MCP Data Tools (Server-Side)

The **slow track** (`AgentLoop`) can also call **data tools** via the `MCPGateway` — these query the database, search the wiki, check stock, etc.

```ts
// lib/mcp-gateway.ts  (conceptual — erp_customer_lookup tool)
gw.registerTool('erp', {
  name: 'erp_customer_lookup',
  description: 'Look up a customer in the ERP',
  handler: async (args) => {
    const { listCustomers } = await import('@/app/dashboard/erp/customers/actions');
    const result = await listCustomers();
    // ... filter and return string
  },
});
```

When the AgentLoop runs, it builds tools from the persona's `allowed_tools` list and passes them to the Chat Completions API. If the model decides to call `erp_customer_lookup`, the gateway executes it server-side and feeds the result back into the conversation.

---

## 5. How the AI Takes Actions

### 5a. Per-Page Action Registration

Every page that wants AI interactivity registers its available **UIActions** with JSON Schema. Here's the **Customers page** registering three actions:

```tsx
// app/dashboard/erp/customers/customers-client.tsx  (lines 59-140)
const { registerActions, unregisterActions } = useActionDispatcher();

useEffect(() => {
  registerActions(
    [
      defineAction({
        name: "create_customer",
        description: "Open and fill the create customer form with the provided details. Opens dialog and fills all fields in one shot.",
        parameters: {
          type: "object",
          required: ["customer_name", "customer_code"],
          properties: {
            customer_name: { type: "string", description: "Customer name (required)" },
            customer_code: { type: "string", description: "Unique customer code (required)" },
            contact_person: { type: "string", description: "Contact person name" },
            email: { type: "string", description: "Email address" },
            phone: { type: "string", description: "Phone number" },
            address: { type: "string", description: "Business address" },
            industry: { type: "string", description: "Industry sector", enum: ["oil_gas", "marine", "renewable", "construction", "other"] },
            tax_id: { type: "string", description: "Tax ID / TRN number" },
            credit_limit: { type: "number", description: "Credit limit in AED" },
          },
        },
      }),
      defineAction({
        name: "set_customer_search",
        description: "Filter the customer list by search term",
        parameters: {
          type: "object",
          required: ["term"],
          properties: { term: { type: "string", description: "Search term to filter by" } },
        },
      }),
      defineAction({
        name: "navigate_to_customer",
        description: "Navigate to a specific customer's detail page",
        parameters: {
          type: "object",
          required: ["customer_id"],
          properties: { customer_id: { type: "string", description: "Customer UUID to navigate to" } },
        },
      }),
    ],
    {
      // ═════ HANDLER MAP ═════
      // These functions directly mutate React state / navigate
      create_customer: (args: Record<string, any>) => {
        setDialogOpen(true);
        setForm((prev) => ({
          ...prev,
          customer_name: args.customer_name || prev.customer_name,
          customer_code: args.customer_code || prev.customer_code,
          contact_person: args.contact_person || prev.contact_person,
          email: args.email || prev.email,
          phone: args.phone || prev.phone,
          address: args.address || prev.address,
          industry: args.industry || prev.industry,
          tax_id: args.tax_id || prev.tax_id,
          credit_limit: args.credit_limit != null ? String(args.credit_limit) : prev.credit_limit,
        }));
        // Briefly highlight all filled fields
        const filledFields = Object.keys(args).filter(k => k !== "customer_name" && k !== "customer_code");
        if (filledFields.length > 0) {
          setAiFilledField(filledFields[0]);
          setTimeout(() => setAiFilledField(null), 1200);
        }
        toast.info("AI opened and filled the customer form", { icon: <Wand2 size={14} /> });
      },
      set_customer_search: (args: Record<string, any>) => {
        setSearch(args.term);
        toast.info(`AI filtered customers by "${args.term}"`, { icon: <Sparkles size={14} /> });
      },
      navigate_to_customer: (args: Record<string, any>) => {
        router.push(`/dashboard/erp/customers/${args.customer_id}`);
      },
    }
  );
  return () => unregisterActions();
}, [registerActions, unregisterActions, router]);
```

**Key insight:** The `defineAction()` calls describe the *shape* of the action (name, description, parameters). The handler map describes *what happens* when the AI triggers it. Both are registered together, and both are cleaned up on unmount via `unregisterActions()`.

### 5b. Visual Feedback When AI is Active

The customers page listens to the global `uiActionActive` flag and shows a pulsing banner:

```tsx
// app/dashboard/erp/customers/customers-client.tsx  (lines 142-146, 199-204)
const uiActionActive = useAppStore((s) => s.uiActionActive);
useEffect(() => {
  setAiActive(uiActionActive);
}, [uiActionActive]);

{aiActive && (
  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-sm animate-pulse">
    <Sparkles size={14} className="animate-spin" />
    <span>AI is controlling the interface...</span>
  </div>
)}
```

AI-filled form fields also get a temporary indigo ring:

```tsx
<Input
  value={form.customer_name}
  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
  className={aiFilledField === "customer_name" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
/>
```

### 5c. The Action Dispatcher Store

This is the registry that holds all currently-available UI actions and their handlers:

```ts
// store/useActionDispatcher.ts  (lines 57-86)
export const useActionDispatcher = create<ActionDispatcherState>((set, get) => ({
  actions: [],
  handlers: new Map(),

  registerActions: (actions, handlerMap) => {
    const handlers = new Map<string, (args: Record<string, any>) => void>();
    Object.entries(handlerMap).forEach(([name, handler]) => {
      handlers.set(name, handler);
    });
    set({ actions, handlers });
  },

  unregisterActions: () => {
    set({ actions: [], handlers: new Map() });
  },

  executeAction: (name, args) => {
    const handler = get().handlers.get(name);
    if (!handler) {
      console.warn(`[ActionDispatcher] No handler registered for action: ${name}`);
      return false;
    }
    try {
      handler(args);
      return true;
    } catch (e) {
      console.error(`[ActionDispatcher] Action ${name} failed:`, e);
      return false;
    }
  },
  // ...
}));
```

---

## 6. Fast Track: `planUIActions` (Browser → Vertex AI)

This is where the magic of "AI opens and fills a form in 150ms" happens.

### Step 1: Get an Ephemeral Token

No long-lived API key lives in the browser. Instead, the backend mints a short-lived OAuth token from a service account:

```ts
// lib/gemini-client.ts  (lines 130-152)
async function getEphemeralToken(): Promise<{ token: string; projectId: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { token: cachedToken.token, projectId: cachedToken.projectId };
  }

  const res = await fetch(`/api/ai/token`);
  const data = await res.json();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600 * 1000;

  cachedToken = { token: data.token, expiresAt, projectId: data.project_id };
  return { token: data.token, projectId: data.project_id };
}
```

### Step 2: Convert Actions → Provider Format

The same canonical `UIAction[]` is converted to Gemini's `functionDeclarations` format via the adapter pattern:

```ts
// lib/ai-tool-adapters.ts  (lines 30-44)
export function toGeminiToolSpec(actions: UIAction[]): Record<string, any> {
  return {
    functionDeclarations: actions.map((action) => {
      const decl: Record<string, any> = {
        name: action.name,
        description: action.description,
      };
      if (action.parameters) {
        decl.parameters = convertSchemaToGemini(action.parameters);
      }
      return decl;
    }),
  };
}
```

### Step 3: Call Vertex AI Directly from the Browser

```ts
// lib/gemini-client.ts  (lines 73-125)
async function callVertexAIDirect(options: PlanOptions): Promise<FunctionCall[]> {
  const { message, pageContext, pageLabel, actions, model = "gemini-3-flash-preview" } = options;
  const adapter = getAdapter("gemini");

  const auth = await getEphemeralToken();
  const toolSpec = adapter.toToolSpec(actions);

  const prompt = `You are a UI action planner for an ERP web app. The user is on the "${pageLabel}" page.

Page context: ${pageContext.slice(0, 600)}

User request: ${message}

Decide which UI actions (if any) to execute immediately. Only call functions directly relevant to the request. Infer reasonable form values from the user's message. If the user is just asking a question, do not call any functions.`;

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [toolSpec],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.1 },
    }),
  });

  const data = await response.json();
  return adapter.parseResponse(data); // → [{ name: "create_customer", args: { ... } }]
}
```

### Step 4: Execute with Staggered Animation

```ts
// lib/gemini-client.ts  (lines 194-222)
export async function executeFunctionCalls(
  calls: FunctionCall[],
  handlers: Map<string, (args: Record<string, any>) => void>,
  options: { staggerMs?: number; onExecute?: (call: FunctionCall) => void } = {}
): Promise<void> {
  const { staggerMs = 150, onExecute } = options;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const handler = handlers.get(call.name);
    if (!handler) continue;

    // Stagger execution for visual effect (dialog opens, then form fills one by one)
    if (i > 0 && staggerMs > 0) {
      await new Promise(r => setTimeout(r, staggerMs));
    }

    handler(call.args);
    onExecute?.(call);
  }
}
```

---

## 7. Slow Track: `AgentLoop` (Server-Side Streaming)

The slow track handles conversational replies, data queries, and complex reasoning. It lives in `lib/agent-loop.ts` and runs inside the `/api/ai/chat` API route.

```ts
// lib/agent-loop.ts  (lines 127-198)
async run(userMessage: string, history?: ChatMessage[]): Promise<AgentLoopResult> {
  const model = this.persona.model || this.defaultModel;
  const tools = this.buildTools();      // From persona.allowed_tools via MCPGateway
  const messages = this.buildMessages(userMessage, history);
  const allToolCalls: ToolCallRecord[] = [];
  let rounds = 0;

  while (rounds < this.maxRounds) {
    rounds++;
    const response = await this.callChatCompletions(messages, tools, model, false);
    const choice = response.choices?.[0];
    if (!choice) break;

    const msg = choice.message;
    const toolCalls = msg?.tool_calls || [];

    // If no tool calls, we have the final text answer
    if (toolCalls.length === 0) {
      return { content: msg?.content || "", toolCalls: allToolCalls, rounds, model };
    }

    // Add assistant message with tool calls to conversation
    messages.push(msg as ChatMessage);

    // Execute each tool call and feed results back
    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const toolArgs = JSON.parse(tc.function.arguments);
      const callId = tc.id;

      const result = await this.gateway.callTool(toolName, toolArgs);
      allToolCalls.push({ name: toolName, args: toolArgs, result, callId });

      // Feed result back as "tool" role message
      messages.push({ role: "tool", tool_call_id: callId, content: result });
    }
  }
  // ...
}
```

The streaming variant (`runStream`) yields SSE events that the frontend consumes token-by-token:

```ts
// lib/agent-loop.ts  (lines 205-346)
async *runStream(userMessage: string, history?: ChatMessage[]): AsyncGenerator<AgentLoopEvent> {
  // ... same loop but yields text_delta, tool_call, tool_result, done events ...
}
```

---

## 8. End-to-End Example: "Add a Customer Named Acme"

Here's the complete flow when the user types that into the AI chat panel while on the Customers page:

### 8a. Message Composition

`useAppStore.sendMessage()` builds:

```
[Context: User is on the "Customers" page. Visible data summary: Customers page: 5 customers total. 3 active. Recent: Acme Corp, Beta Ltd, Gamma Inc.]

## Available UI Actions on this page:
- create_customer: Open and fill the create customer form... Parameters: customer_name* (string), customer_code* (string)...
- set_customer_search: Filter the customer list by search term. Parameters: term* (string).
- navigate_to_customer: Navigate to a specific customer's detail page. Parameters: customer_id* (string).

Add a customer named Acme
```

### 8b. Track 1 Fires (Fast)

`planUIActions()` sends the above prompt + the three `functionDeclarations` to Vertex AI. The model sees the user's intent and returns:

```json
{
  "name": "create_customer",
  "args": {
    "customer_name": "Acme",
    "customer_code": "ACME-001"
  }
}
```

`executeFunctionCalls()` looks up the `create_customer` handler and calls it:

```ts
setDialogOpen(true);
setForm((prev) => ({ ...prev, customer_name: "Acme", customer_code: "ACME-001" }));
toast.info("AI opened and filled the customer form");
```

**The dialog opens and fields are prefilled within ~150ms.**

### 8c. Track 2 Fires (Slow)

In parallel, the `/api/ai/chat` SSE endpoint streams a conversational reply:

> "I've opened the Create Customer form and filled in the name **Acme** with code **ACME-001**. You can add more details and click **Create Customer** to save."

This appears in the chat panel a second or two later.

### 8d. The User Clicks "Create Customer"

The form submit handler is a normal React event — no AI involved here:

```tsx
// app/dashboard/erp/customers/customers-client.tsx  (lines 158-174)
const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  const result = await createCustomer({
    ...form,
    credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined,
  });
  if (result.success) {
    toast.success("Customer created");
    setDialogOpen(false);
    setCustomers((prev) => [result.customer, ...prev]);
  } else {
    toast.error(result.error);
  }
  setSaving(false);
};
```

The `createCustomer` Server Action validates via Zod, inserts into Prisma, and revalidates the path:

```ts
// app/dashboard/erp/customers/actions.ts  (lines 89-142)
export async function createCustomer(data: CreateCustomerInput): Promise<CreateCustomerResponse> {
  const parsed = createCustomerSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  const customer = await prisma.customers.create({
    data: { id: generateId(), status: 'active', ...validated }
  });
  revalidatePath('/erp/customers');
  return { success: true, customer };
}
```

---

## 9. File Map

| File | Role |
|------|------|
| `app/dashboard/app-layout.tsx` | Header bar + AI toggle button + layout margins |
| `app/dashboard/ai-chat-panel.tsx` | Right sidebar chat UI |
| `store/useAppStore.ts` | Global Zustand store: chat state, page context, dual-track `sendMessage()` |
| `store/useActionDispatcher.ts` | UI action registry: `registerActions`, `executeAction`, `defineAction` |
| `hooks/usePageContext.ts` | Reads Next.js pathname → sets page label + data summary in store |
| `lib/gemini-client.ts` | Fast Track: `planUIActions()` + `executeFunctionCalls()` via Vertex AI direct |
| `lib/ai-tool-adapters.ts` | Provider adapters: canonical `UIAction[]` → Gemini / OpenAI / Anthropic formats |
| `lib/agent-loop.ts` | Slow Track: server-side Chat Completions loop with MCP tool calling |
| `lib/mcp-gateway.ts` | Central tool registry for data/ERP tools (wiki, erp, search, etc.) |
| `app/api/ai/chat/route.ts` | SSE streaming endpoint for Track 2 |
| `app/dashboard/erp/customers/customers-client.tsx` | Example page with 3 AI actions + visual feedback |
| `app/dashboard/erp/customers/actions.ts` | Server Actions: `listCustomers`, `createCustomer`, `updateCustomer` |

---

## 10. Key Design Decisions

1. **Dual-track**: UI mutations need to feel instant (~150ms), but LLM reasoning takes seconds. Splitting them lets the UI react immediately while the chat streams the explanation.

2. **Ephemeral tokens**: No API keys in the browser. The backend mints short-lived OAuth tokens so the browser can call Vertex AI directly for speed.

3. **Per-page registration**: Actions are scoped to the page. When you leave the Customers page, `unregisterActions()` clears them. The AI cannot accidentally trigger a customer action from the Invoices page.

4. **Provider-agnostic adapters**: The same `UIAction` JSON Schema works for Gemini, OpenAI, and Anthropic. Swapping providers is a one-line change.

5. **Human-in-the-loop**: The AI opens and fills the form, but the human clicks **Create Customer**. This prevents accidental data mutations and gives the user a chance to review.
