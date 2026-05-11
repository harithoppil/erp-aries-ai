# AI Assistant Impact Audit

Date: 2026-05-11

## 1. Current AI Architecture

The AI assistant operates on a **dual-track architecture** embedded in the main dashboard layout:

### 1.1 Chat Panel (UI Layer)

The `AiChatPanel` is mounted once in `AppLayout` and floats on the right side of every dashboard page. It provides a chat interface with persona selection, message streaming, and quick-action buttons.

- **File**: `app/dashboard/ai-chat-panel.tsx` (lines 18-250)
- **Mounted in**: `app/dashboard/app-layout.tsx` (lines 49, 116)

### 1.2 Page Context System

Every page component calls `usePageContext(dataSummary)` to tell the AI what page the user is viewing and what data is visible. The hook derives a human-readable label from the URL pathname and stores both the label and data summary in the Zustand store.

- **Hook**: `hooks/usePageContext.ts` (lines 80-88)
- **Route matching**: Lines 42-73 parse `/dashboard/erp/{doctype}` and `/dashboard/erp/{doctype}/{name}` patterns
- **Store fields**: `currentPageLabel`, `currentPageData` in `store/useAppStore.ts` (lines 139-156)

### 1.3 Action Dispatcher

Each page registers typed actions (with JSON Schema parameters) via `useActionDispatcher.registerActions()`. The dispatcher is a Zustand store that holds:
- An array of `UIAction` definitions (name, description, JSON Schema params)
- A `Map<string, handler>` of executable handlers keyed by action name

When the user navigates away, the page's `useEffect` cleanup calls `unregisterActions()` to clear the store.

- **Store**: `store/useActionDispatcher.ts` (lines 57-113)
- **Types**: `UIAction` (lines 22-31), `UIActionHandler` (lines 33-36)
- **Helper**: `defineAction()` (lines 163-165)

### 1.4 Dual-Track Execution (in `sendMessage`)

When the user sends a message, `useAppStore.sendMessage()` fires two tracks in parallel:

**Track 1 (Fast) -- UI Action Planning**:
1. Collects registered actions from the dispatcher
2. Sends them to `planUIActions()` in `lib/gemini-client.ts`
3. Gemini returns function calls (e.g. `sales_order_search`, `customer_set_field`)
4. Calls are executed immediately via `executeFunctionCalls()` with staggered animation

**Track 2 (Slow) -- Agent Loop Chat**:
1. POSTs to `/api/ai/chat` SSE endpoint
2. Server runs `AgentLoop` with the persona's system prompt, MCP tools, and conversation history
3. Streams text deltas back to the UI via SSE
4. Also parses `[ACTION:name|param=value]` markers from the response text (slow-track fallback)

- **Store `sendMessage`**: `store/useAppStore.ts` (lines 162-360)
- **Gemini client**: `lib/gemini-client.ts` (lines 51-229)
- **Agent loop**: `lib/agent-loop.ts` (lines 146-577)
- **SSE endpoint**: `app/api/ai/chat/route.ts` (lines 37-222)
- **UI plan proxy**: `app/api/ai/ui-plan/route.ts` (lines 19-117)

### 1.5 Tool Adapters

Provider-agnostic conversion layer. The same `UIAction[]` can be converted to Gemini, OpenAI, or Anthropic tool specs.

- **File**: `lib/ai-tool-adapters.ts` (lines 1-276)
- **Adapters**: `toGeminiToolSpec`, `toOpenAIToolSpec`, `toAnthropicToolSpec`
- **Response parsers**: `parseGeminiResponse`, `parseOpenAIResponse`, `parseAnthropicResponse`

### 1.6 MCP Gateway

Server-side tool registry for persona-level MCP tools (wiki, ERP read, etc.). These are separate from UI actions -- they run in the AgentLoop (Track 2), not the browser.

- **File**: `lib/mcp-gateway.ts` (lines 1-80+)

---

## 2. All Files Involved

### Core Infrastructure

| File | Role |
|------|------|
| `store/useAppStore.ts` | Main Zustand store: chat state, page context, sendMessage with dual-track |
| `store/useActionDispatcher.ts` | Zustand store: action registration, handler map, marker parsing |
| `hooks/usePageContext.ts` | Route-to-label derivation + context setter hook |
| `lib/ai-tool-adapters.ts` | Provider-agnostic tool spec converters |
| `lib/gemini-client.ts` | Browser-side Vertex AI direct call + proxy fallback |
| `lib/agent-loop.ts` | Server-side Chat Completions agent loop with MCP tools |
| `lib/mcp-gateway.ts` | MCP tool registry for server-side agent |

### API Routes

| File | Role |
|------|------|
| `app/api/ai/chat/route.ts` | SSE streaming chat endpoint (Track 2) |
| `app/api/ai/token/route.ts` | Ephemeral OAuth token for browser-side Vertex AI |
| `app/api/ai/ui-plan/route.ts` | Backend proxy for UI action planning |
| `app/api/mcp/tools/route.ts` | MCP tool listing endpoint |
| `app/api/mcp/tools/call/route.ts` | MCP tool execution endpoint |

### UI Components

| File | Role |
|------|------|
| `app/dashboard/ai-chat-panel.tsx` | The chat panel component |
| `app/dashboard/app-layout.tsx` | Dashboard layout -- mounts chat panel |
| `app/dashboard/ai/actions.ts` | Server actions: persona CRUD, chat, token |

### Pages that Register AI Actions (Generic components)

| File | Actions Registered |
|------|-------------------|
| `app/dashboard/erp/[doctype]/GenericListClient.tsx` (lines 260-323) | `{doctype}_search`, `{doctype}_create`, `{doctype}_navigate`, `{doctype}_delete` |
| `app/dashboard/erp/[doctype]/[name]/GenericDetailClient.tsx` (lines 510-587) | `{doctype}_set_field`, `{doctype}_save`, `{doctype}_submit`, `{doctype}_cancel`, `{doctype}_delete` |

### Pages that Register AI Actions (ERP metadata components)

| File | Actions Registered |
|------|-------------------|
| `app/dashboard/erp/components/erp-meta/ERPListClient.tsx` (lines 260-323) | `{doctype}_search`, `{doctype}_create`, `{doctype}_navigate`, `{doctype}_delete` |

### Pages that Register AI Actions (Legacy specialized clients)

| File | Actions Registered |
|------|-------------------|
| `app/dashboard/erp/customers/customers-client.tsx` (lines 64-147) | `create_customer`, `set_customer_search`, `navigate_to_customer` |
| `app/dashboard/erp/timesheets/timesheets-client.tsx` (lines 35-88) | `timesheet_search`, `timesheet_navigate` |
| `app/dashboard/erp/payments/payments-client.tsx` (lines 41-88) | `payment_search`, `payment_navigate` |
| `app/dashboard/erp/journal-entries/journal-entries-client.tsx` (lines 42-99) | `journal_entry_search`, `journal_entry_navigate` |
| `app/dashboard/erp/projects/projects-client.tsx` (lines 63-152) | `project_search`, `project_navigate`, `project_create` |
| `app/dashboard/erp/accounts/accounts-client.tsx` (lines 70-121) | `account_search`, `account_navigate` |
| `app/dashboard/erp/procurement/procurement-client.tsx` (lines 219-266) | `po_search`, `po_navigate` |
| `app/dashboard/erp/hr/hr-client.tsx` (lines 61-118) | `employee_search`, `employee_navigate` |
| `app/dashboard/erp/material-requests/material-requests-client.tsx` (lines 80-129) | `material_request_search`, `material_request_navigate` |
| `app/dashboard/erp/quotations/quotations-client.tsx` (lines 64-117) | `quotation_search`, `quotation_navigate` |
| `app/dashboard/erp/sales-orders/sales-orders-client.tsx` (lines 73-126) | `sales_order_search`, `sales_order_navigate` |
| `app/dashboard/erp/assets/assets-client.tsx` (lines 52-109) | `asset_search`, `asset_navigate` |
| `app/dashboard/channels/channels-client.tsx` (lines 67-101) | `channel_search`, `channel_navigate` |

### Pages that Use `usePageContext` Only (no actions registered)

These 20+ pages call `usePageContext()` to inform the AI what the user sees, but do NOT register any executable actions:

| File | Context Summary |
|------|----------------|
| `app/dashboard/documents/page.tsx` | Static context string |
| `app/dashboard/erp/buying/buying-dashboard-client.tsx` | Dashboard metrics |
| `app/dashboard/erp/buying/invoices/purchase-invoices-client.tsx` | Invoice count + outstanding |
| `app/dashboard/erp/buying/rfq/rfq-client.tsx` | RFQ count |
| `app/dashboard/erp/selling/invoices/sales-invoices-client.tsx` | Invoice count + outstanding |
| `app/dashboard/erp/crm/contracts/contracts-client.tsx` | Contract count |
| `app/dashboard/erp/crm/opportunities/opportunities-client.tsx` | Opportunity count + total |
| `app/dashboard/erp/crm/leads/leads-client.tsx` | Lead count |
| `app/dashboard/erp/setup/fiscal-years/fiscal-years-client.tsx` | Fiscal year count |
| `app/dashboard/erp/setup/company/company-client.tsx` | Company count |
| `app/dashboard/erp/manufacturing/work-orders/work-orders-client.tsx` | Work order count |
| `app/dashboard/erp/accounts/budgets/budgets-client.tsx` | Budget count |
| `app/dashboard/erp/accounts/bank-accounts/bank-accounts-client.tsx` | Bank account count |
| `app/dashboard/erp/accounts/cost-centers/cost-centers-client.tsx` | Cost center count |
| `app/dashboard/erp/support/issues/issues-client.tsx` | Issue count + open count |
| `app/dashboard/erp/projects/tasks/tasks-client.tsx` | Task count |
| `app/dashboard/erp/stock/warehouses/warehouses-client.tsx` | Warehouse count |
| `app/dashboard/erp/stock/entries/stock-entries-client.tsx` | Entry count |
| `app/dashboard/erp/stock/purchase-receipts/purchase-receipts-client.tsx` | Receipt count |
| `app/dashboard/erp/stock/delivery-notes/delivery-notes-client.tsx` | Note count |

### Legacy Detail Pages (no AI actions, no page context)

All `*-detail-client.tsx` files (e.g. `customer-detail-client.tsx`, `lead-detail-client.tsx`, etc.) do NOT register AI actions or call `usePageContext`. They are being phased out by the metadata-driven ERPFormClient.

---

## 3. All Registered Actions (Complete List)

### 3.1 Generic List Actions (registered by both GenericListClient and ERPListClient)

| Action Name | Description | Parameters |
|-------------|-------------|------------|
| `{doctype}_search` | Filter the list by search term | `term* (string)` |
| `{doctype}_create` | Navigate to create a new record | (none) |
| `{doctype}_navigate` | Navigate to a specific record's detail page | `record_name* (string)` |
| `{doctype}_delete` | Delete a record by name | `record_name* (string)` |

These are registered dynamically based on the doctype slug. For example, on `/dashboard/erp/sales-order`, the actions would be `sales_order_search`, `sales_order_create`, `sales_order_navigate`, `sales_order_delete`.

### 3.2 Generic Detail Actions (registered by GenericDetailClient ONLY)

| Action Name | Description | Parameters |
|-------------|-------------|------------|
| `{doctype}_set_field` | Set field values on the form. Opens edit mode if not editing. | Dynamic: all form fields (type: string) |
| `{doctype}_save` | Save the record / changes | (none) |
| `{doctype}_submit` | Submit the record (Draft -> Submitted) | (none) |
| `{doctype}_cancel` | Cancel the record (Submitted -> Cancelled) | (none) |
| `{doctype}_delete` | Delete the record | (none) |

### 3.3 Legacy Specialized Client Actions

| Client | Actions |
|--------|---------|
| customers-client | `create_customer` (rich schema: name, code, contact, email, phone, address, industry, tax_id, credit_limit), `set_customer_search`, `navigate_to_customer` |
| projects-client | `project_search`, `project_navigate`, `project_create` |
| timesheets-client | `timesheet_search`, `timesheet_navigate` |
| payments-client | `payment_search`, `payment_navigate` |
| journal-entries-client | `journal_entry_search`, `journal_entry_navigate` |
| accounts-client | `account_search`, `account_navigate` |
| procurement-client | `po_search`, `po_navigate` |
| hr-client | `employee_search`, `employee_navigate` |
| material-requests-client | `material_request_search`, `material_request_navigate` |
| quotations-client | `quotation_search`, `quotation_navigate` |
| sales-orders-client | `sales_order_search`, `sales_order_navigate` |
| assets-client | `asset_search`, `asset_navigate` |
| channels-client | `channel_search`, `channel_navigate` |

---

## 4. Impact Analysis: Metadata-Driven Redesign

### 4.1 What Changed

The following new components were introduced to replace the generic/specialized components with metadata-driven versions:

| New Component | Replaces | Route Decision |
|---------------|----------|----------------|
| `ERPListClient.tsx` | `GenericListClient.tsx` (for doctypes with metadata) | `app/dashboard/erp/[doctype]/page.tsx` line 39-47 |
| `ERPFormClient.tsx` | `GenericDetailClient.tsx` (for doctypes with metadata) | `app/dashboard/erp/[doctype]/[name]/page.tsx` line 148-156 |
| `ERPFilterBar.tsx` | (new -- no prior equivalent) | Used inside ERPListClient |
| `list-cell.tsx` | Inline `formatCellValue()` in GenericListClient | Used inside ERPListClient |
| `useDocTypeMeta.ts` | (new -- metadata loading hook) | Used by ERPFormClient |

### 4.2 What BREAKS

#### CRITICAL: ERPFormClient does NOT register AI actions

**This is the most significant gap.** `ERPFormClient` is now rendered for all doctypes that have DocField metadata (which is the majority). But it does NOT call `registerActions()` or `defineAction()` anywhere.

**Impact**: When a user views any detail page for a doctype with metadata (e.g. Sales Order, Purchase Order, Customer, etc.), the AI assistant cannot perform ANY of these actions:
- Set field values on the form
- Save the record
- Submit the record
- Cancel the record
- Delete the record

This means the AI effectively loses all form-level control for the most common doctypes. The detail pages that still use `GenericDetailClient` (those without DocField metadata) continue to work, but they are the minority.

**Affected file**: `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx` (entire file -- no registerActions call exists)

#### MEDIUM: `/new` route always uses GenericDetailClient

In `app/dashboard/erp/[doctype]/[name]/page.tsx` (lines 82-100), when `name === 'new'`, the code always renders `GenericDetailClient` regardless of metadata availability. This is intentional (ERPFormClient doesn't have a "new record" flow), but it means:
- The `/new` route still has AI actions (from GenericDetailClient)
- The edit route (for existing records) does NOT if metadata exists

This creates an inconsistency: AI works on new forms but breaks when the user navigates to an existing record.

#### LOW: Legacy specialized clients are gradually bypassed

As more doctypes get metadata, the generic route (`/erp/{doctype}`) increasingly renders `ERPListClient` instead of `GenericListClient`. This is fine because `ERPListClient` registers the same list-level actions. However, the specialized clients (customers-client, sales-orders-client, etc.) are at their own routes and not affected by this change.

### 4.3 What is SAFE

| Component | Status | Why |
|-----------|--------|-----|
| `ERPListClient` | SAFE | Registers the same 4 list actions as `GenericListClient` (lines 260-323). Identical action names, descriptions, and handler signatures. |
| `GenericListClient` | SAFE | Still used as fallback. No changes to its action registration. |
| `GenericDetailClient` | SAFE | Still used for doctypes without metadata and for `/new` routes. No changes. |
| `usePageContext` | SAFE | Both `ERPListClient` and `ERPFormClient` call `usePageContext()` correctly. |
| Chat panel / dual-track | SAFE | Reads from the action dispatcher store; unaffected by which component populates it. |
| `ai-tool-adapters` | SAFE | Provider-agnostic; no coupling to any specific component. |
| `agent-loop` | SAFE | Server-side; only uses MCP tools, not UI actions. |
| All legacy specialized clients | SAFE | They are at dedicated routes, not affected by the generic route change. |

---

## 5. What Needs to Be Updated

### Priority 1 -- CRITICAL

#### 5.1 Add AI action registration to ERPFormClient

**File**: `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`

**Required changes**:

1. Import `useActionDispatcher` and `defineAction` from `@/store/useActionDispatcher`
2. Import `useAppStore` from `@/store/useAppStore` (for `uiActionActive`)
3. Add a `useEffect` that registers the same detail-level actions as `GenericDetailClient`:
   - `{doctype}_set_field` -- must trigger `handleEditStart()` + `setEditData()` to fill fields
   - `{doctype}_save` -- calls `handleSave()`
   - `{doctype}_submit` -- calls `handleSubmit()` (only if `isSubmittable`)
   - `{doctype}_cancel` -- calls `handleCancel()` (only if `isSubmittable`)
   - `{doctype}_delete` -- calls `setDeleteDialogOpen(true)` (only if Draft)

4. The `set_field` action's parameters should be built from the metadata fields (similar to how GenericDetailClient builds them from `scalarFields` or `schemaFields`). Use `meta.fields` to build the property schema dynamically, filtering out hidden/read_only fields.

5. Return cleanup function calling `unregisterActions()`.

**Reference implementation**: `GenericDetailClient.tsx` lines 510-587

**Estimated effort**: 1-2 hours

### Priority 2 -- IMPORTANT

#### 5.2 Add `/new` route support to ERPFormClient

**File**: `app/dashboard/erp/[doctype]/[name]/page.tsx`

Currently the `/new` route (line 82-100) always uses `GenericDetailClient`. Once ERPFormClient has action registration, it should also handle the `/new` case when metadata exists:

1. Try to load `loadDocTypeMeta` for the doctype (same pattern as the existing record path)
2. If metadata exists, render `ERPFormClient` with `isNew={true}` and an empty record
3. Pass schema fields from metadata instead of `fetchDoctypeSchema`

**Estimated effort**: 30 minutes

### Priority 3 -- NICE TO HAVE

#### 5.3 Add child table row actions to ERPFormClient

The current `renderTable` in ERPFormClient just shows row counts. When `ERPGridClient` (mentioned in comments) is implemented, it should register additional AI actions for child table manipulation:
- `{doctype}_insert_row` -- add a row to a child table
- `{doctype}_set_child_field` -- set a field on a child table row
- `{doctype}_delete_row` -- remove a row from a child table

GenericDetailClient already supports this via `handleAddChildRow`, `handleChildCellChange`, and `handleDeleteChildRow` handlers, but does not expose them as AI actions.

**Estimated effort**: 2-3 hours (depends on ERPGridClient implementation)

#### 5.4 Add metadata-aware field type hints to action parameters

GenericDetailClient's `set_field` action declares all fields as `type: "string"`. With metadata, we can provide richer schemas:
- Use `DocFieldMeta.fieldtype` to set the correct type (Int, Currency, Date, Select, etc.)
- Add `enum` for Select fields
- Add `description` from `DocFieldMeta.label`

This would make the AI much more accurate when filling forms.

**Estimated effort**: 1 hour

---

## 6. Summary

| Category | Finding | Impact |
|----------|---------|--------|
| ERPListClient | Registers same 4 list actions as GenericListClient | No breakage |
| ERPFormClient | Does NOT register any detail-level AI actions | **CRITICAL** -- AI loses all form control for metadata-backed doctypes |
| `/new` route | Always uses GenericDetailClient (has actions) | Low -- inconsistent but functional |
| Page context | Both new components call `usePageContext()` correctly | No breakage |
| Chat infrastructure | Unaffected by the redesign | No breakage |
| Legacy clients | Not affected by generic route changes | No breakage |

**Bottom line**: The only change needed to restore full AI assistant functionality is adding action registration to `ERPFormClient`. This is a straightforward port of the existing pattern from `GenericDetailClient` (lines 510-587), adapted to use the metadata-driven field list instead of the Prisma schema-based one.
