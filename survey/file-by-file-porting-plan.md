# File-by-File Porting Plan: Python Backend → Next.js

> **Pattern:** Server Actions co-located in page folders (`actions.ts`) + API Routes (`route.ts`) only for webhooks, external callbacks, and file streaming.
> **Inspired by:** `grantflux/app/actions/`, `revolyzz/app/dashboard/*/actions.ts`

---

## Pattern Summary

```
┌────────────────────────────────────────────────────────────────┐
│  BEFORE (Python FastAPI)                                       │
│  backend/app/api/routes/erp.py                                 │
│  backend/app/services/gemini.py                                │
├────────────────────────────────────────────────────────────────┤
│  AFTER (Next.js)                                               │
│  frontend/src/app/erp/customers/actions.ts      ← Server Action│
│  frontend/src/app/erp/customers/page.tsx        ← UI           │
│  frontend/src/lib/gemini.ts                     ← shared SDK   │
│  frontend/src/app/api/webhooks/whatsapp/route.ts ← API Route  │
└────────────────────────────────────────────────────────────────┘
```

**Rule of thumb:**
- `GET /list` → `listCustomers()` in `actions.ts`
- `POST /create` → `createCustomer(data)` in `actions.ts`
- `POST /webhook/*` → `app/api/webhooks/*/route.ts`
- `GET /file-proxy` → `app/api/document-image/[id]/route.ts`

---

## Next.js Architecture Patterns (from revolyzz / grantflux)

### Pattern A: Server Component Detail Page (`[id]/page.tsx`)

Used for: Document detail, enquiry detail, invoice detail, any page that needs initial data fetch + SEO.

```tsx
// app/erp/customers/[id]/page.tsx
'use server';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import CustomerDetailClient, { type CustomerDetailProps } from './CustomerDetail';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 1. Auth check (server-side only)
  const session = await getSession();
  if (!session?.data?.id) redirect('/');
  
  // 2. Database query directly in server component
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) redirect('/erp/customers');
  
  // 3. Transform to client-safe props (strip sensitive fields)
  const clientProps: CustomerDetailProps = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    // ... map fields, strip internal IDs
  };
  
  // 4. Render client component with clean props
  return <CustomerDetailClient {...clientProps} />;
}
```

**Key principles:**
- `'use server'` — runs on server, zero client JS bundle
- Direct Prisma queries — no API call overhead
- Auth/redirects before any render
- Data transformation into client-safe types
- Passes clean props to client child

---

### Pattern B: Client Component Detail View (`[id]/CustomerDetail.tsx`)

Used for: Interactive detail views with buttons, forms, toasts, real-time updates.

```tsx
// app/erp/customers/[id]/CustomerDetail.tsx
'use client';

import { useState } from 'react';
import { updateCustomer } from '../actions';  // Server Action for mutation

export interface CustomerDetailProps {
  id: string;
  name: string;
  email: string;
  // ... clean types only
}

export default function CustomerDetail(props: CustomerDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSave = async (data: Partial<CustomerDetailProps>) => {
    const result = await updateCustomer(props.id, data);  // Server Action
    if (result.success) {
      toast.success('Customer updated');
      setIsEditing(false);
    } else {
      toast.error(result.error);
    }
  };
  
  return (
    <div>
      {/* Interactive UI: buttons, forms, modals */}
    </div>
  );
}
```

**Key principles:**
- `'use client'` — interactivity, state, event handlers
- NEVER fetches data on mount (already got props from parent)
- Calls Server Actions for mutations (`updateCustomer`, `deleteCustomer`)
- Handles UI state (loading, toasts, modals)

---

### Pattern C: Client List Page (`page.tsx`)

Used for: Tables, lists, search, pagination — anything with client-side filtering or real-time updates.

```tsx
// app/erp/customers/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { listCustomers, type ClientSafeCustomer } from './actions';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<ClientSafeCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadCustomers();
  }, []);
  
  async function loadCustomers() {
    const result = await listCustomers();
    if (result.success) setCustomers(result.customers);
    setIsLoading(false);
  }
  
  // ... render table with search/filter
}
```

**Key principles:**
- `'use client'` — needs useEffect for data fetching
- Calls Server Action `listCustomers()` on mount
- Handles loading, error, empty states
- Client-side search/filter on already-loaded data

---

### Pattern D: Server Action (`actions.ts`)

Co-located in page folder. Returns `{ success, data, error }`.

```tsx
// app/erp/customers/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

export type ClientSafeCustomer = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function listCustomers(): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.data?.id) return { success: false, error: 'Not authenticated' };
  
  const customers = await prisma.customer.findMany({
    where: { userId: session.data.id },
    orderBy: { createdAt: 'desc' }
  });
  
  // Map to client-safe type
  const clientSafe = customers.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email
  }));
  
  return { success: true, customers: clientSafe };
}

export async function createCustomer(data: { name: string; email: string }) {
  // ... validation, Prisma create, revalidatePath
}

export async function updateCustomer(id: string, data: Partial<ClientSafeCustomer>) {
  // ... Prisma update, revalidatePath
}

export async function deleteCustomer(id: string) {
  // ... Prisma delete, revalidatePath
}
```

**Key principles:**
- `'use server'` — runs on server, can use Prisma directly
- Auth check first
- Returns discriminated union `{ success, data | error }`
- Maps DB records to client-safe types (no Stripe IDs, no internal fields)
- Uses `revalidatePath()` to invalidate cache after mutations
- Co-located with the page that uses it

---

### Pattern E: Shared Server Actions (`app/actions/`)

Cross-cutting concerns used by multiple pages.

```
app/actions/
├── auth.ts              ← getSession, login, logout
├── rag.ts               ← ragSearch, indexWiki (used by AI + Wiki)
├── wiki-admin.ts        ← runWikiMaintenance (used by settings)
└── status-helper.ts     ← getStatusInfo, statusColorClass
```

---

### Pattern F: API Routes (`app/api/`)

Only for: webhooks, external callbacks, file streaming, anything that needs raw HTTP.

```
app/api/
├── webhooks/
│   ├── whatsapp/route.ts     ← GET verification + POST receive
│   ├── telegram/route.ts
│   └── slack/route.ts
├── document-image/
│   └── [id]/route.ts         ← GET proxy from GCS
└── ai/
    └── chat/route.ts         ← POST streaming response (optional)
```

---

## How Patterns Map to Aries Pages

| Aries Page | Pattern | Server Component | Client Component | Actions File |
|---|---|---|---|---|
| `/` Dashboard | **C** — Client list | — | `page.tsx` fetches stats | `app/actions/dashboard.ts` |
| `/erp/customers` | **C** — Client list | — | `page.tsx` with table | `app/erp/customers/actions.ts` |
| `/erp/customers/[id]` | **A+B** — Server detail + Client view | `page.tsx` fetches customer | `CustomerDetail.tsx` interactive | `app/erp/customers/actions.ts` |
| `/documents/[id]` | **A+B** — Server detail + Client view | `page.tsx` fetches doc | `DocumentViewer.tsx` zoom/chat | `app/documents/actions.ts` |
| `/erp/reports/*` | **A** — Server render only | `page.tsx` fetches report | No client child (read-only) | `app/erp/reports/*/actions.ts` |
| `/ai` | **C** — Client chat | — | `page.tsx` with chat UI | `app/ai/actions.ts` |
| `/wiki` | **C** — Client list + search | — | `page.tsx` with search | `app/wiki/actions.ts` |
| `/notebooks/editor/[id]` | **A+B** — Server load + Client edit | `page.tsx` fetches notebook | `NotebookEditor.tsx` TipTap | `app/notebooks/editor/[id]/actions.ts` |

---

## Next.js Responsive Design Patterns (from grantflux)

### The `useMediaQuery` Hook

```tsx
// app/hooks/use-media-query.tsx (from grantflux)
'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return mounted ? matches : false;  // Return false during SSR to avoid hydration mismatch
}
```

**Key features:**
- SSR-safe: returns `false` during server render, then updates on mount
- No hydration mismatches between server and client
- Reactive: updates when window is resized or device orientation changes

---

### Pattern G: Completely Separate Mobile / Desktop Components

Instead of mixing `sm:`, `md:`, `lg:` responsive classes in one file, create **separate components** for each viewport:

```tsx
// app/dashboard/page.tsx (from grantflux)
'use client';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import { DesktopDashboard } from './DesktopDashboard';
import { MobileDashboard } from './MobileDashboard';

export default function DashboardPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Completely different components — no compromises!
  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
}
```

**Why this is better than responsive Tailwind classes:**

| Approach | Pros | Cons |
|---|---|---|
| **Responsive classes** (`sm: md: lg:`) | Single file, less code | Bloated CSS, compromises in UX, hard to maintain |
| **Separate components** (`MobileDashboard` / `DesktopDashboard`) | Purpose-built UX per viewport, cleaner code, no compromises | More files, slight duplication of data fetching logic |

**File structure:**
```
app/dashboard/
├── page.tsx              ← Router entry, useMediaQuery switch
├── DesktopDashboard.tsx  ← Full desktop layout (sidebar, tables, charts)
├── MobileDashboard.tsx   ← Mobile layout (cards, bottom nav, sheets)
├── dashboard-shell.tsx   ← Shared wrapper (auth, loading states)
├── dashboard-topbar.tsx  ← Desktop top bar
├── dashboard-sidebar.tsx ← Desktop sidebar
└── dashboard-bottom-nav.tsx ← Mobile bottom navigation
```

**Aries adoption:**
```
app/erp/customers/
├── page.tsx              ← useMediaQuery switch
├── DesktopCustomers.tsx  ← Table view with filters, sorting, pagination
├── MobileCustomers.tsx   ← Card list with search, sheet detail view
└── actions.ts            ← Shared server actions
```

---

### Pattern H: Dashboard Shell (Shared Layout)

```tsx
// app/dashboard/dashboard-shell.tsx (from grantflux)
// Wraps both mobile and desktop with common concerns:
// - Auth check
// - Loading states
// - Toast notifications
// - Error boundaries
```

The shell handles cross-cutting concerns so `MobileDashboard` and `DesktopDashboard` can focus purely on layout and interaction.

**For Aries:** The existing `AppLayout` component (`components/app-layout.tsx`) already handles sidebar + chat panel. When porting, split it into:
- `DesktopLayout` — sidebar + main content + AI chat panel
- `MobileLayout` — bottom nav + top bar + main content (chat as sheet)

---

### Pattern I: Skeleton Loading States (from revolyzz)

Skeletons are not an afterthought — they **define the perceived performance** of the app. The pattern uses two levels:

#### Level 1: Full-Page Skeleton (initial load)

```tsx
// app/dashboard/customers/page.tsx (from revolyzz)
export default function CustomersPage() {
  const [customers, setCustomers] = useState<ClientSafeCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ... load data in useEffect
  
  if (isLoading) {
    return <CustomerListSkeleton />;  // ← Full page skeleton, returned early
  }
  
  return (
    <div className="space-y-2 sm:space-y-6">
      {/* Real content */}
    </div>
  );
}

function CustomerListSkeleton() {
  return (
    <div className="space-y-2 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />   {/* Title placeholder */}
          <Skeleton className="h-4 w-64" />        {/* Subtitle placeholder */}
        </div>
        <Skeleton className="h-10 w-24" />        {/* Button placeholder */}
      </div>
      
      <div className="hidden sm:flex gap-4">
        <Skeleton className="h-16 w-32" />        {/* Stat card 1 */}
        <Skeleton className="h-16 w-32" />        {/* Stat card 2 */}
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-200">
            <Skeleton className="h-9 w-64" />      {/* Search input */}
          </div>
          <div className="p-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 mb-4">
                <Skeleton className="h-5 w-40" />  {/* Table row col 1 */}
                <Skeleton className="h-5 w-32" />  {/* Table row col 2 */}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Key insight:** The skeleton **mirrors the exact layout** of the real page — same spacing, same card structure, same number of rows. Users perceive zero layout shift when data arrives.

#### Level 2: Inline Table Skeletons (refresh / pagination)

```tsx
// Within the same page — for refresh operations where header already exists
{isLoading ? (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Payment</TableHead>
        <TableHead>Created</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>{renderSkeletons()}</TableBody>
  </Table>
) : (
  <Table>{/* real data */}</Table>
)}

const renderSkeletons = () =>
  Array.from({ length: 4 }).map((_, i) => (
    <TableRow key={`skeleton-${i}`}>
      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
    </TableRow>
  ));
```

**When to use which:**

| Scenario | Skeleton Type | Why |
|---|---|---|
| First page load (no data yet) | **Full-page skeleton** | Header, stats, search bar, table — all mirrored |
| Refresh button click | **Inline table skeletons** | Header already visible, only table data changes |
| Pagination (next page) | **Inline table skeletons** | Same reason — preserve context |
| Filter / search | **Inline table skeletons** | Preserve search input and filter chips |

#### Skeleton for Server Components

Server components don't need manual skeletons — Next.js `loading.tsx` handles it:

```tsx
// app/erp/customers/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="border rounded-lg p-4 space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

Next.js automatically renders `loading.tsx` while the server component fetches data. No `useState`, no `isLoading` flag needed.

---

## 1. ERP Module

### 1.1 Customers (`backend/app/api/routes/erp.py` + services)

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/customers` → `list_customers` | `app/erp/customers/actions.ts` → `listCustomers()` | Server Action | Prisma `findMany`, pagination |
| `POST /api/v1/erp/customers` → `create_customer` | `app/erp/customers/actions.ts` → `createCustomer(data)` | Server Action | Prisma `create` |
| `GET /api/v1/erp/customers` (search) | same `listCustomers()` with filter arg | Server Action | `where: { OR: [{name:{contains}},{email:{contains}}] }` |
| `backend/app/models/customer.py` | `prisma/schema.prisma` → `Customer` model | Prisma | Already exists |
| `backend/app/schemas/customer.py` | `app/erp/customers/types.ts` | TypeScript | Zod or plain interfaces |

**Files created:**
```
frontend/src/app/erp/customers/
├── page.tsx              ← existing
├── actions.ts            ← NEW (listCustomers, createCustomer)
└── types.ts              ← NEW (Customer, CustomerCreateInput)
```

---

### 1.2 Quotations

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/quotations` → `list_quotations` | `app/erp/quotations/actions.ts` → `listQuotations()` | Server Action | |
| `POST /api/v1/erp/quotations` → `create_quotation` | `app/erp/quotations/actions.ts` → `createQuotation(data)` | Server Action | Nested line items → `create` + `createMany` |
| `GET /api/v1/erp/customers` (dropdown) | `app/erp/quotations/actions.ts` → `listCustomers()` | Server Action | Reuse or import from customers/actions |

**Files created:**
```
frontend/src/app/erp/quotations/
├── page.tsx              ← existing
├── actions.ts            ← NEW (listQuotations, createQuotation)
└── types.ts              ← NEW (Quotation, QuotationItem)
```

---

### 1.3 Sales Orders

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/sales-orders` → `list_sales_orders` | `app/erp/sales-orders/actions.ts` → `listSalesOrders()` | Server Action | |
| `POST /api/v1/erp/sales-orders` → `create_sales_order` | `app/erp/sales-orders/actions.ts` → `createSalesOrder(data)` | Server Action | |
| `GET /api/v1/erp/quotations` (dropdown) | `app/erp/sales-orders/actions.ts` → `listQuotations()` | Server Action | Import from quotations/actions |

**Files created:**
```
frontend/src/app/erp/sales-orders/
├── page.tsx
├── actions.ts
└── types.ts
```

---

### 1.4 Accounts / Invoices / Payments / Journal Entries

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/accounts` → `list_accounts` | `app/erp/accounts/actions.ts` → `listAccounts()` | Server Action | |
| `POST /api/v1/erp/invoices` → `create_invoice` | `app/erp/accounts/actions.ts` → `createInvoice(data)` | Server Action | |
| `GET /api/v1/erp/invoices` → `list_invoices` | `app/erp/accounts/actions.ts` → `listInvoices()` | Server Action | |
| `GET /api/v1/erp/payments` → `list_payments` | `app/erp/payments/actions.ts` → `listPayments()` | Server Action | |
| `POST /api/v1/erp/payments` → `record_payment` | `app/erp/payments/actions.ts` → `recordPayment(data)` | Server Action | |
| `GET /api/v1/erp/journal-entries` → `list_journal_entries` | `app/erp/journal-entries/actions.ts` → `listJournalEntries()` | Server Action | |
| `POST /api/v1/erp/journal-entries` → `create_journal_entry` | `app/erp/journal-entries/actions.ts` → `createJournalEntry(data)` | Server Action | Multi-line entries |

---

### 1.5 Chart of Accounts (Financial Reports)

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/accounts/tree` → `chart_of_accounts` | `app/erp/chart-of-accounts/actions.ts` → `getChartOfAccounts()` | Server Action | Nested-set tree query |
| `GET /api/v1/erp/reports/general-ledger` → `general_ledger` | `app/erp/reports/general-ledger/actions.ts` → `getGeneralLedger(filters)` | Server Action | Complex aggregate query |
| `GET /api/v1/erp/reports/trial-balance` → `trial_balance` | `app/erp/reports/trial-balance/actions.ts` → `getTrialBalance(filters)` | Server Action | |
| `GET /api/v1/erp/reports/balance-sheet` → `balance_sheet` | `app/erp/reports/balance-sheet/actions.ts` → `getBalanceSheet(filters)` | Server Action | |
| `GET /api/v1/erp/reports/profit-and-loss` → `profit_and_loss` | `app/erp/reports/profit-and-loss/actions.ts` → `getProfitAndLoss(filters)` | Server Action | |
| `GET /api/v1/erp/reports` (summary) | `app/erp/reports/actions.ts` → `getReportsSummary()` | Server Action | |

**Blocker:** Financial report aggregates use SQLAlchemy `func.sum`, `group_by`, subqueries. In Prisma, these become `$queryRaw` with raw SQL or complex `groupBy` + `aggregate`. The SQL is portable; just wrap in `$queryRaw`.

---

### 1.6 Stock

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/items` → `list_items` | `app/erp/stock/actions.ts` → `listItems()` | Server Action | |
| `GET /api/v1/erp/warehouses` → `list_warehouses` | `app/erp/stock/actions.ts` → `listWarehouses()` | Server Action | |
| `GET /api/v1/erp/bins` → `list_stock_levels` | `app/erp/stock/actions.ts` → `getStockLevels()` | Server Action | |
| `POST /api/v1/erp/stock-entries` → `create_stock_entry` | `app/erp/stock/actions.ts` → `createStockEntry(data)` | Server Action | |

---

### 1.7 Procurement

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/suppliers` → `list_suppliers` | `app/erp/procurement/actions.ts` → `listSuppliers()` | Server Action | |
| `POST /api/v1/erp/suppliers` → `create_supplier` | `app/erp/procurement/actions.ts` → `createSupplier(data)` | Server Action | |
| `GET /api/v1/erp/purchase-orders` → `list_purchase_orders` | `app/erp/procurement/actions.ts` → `listPurchaseOrders()` | Server Action | |
| `POST /api/v1/erp/purchase-orders` → `create_purchase_order` | `app/erp/procurement/actions.ts` → `createPurchaseOrder(data)` | Server Action | |

---

### 1.8 Projects & Tasks

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/projects` → `list_projects` | `app/erp/projects/actions.ts` → `listProjects()` | Server Action | |
| `POST /api/v1/erp/projects` → `create_project` | `app/erp/projects/actions.ts` → `createProject(data)` | Server Action | |
| `POST /api/v1/erp/projects/{id}/assign` → `assign_personnel` | `app/erp/projects/actions.ts` → `assignPersonnel(projectId, personnelId)` | Server Action | |
| `GET /api/v1/erp/tasks` → `list_tasks` | `app/erp/projects/actions.ts` → `listTasks()` | Server Action | |
| `POST /api/v1/erp/tasks` → `create_task` | `app/erp/projects/actions.ts` → `createTask(data)` | Server Action | |

---

### 1.9 Timesheets

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/timesheets` → `list_timesheets` | `app/erp/timesheets/actions.ts` → `listTimesheets()` | Server Action | |
| `POST /api/v1/erp/timesheets` → `create_timesheet` | `app/erp/timesheets/actions.ts` → `createTimesheet(data)` | Server Action | |

---

### 1.10 HR / Personnel

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/personnel` → `list_personnel` | `app/erp/hr/actions.ts` → `listPersonnel()` | Server Action | |
| `POST /api/v1/erp/personnel` → `create_personnel` | `app/erp/hr/actions.ts` → `createPersonnel(data)` | Server Action | |
| `GET /api/v1/erp/certifications` → `list_certifications` | `app/erp/hr/actions.ts` → `listCertifications()` | Server Action | |
| `POST /api/v1/erp/certifications` → `add_certification` | `app/erp/hr/actions.ts` → `addCertification(data)` | Server Action | |
| `GET /api/v1/erp/personnel/compliance-alerts` | `app/erp/hr/actions.ts` → `getComplianceAlerts()` | Server Action | |

---

### 1.11 Assets

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/erp/assets` → `list_assets` | `app/erp/assets/actions.ts` → `listAssets()` | Server Action | |
| `POST /api/v1/erp/assets` → `create_asset` | `app/erp/assets/actions.ts` → `createAsset(data)` | Server Action | |
| `GET /api/v1/erp/assets/calibration-due` | `app/erp/assets/actions.ts` → `getCalibrationDue()` | Server Action | |

---

## 2. Enquiries Module

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/enquiries` → `list_enquiries` | `app/enquiries/actions.ts` → `listEnquiries()` | Server Action | |
| `POST /api/v1/enquiries` → `create_enquiry` | `app/enquiries/actions.ts` → `createEnquiry(data)` | Server Action | |
| `GET /api/v1/enquiries/{id}` → `get_enquiry` | `app/enquiries/actions.ts` → `getEnquiry(id)` | Server Action | |
| `PATCH /api/v1/enquiries/{id}` → `update_enquiry` | `app/enquiries/actions.ts` → `updateEnquiry(id, data)` | Server Action | |
| `POST /api/v1/enquiries/{id}/approve` → `approve_enquiry` | `app/enquiries/actions.ts` → `approveEnquiry(id)` | Server Action | |
| `POST /api/v1/enquiries/{id}/execute` | `app/enquiries/[id]/actions.ts` → `executeEnquiry(id)` | Server Action | From pipeline.py |

**Files:**
```
frontend/src/app/enquiries/
├── page.tsx
├── actions.ts            ← listEnquiries, createEnquiry
├── new/
│   └── page.tsx
└── [id]/
    ├── page.tsx
    └── actions.ts        ← getEnquiry, updateEnquiry, approveEnquiry, executeEnquiry
```

---

## 3. Documents Module

### 3.1 Entity-Agnostic Uploads

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/document-upload/upload` → `upload_document` | `KEEP in Python` → call via `fetch()` | Python microservice | MarkItDown + GCS + Gemini vision |
| `GET /api/v1/document-upload/` → `list_documents` | `app/documents/actions.ts` → `listDocuments()` | Server Action | Prisma query |
| `GET /api/v1/document-upload/{id}` → `get_document` | `app/documents/actions.ts` → `getDocument(id)` | Server Action | |
| `DELETE /api/v1/document-upload/{id}` → `delete_document` | `app/documents/actions.ts` → `deleteDocument(id)` | Server Action | |
| `POST /api/v1/document-upload/{id}/process` → `process_document` | `KEEP in Python` → call via `fetch()` | Python microservice | Gemini vision extraction |
| `GET /api/v1/document-upload/{id}/content` → `get_document_content` | `app/api/document-image/[id]/route.ts` → `GET` | API Route | Already exists ✅ |
| `GET /api/v1/document-upload/{id}/signed-url` | `DELETE` (replaced by proxy route) | — | GCS URL no longer exposed |

**Files:**
```
frontend/src/app/documents/
├── page.tsx
├── actions.ts            ← listDocuments, getDocument, deleteDocument
├── types.ts
└── [id]/
    ├── page.tsx
    └── actions.ts        ← getDocument (detail view)

frontend/src/app/api/
└── document-image/
    └── [id]/
        └── route.ts       ← GET proxy (already exists ✅)
```

### 3.2 Enquiry-Linked Documents

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/documents/{enquiry_id}/upload` | `app/enquiries/[id]/actions.ts` → `uploadEnquiryDocument()` | Server Action | Calls Python ingest service |
| `GET /api/v1/documents/{enquiry_id}` → `list_documents` | `app/enquiries/[id]/actions.ts` → `listEnquiryDocuments()` | Server Action | |
| `POST /api/v1/documents/process-pdf` | `KEEP in Python` | Python microservice | |
| `GET /api/v1/documents/pdf-job/{job_id}` | `KEEP in Python` or polling from frontend | Python microservice | |

---

## 4. AI Module

### 4.1 Personas

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/ai/personas` → `list_personas` | `app/ai/actions.ts` → `listPersonas()` | Server Action | |
| `GET /api/v1/ai/personas/{id}` → `get_persona` | `app/ai/actions.ts` → `getPersona(id)` | Server Action | |
| `POST /api/v1/ai/personas` → `create_persona` | `app/ai/actions.ts` → `createPersona(data)` | Server Action | |
| `PATCH /api/v1/ai/personas/{id}` → `update_persona` | `app/ai/actions.ts` → `updatePersona(id, data)` | Server Action | |
| `POST /api/v1/ai/seed-personas` → `seed_personas` | `app/ai/actions.ts` → `seedPersonas()` | Server Action | One-time seed |

### 4.2 Chat & Conversations

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/ai/chat/{persona_id}` → `chat_with_persona` | `app/ai/actions.ts` → `chatWithPersona(personaId, message)` | Server Action | Tool-calling loop |
| `GET /api/v1/ai/conversations` → `list_conversations` | `app/ai/actions.ts` → `listConversations()` | Server Action | |
| `GET /api/v1/ai/conversations/{id}/messages` | `app/ai/actions.ts` → `getConversationMessages(id)` | Server Action | |

**Blocker:** `chat_with_persona` uses `AgentLoop.run()` which can take 10–30s (multiple tool rounds). Server Actions have a 10s timeout on Vercel. **Solution:** Convert to streaming API route or use a job queue.

**Alternative architecture:**
```
# Option A: Streaming API Route (recommended)
app/api/ai/chat/route.ts          ← POST streaming response
  → calls gemini.ts helper
  → streams tokens back

# Option B: Job queue
app/ai/actions.ts → chatWithPersona() initiates job
app/api/ai/chat-poll/[jobId]/route.ts ← poll for result
```

### 4.3 Dashboards (Mutator)

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/ai/dashboards` → `list_dashboards` | `app/settings/actions.ts` → `listDashboards()` | Server Action | Or under app/admin/ |
| `GET /api/v1/ai/dashboards/{id}` → `get_dashboard` | `app/settings/actions.ts` → `getDashboard(id)` | Server Action | |
| `POST /api/v1/ai/dashboards` → `create_dashboard` | `app/settings/actions.ts` → `createDashboard(data)` | Server Action | |

### 4.4 Media Generation

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/ai/generate-image` → `generate_image` | `app/ai/actions.ts` → `generateImage(prompt)` | Server Action | Node.js `@google/genai` supports this |
| `POST /api/v1/ai/generate-speech` → `generate_speech` | `app/ai/actions.ts` → `generateSpeech(text)` | Server Action | Node.js `@google/genai` supports this |

---

## 5. RAG / Search Module

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/ai/rag/search` → `rag_search` | `app/actions/rag.ts` → `ragSearch(query, method, limit)` | Shared Server Action | Used by AI chat + wiki |
| `POST /api/v1/ai/rag/index-wiki` → `rag_index_wiki` | `app/actions/rag.ts` → `indexWikiAll()` | Shared Server Action | Background job |
| `POST /api/v1/ai/rag/index-page` → `rag_index_page` | `app/actions/rag.ts` → `indexWikiPage(path)` | Shared Server Action | |
| `POST /api/v1/ai/rag/index-ocr-images` → `rag_index_ocr_images` | `KEEP in Python` | Python microservice | Depends on OCR data |
| `GET /api/v1/ai/rag/stats` → `rag_stats` | `app/actions/rag.ts` → `getRagStats()` | Shared Server Action | |

**Blocker:** pgvector queries need `$queryRaw`. Prisma schema stores `embedding` as `String` or uses a custom type extension.

**Shared file:**
```
frontend/src/app/actions/rag.ts     ← NEW (shared across pages)
```

---

## 6. Wiki Module

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/wiki/pages` → `list_pages` | `app/wiki/actions.ts` → `listWikiPages()` | Server Action | |
| `GET /api/v1/wiki/pages/{path}` → `get_page` | `app/wiki/actions.ts` → `getWikiPage(path)` | Server Action | |
| `POST /api/v1/wiki/pages` → `create_page` | `app/wiki/actions.ts` → `createWikiPage(path, content)` | Server Action | |
| `PUT /api/v1/wiki/pages/{path}` → `update_page` | `app/wiki/actions.ts` → `updateWikiPage(path, content)` | Server Action | |
| `DELETE /api/v1/wiki/pages/{path}` → `delete_page` | `app/wiki/actions.ts` → `deleteWikiPage(path)` | Server Action | |
| `GET /api/v1/wiki/search` → `search_wiki` | `app/wiki/actions.ts` → `searchWiki(query)` | Server Action | |
| `GET /api/v1/wiki/index` → `get_index` | `app/wiki/actions.ts` → `getWikiIndex()` | Server Action | |
| `POST /api/v1/ai/wiki/maintenance` → `run_wiki_maintenance` | `app/actions/wiki-admin.ts` → `runWikiMaintenance()` | Shared Server Action | |

**Blocker:** `WikiService` uses `gitpython` for commits. In Node.js, use `simple-git` package or shell out to `git` via `child_process.exec`.

**Files:**
```
frontend/src/app/wiki/
├── page.tsx
├── actions.ts            ← NEW (CRUD + search)
└── types.ts              ← NEW

frontend/src/app/actions/
└── wiki-admin.ts         ← NEW (maintenance, re-index)
```

---

## 7. Notebooks Module

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/notebooks` → `list_notebooks` | `app/notebooks/actions.ts` → `listNotebooks()` | Server Action | |
| `POST /api/v1/notebooks` → `create_notebook` | `app/notebooks/actions.ts` → `createNotebook(data)` | Server Action | |
| `GET /api/v1/notebooks/{id}` → `get_notebook` | `app/notebooks/editor/[id]/actions.ts` → `getNotebook(id)` | Server Action | |
| `PATCH /api/v1/notebooks/{id}` → `update_notebook` | `app/notebooks/editor/[id]/actions.ts` → `updateNotebook(id, data)` | Server Action | |
| `DELETE /api/v1/notebooks/{id}` → `delete_notebook` | `app/notebooks/actions.ts` → `deleteNotebook(id)` | Server Action | |

**Files:**
```
frontend/src/app/notebooks/
├── page.tsx
├── actions.ts
└── editor/
    └── [id]/
        ├── page.tsx
        └── actions.ts      ← getNotebook, updateNotebook
```

---

## 8. Workflow Module

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/workflows` → `list_workflows` | `app/pipeline/actions.ts` → `listWorkflows()` | Server Action | |
| `GET /api/v1/workflows/{id}` → `get_workflow` | `app/pipeline/actions.ts` → `getWorkflow(id)` | Server Action | |
| `POST /api/v1/workflows` → `create_workflow` | `app/pipeline/actions.ts` → `createWorkflow(data)` | Server Action | |
| `PATCH /api/v1/workflows/{id}` → `update_workflow` | `app/pipeline/actions.ts` → `updateWorkflow(id, data)` | Server Action | |
| `POST /api/v1/workflows/{id}/nodes` → `add_node` | `app/pipeline/actions.ts` → `addWorkflowNode(id, data)` | Server Action | |
| `POST /api/v1/workflows/{id}/edges` → `add_edge` | `app/pipeline/actions.ts` → `addWorkflowEdge(id, data)` | Server Action | |
| `POST /api/v1/workflows/execute` → `run_workflow` | `app/pipeline/actions.ts` → `executeWorkflow(id, enquiryId)` | Server Action | |
| `GET /api/v1/workflows/executions/{id}` → `get_execution` | `app/pipeline/actions.ts` → `getExecution(id)` | Server Action | |
| `GET /api/v1/workflows/{id}/executions` | `app/pipeline/actions.ts` → `listExecutions(id)` | Server Action | |
| `POST /api/v1/workflows/seed-default` | `app/pipeline/actions.ts` → `seedDefaultWorkflow()` | Server Action | |

**Files:**
```
frontend/src/app/pipeline/
├── page.tsx
├── actions.ts            ← NEW (all workflow CRUD + execute)
└── types.ts
```

---

## 9. Pipeline / Decisioning

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `POST /api/v1/pipeline/run` → `run_decisioning_pipeline` | `app/enquiries/actions.ts` → `runPipeline(enquiryId)` | Server Action | |
| `POST /api/v1/pipeline/execute/{enquiry_id}` | `app/enquiries/[id]/actions.ts` → `executeApproved(id)` | Server Action | |

---

## 10. Channels (Webhooks)

| Python | Next.js | Type | Notes |
|--------|---------|------|-------|
| `GET /api/v1/channels/webhook/{connector_id}` | `app/api/webhooks/whatsapp/route.ts` → `GET` | API Route | Verification challenge |
| `POST /api/v1/channels/webhook/{connector_id}` | `app/api/webhooks/whatsapp/route.ts` → `POST` | API Route | Receive messages |
| `GET /api/v1/channels/connectors` | `app/settings/actions.ts` → `listChannelConnectors()` | Server Action | |
| `POST /api/v1/channels/connectors` | `app/settings/actions.ts` → `createChannelConnector(data)` | Server Action | |

**Files:**
```
frontend/src/app/api/webhooks/
├── whatsapp/
│   └── route.ts          ← GET verification + POST receiver
├── telegram/
│   └── route.ts
└── slack/
    └── route.ts
```

---

## 11. Shared Services → TypeScript Helpers

| Python Service | Next.js Helper | Notes |
|----------------|----------------|-------|
| `backend/app/services/gemini.py` → `GeminiService` | `frontend/src/lib/gemini.ts` → `GeminiClient` | Wraps `@google/genai` SDK |
| `backend/app/services/rag.py` → `RAGService` | `frontend/src/lib/rag.ts` → `RAGClient` | Chunking + embedding logic |
| `backend/app/services/rag_postgres.py` | `frontend/src/lib/rag-db.ts` | `$queryRaw` wrappers for pgvector |
| `backend/app/services/rules.py` → `apply_rules` | `frontend/src/lib/rules.ts` → `applyRules()` | Pure math, trivial port |
| `backend/app/services/wiki.py` → `WikiService` | `frontend/src/lib/wiki.ts` → `WikiService` | `simple-git` instead of `gitpython` |
| `backend/app/services/workflow_executor.py` | `frontend/src/lib/workflow-engine.ts` | DAG walker |
| `backend/app/services/agent_loop.py` → `AgentLoop` | `frontend/src/lib/agent-loop.ts` | Tool-calling loop |
| `backend/app/services/pipeline.py` → `run_pipeline` | `frontend/src/lib/pipeline.ts` | Orchestration |
| `backend/app/services/execution.py` | `frontend/src/lib/execution.ts` | Parallel fan-out |
| `backend/app/mcp_servers/gateway.py` | `frontend/src/lib/mcp-gateway.ts` | Tool registry |
| `backend/app/services/gcs.py` | `frontend/src/lib/gcs.ts` | `@google-cloud/storage` |

---

## 12. What Stays in Python (Microservice)

These become a single lightweight Python service mounted at `/api/py/*` or called via internal HTTP:

| Python File | Microservice Endpoint | Why Keep |
|-------------|----------------------|----------|
| `document_upload.py` (upload + process) | `POST /api/py/ingest` | MarkItDown + Gemini vision + GCS |
| `services/ingestion.py` | Called by above | MarkItDown dependency |
| `mcp_servers/document_output_server.py` | `POST /api/py/generate-document` | reportlab + openpyxl |
| `services/gemini.py` (media gen only) | `POST /api/py/generate-media` | Could port, but Python SA auth is simpler |
| `services/rag_postgres.py` (bulk indexing) | `POST /api/py/rag/bulk-index` | `copy_records_to_table` speed |

**Microservice structure:**
```
backend/  ← renamed to python-sidecar/
├── main.py               ← FastAPI with 4 routes only
├── services/
│   ├── ingestion.py
│   ├── document_output.py
│   └── gemini_media.py
└── requirements.txt      ← minimal deps
```

---

## 13. Complete Directory Tree (After Porting)

```
frontend/src/
├── app/
│   ├── page.tsx                          ← Dashboard
│   ├── actions/
│   │   ├── rag.ts                        ← Shared RAG search/index
│   │   ├── wiki-admin.ts                 ← Wiki maintenance
│   │   └── newAuth.ts                    ← Auth (from revolyzz pattern)
│   │
│   ├── api/
│   │   ├── document-image/
│   │   │   └── [id]/route.ts             ← GCS proxy (exists ✅)
│   │   ├── webhooks/
│   │   │   ├── whatsapp/route.ts
│   │   │   ├── telegram/route.ts
│   │   │   └── slack/route.ts
│   │   └── ai/
│   │       └── chat/route.ts             ← Streaming chat (optional)
│   │
│   ├── ai/
│   │   ├── page.tsx
│   │   ├── actions.ts                    ← listPersonas, chatWithPersona, etc.
│   │   └── types.ts
│   │
│   ├── enquiries/
│   │   ├── page.tsx
│   │   ├── actions.ts                    ← listEnquiries, createEnquiry
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── actions.ts                ← getEnquiry, update, approve, execute
│   │
│   ├── documents/
│   │   ├── page.tsx
│   │   ├── actions.ts                    ← listDocuments, deleteDocument
│   │   └── [id]/
│   │       └── page.tsx
│   │
│   ├── erp/
│   │   ├── accounts/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listAccounts, listInvoices, createInvoice
│   │   ├── assets/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── chart-of-accounts/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← getChartOfAccounts
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listCustomers, createCustomer
│   │   ├── hr/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listPersonnel, createPersonnel, etc.
│   │   ├── journal-entries/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── payments/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listPayments, recordPayment
│   │   ├── procurement/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listSuppliers, listPurchaseOrders
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                ← listProjects, listTasks, assignPersonnel
│   │   ├── quotations/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── general-ledger/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts            ← getGeneralLedger
│   │   │   ├── trial-balance/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── balance-sheet/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   └── profit-and-loss/
│   │   │       ├── page.tsx
│   │   │       └── actions.ts
│   │   ├── sales-orders/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── stock/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   └── timesheets/
│   │       ├── page.tsx
│   │       └── actions.ts
│   │
│   ├── notebooks/
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   └── editor/
│   │       └── [id]/
│   │           ├── page.tsx
│   │           └── actions.ts            ← getNotebook, updateNotebook
│   │
│   ├── pipeline/
│   │   ├── page.tsx
│   │   └── actions.ts                    ← listWorkflows, executeWorkflow
│   │
│   ├── settings/
│   │   ├── page.tsx
│   │   └── actions.ts                    ← listDashboards, listConnectors
│   │
│   └── wiki/
│       ├── page.tsx
│       └── actions.ts                    ← listWikiPages, getWikiPage, etc.
│
├── lib/
│   ├── prisma.ts                         ← Prisma client singleton
│   ├── gemini.ts                         ← Gemini SDK wrapper
│   ├── rag.ts                            ← RAG chunking + embedding
│   ├── rag-db.ts                         ← pgvector $queryRaw helpers
│   ├── wiki.ts                           ← WikiService (simple-git)
│   ├── rules.ts                          ← Business rules engine
│   ├── workflow-engine.ts                ← DAG executor
│   ├── agent-loop.ts                     ← Tool-calling loop
│   ├── pipeline.ts                       ← Presales pipeline
│   ├── mcp-gateway.ts                    ← MCP tool registry
│   └── gcs.ts                            ← Google Cloud Storage
│
└── types/
    └── api.ts                            ← Shared TypeScript types
```

---

## 14. Migration Order (Recommended)

| Phase | Modules | Effort | Risk |
|-------|---------|--------|------|
| **1** | ERP CRUD (customers, suppliers, items, assets, personnel) | ~2 days | Low — pure CRUD |
| **2** | Enquiries + Notebooks + Wiki | ~1 day | Low — already Prisma-ready |
| **3** | Financial reports (GL, TB, BS, P&L) | ~1 day | Medium — aggregates need `$queryRaw` |
| **4** | Workflows + Pipeline | ~1 day | Medium — DAG logic portable |
| **5** | AI Personas + Chat | ~2 days | Medium — verify Node.js Gemini SDK parity |
| **6** | RAG search + indexing | ~1 day | Medium — pgvector raw SQL |
| **7** | MCP Gateway + tools | ~2 days | High — 9 servers to port |
| **8** | Channels webhooks | ~0.5 day | Low — HTTP only |
| **9** | Extract Python microservice (MarkItDown + doc gen) | ~1 day | Low — just delete ported code |

**Total estimated effort: ~12 days** (single developer, full-time)
