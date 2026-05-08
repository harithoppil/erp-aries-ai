# Next.js Frontend Patterns Audit Report

> **Scope:** `frontend/src/app` — 31 page.tsx files  
> **Date:** 2026-05-07  
> **Auditor:** Kimi Code CLI  
> **Status:** AUDIT ONLY — no edits made

---

## The 3 Reference Patterns

### Pattern 1 — Skeleton Loading State
**Source:** `revolyzz/app/dashboard/customers/page.tsx`  
**What it is:** A dedicated `<CustomerListSkeleton>` component that mirrors the exact layout of the real page using `<Skeleton>` placeholders. It renders the header, stat cards, search bar, and table rows — so the user sees zero layout shift when data arrives. The skeleton is returned early when `isLoading` is true.

```tsx
// Key traits:
if (isLoading) return <CustomerListSkeleton />;
// Skeleton mirrors: header (h-8 w-32), stat cards (h-16 w-32), table rows (h-5 w-24)
```

### Pattern 2 — Server Component Page
**Source:** `revolyzz/app/dashboard/transactions/[id]/page.tsx`  
**What it is:** A `'use server'` page that fetches data directly (Prisma, Stripe), constructs a **client-safe props object**, and passes it to a client component child. No `useState`/`useEffect` for data. No hydration spinners. Metadata generated server-side. Auth checked server-side with redirect.

```tsx
// Key traits:
'use server';
export async function generateMetadata({ params }) { ... }
export default async function Page({ params }) {
  const session = await getSession();
  if (!session) redirect('/');
  const data = await prisma.transaction.findFirst(...);
  return <ClientComponent {...clientSafeProps} />;
}
```

### Pattern 3 — Mobile / Desktop Split
**Source:** `grantflux/app/hooks/use-media-query.tsx`  
**What it is:** A hook that returns `isMobile` based on `window.matchMedia('(max-width: 768px)')`. The page renders two completely different component trees — no Tailwind `sm:` / `md:` / `lg:` responsive prefixes cluttering every element. Clean conditional rendering.

```tsx
// Key traits:
const isMobile = useMediaQuery('(max-width: 768px)');
return (
  <main>
    {isMobile ? <MobileHero /> : <DesktopHero />}
  </main>
);
```

---

## Audit Findings by Pattern

---

## PATTERN 1 — SKELETON LOADING STATES

### Current State

| Category | Count | Pages |
|----------|-------|-------|
| ✅ **Has real skeleton** | 7 | `/`, `/erp/customers`, `/erp/chart-of-accounts`, `/erp/reports/general-ledger`, `/erp/reports/trial-balance`, `/erp/reports/balance-sheet`, `/erp/reports/profit-and-loss` |
| ⚠️ **Poor loading state (plain text)** | 15 | See list below |
| ❌ **No loading state at all** | 9 | See list below |

### Pages That Need Skeletons (Priority: HIGH)

These 15 pages show only a plain text `"Loading X..."` string — zero visual structure, full layout shift when data arrives:

| # | File | Current Loading State | What Skeleton Should Mirror |
|---|------|----------------------|----------------------------|
| 1 | `app/erp/accounts/page.tsx` | `"Loading accounts..."` | Header + 4 stat cards + Tabs (Accounts/Invoices) + Table |
| 2 | `app/erp/assets/page.tsx` | `"Loading assets..."` | Header + 4 stat cards + Category filter chips + Asset grid |
| 3 | `app/erp/hr/page.tsx` | `"Loading personnel..."` | Header + 4 stat cards + Department filter + Personnel table |
| 4 | `app/erp/journal-entries/page.tsx` | `"Loading journal entries..."` | Header + 4 stat cards + Search + Entries table |
| 5 | `app/erp/payments/page.tsx` | `"Loading payments..."` | Header + 2 stat cards + Search + Payments table |
| 6 | `app/erp/procurement/page.tsx` | `"Loading procurement..."` | Header + 3 stat cards + Tabs (Suppliers/POs) + Table |
| 7 | `app/erp/projects/page.tsx` | `"Loading projects..."` | Header + 4 stat cards + Tabs (Projects/Tasks) + Table |
| 8 | `app/erp/quotations/page.tsx` | `"Loading quotations..."` | Header + 5 stat cards + Search + Quotations table |
| 9 | `app/erp/reports/page.tsx` | `"Loading reports..."` | Header + 4 report cards grid |
| 10 | `app/erp/sales-orders/page.tsx` | `"Loading sales orders..."` | Header + 5 stat cards + Search + Orders table |
| 11 | `app/erp/stock/page.tsx` | `"Loading stock..."` | Header + 3 stat cards + Tabs (Items/Warehouses/Stock) + Table |
| 12 | `app/erp/timesheets/page.tsx` | `"Loading timesheets..."` | Header + 3 stat cards + Search + Timesheet table |
| 13 | `app/enquiries/page.tsx` | `"Loading..."` | Header + New button + Card list OR table (depending on breakpoint) |
| 14 | `app/enquiries/[id]/page.tsx` | `"Loading..."` | Pipeline stage header + Status card + Metadata grid + Notes |
| 15 | `app/notebooks/page.tsx` | `"Loading..."` | Header + Search + 4-column document card grid |

### Pages That Need Loading State Added (Priority: MEDIUM)

These 9 pages have **no loading state whatsoever** — they render nothing or a blank area while data fetches:

| # | File | What Happens During Fetch | What Skeleton Should Mirror |
|---|------|--------------------------|----------------------------|
| 16 | `app/documents/page.tsx` | Delegates to `DocumentUploadPanel` — panel has its own internal loading but no skeleton | Upload dropzone + document list cards |
| 17 | `app/documents/[id]/page.tsx` | `Loader2` spinner only (not a skeleton) | Document viewer header + 380px right panel + markdown content area |
| 18 | `app/notebooks/editor/[id]/page.tsx` | `Loader2` spinner only | A4 canvas + toolbar |
| 19 | `app/settings/rag/page.tsx` | `"Loading stats..."` text for stats tab only | Stats cards grid + search + results list |
| 20 | `app/wiki/page.tsx` | No loading state — page renders empty while wiki pages list loads | Search bar + tree sidebar + content area |
| 21 | `app/pipeline/page.tsx` | No loading state (static data) | N/A — static, no skeleton needed |
| 22 | `app/settings/page.tsx` | No loading state (static/localStorage) | N/A — static, no skeleton needed |
| 23 | `app/enquiries/new/page.tsx` | No loading state (form only) | N/A — no data fetch on mount |
| 24 | `app/ai/page.tsx` | "Initializing AI bridge..." animated text | Chat header + persona pills + message area + input box |

### Skeleton Implementation Recommendation

The **best existing skeleton** in the codebase is `CustomerListSkeleton` in `app/erp/customers/page.tsx`. It should be extracted into a shared pattern:

```
components/skeletons/
  page-header-skeleton.tsx      // h-8 title + h-4 subtitle
  stat-cards-skeleton.tsx       // grid of h-16 w-32 Skeleton cards
  table-skeleton.tsx            // n rows × m columns of Skeleton
  card-grid-skeleton.tsx        // n cards with icon + title + meta
```

Every ERP list page (accounts, assets, hr, journal-entries, payments, procurement, projects, quotations, sales-orders, stock, timesheets) shares the **exact same layout**: header → stat cards → search/filter → table. A single reusable skeleton component could cover all of them.

---

## PATTERN 2 — SERVER COMPONENT PAGES

### Current State

**CRITICAL FINDING: Zero server components among all 31 pages.**

Every single `page.tsx` in `app/` is a client component (`"use client"`). There are **no `loading.tsx`** or **`error.tsx`** boundaries anywhere in the app router.

### Pages That Should Be Server Components (Priority: HIGH)

These pages do read-only data display with no interactive state that requires the client. They are prime candidates for the server component pattern:

| # | File | Why It's a Good Candidate | What the Server Component Would Do |
|---|------|--------------------------|-----------------------------------|
| 1 | `app/erp/accounts/page.tsx` | Read-only list of accounts + invoices. Client only needs tab switching. | Fetch accounts + invoices server-side → pass to client tab wrapper. |
| 2 | `app/erp/assets/page.tsx` | Read-only asset list with category filter. | Fetch assets server-side → pass to client filter wrapper. |
| 3 | `app/erp/chart-of-accounts/page.tsx` | Currently uses `useEffect` + `fetch(API_BASE)` — bypasses server actions entirely. | Fetch tree server-side → pass tree data to client expand/collapse component. |
| 4 | `app/erp/customers/page.tsx` | Already uses server actions well, but still a client component doing `useEffect` fetch. | `listCustomers()` is a server action — call it directly in a server component. |
| 5 | `app/erp/hr/page.tsx` | Read-only personnel list. | Fetch personnel server-side → pass to client department filter. |
| 6 | `app/erp/journal-entries/page.tsx` | Read-only list. | Fetch entries server-side → pass to client search wrapper. |
| 7 | `app/erp/payments/page.tsx` | Read-only list. | Fetch payments server-side → pass to client. |
| 8 | `app/erp/procurement/page.tsx` | Read-only suppliers + POs. | Fetch both server-side → pass to client tab wrapper. |
| 9 | `app/erp/projects/page.tsx` | Read-only projects + tasks. | Fetch both server-side → pass to client tab wrapper. |
| 10 | `app/erp/quotations/page.tsx` | Read-only list. | Fetch quotations server-side → pass to client. |
| 11 | `app/erp/sales-orders/page.tsx` | Read-only list. | Fetch orders server-side → pass to client. |
| 12 | `app/erp/stock/page.tsx` | Read-only items + warehouses. | Fetch both server-side → pass to client tab wrapper. |
| 13 | `app/erp/timesheets/page.tsx` | Read-only list. | Fetch timesheets server-side → pass to client. |
| 14 | `app/enquiries/page.tsx` | Read-only list. Already uses `useEnquiries()` hook. | Replace hook with direct server fetch → instant render, no spinner. |
| 15 | `app/notebooks/page.tsx` | Read-only document list. Uses `listNotebooks()` API helper. | Call `listNotebooks()` server-side → pass to client grid. |
| 16 | `app/wiki/page.tsx` | Read-only wiki pages. Uses server actions but still client component. | Fetch wiki index server-side → pass to client tree + content. |

### Report Pages — Special Case (Priority: HIGH)

These 4 report pages are the **worst offenders** — they use raw `fetch(API_BASE)` in `useEffect`, completely bypassing the server action pattern:

| File | Current Pattern | Recommended Pattern |
|------|----------------|---------------------|
| `app/erp/reports/general-ledger/page.tsx` | `useEffect` + `fetch(${API_BASE}/erp/reports/general-ledger)` | Server component: fetch on server, pass entries to client filter UI |
| `app/erp/reports/trial-balance/page.tsx` | `useEffect` + `fetch(${API_BASE}/erp/reports/trial-balance)` | Server component: fetch on server, pass accounts to client date picker |
| `app/erp/reports/balance-sheet/page.tsx` | `useEffect` + `fetch(${API_BASE}/erp/reports/balance-sheet)` | Server component: fetch on server, pass sections to client |
| `app/erp/reports/profit-and-loss/page.tsx` | `useEffect` + `fetch(${API_BASE}/erp/reports/profit-and-loss)` | Server component: fetch on server, pass income/expense to client |

**Why this matters:** These report pages hit the backend API from the browser. If the user has a slow connection, they stare at a blank page for seconds. A server component would render the HTML on the server and stream it to the browser — data visible immediately on first paint.

### Detail Pages — Prime Server Component Candidates (Priority: HIGH)

| File | Why |
|------|-----|
| `app/enquiries/[id]/page.tsx` | Single enquiry fetch + pipeline run. Perfect for server component + `generateMetadata`. |
| `app/documents/[id]/page.tsx` | Single document fetch. Currently does `useEffect` + `fetch(API_BASE)`. |
| `app/notebooks/editor/[id]/page.tsx` | Single notebook fetch. The editor itself must be client, but the fetch should be server. |

### Pages That Must Remain Client Components

These pages have genuine client-side interactivity that justifies `"use client"`:

| File | Why It Must Stay Client |
|------|------------------------|
| `app/ai/page.tsx` | Real-time streaming chat with SSE. Heavy client state (messages, persona switch). |
| `app/enquiries/new/page.tsx` | Form with client-side validation, file upload, dynamic fields. |
| `app/pipeline/page.tsx` | Static data, but has client-side animations/interactions. |
| `app/settings/page.tsx` | localStorage reads/writes. |
| `app/settings/rag/page.tsx` | Search with debounce, streaming results. |

### Server Component Architecture Recommendation

The reference pattern from `revolyzz` should be applied as:

```
app/erp/customers/
  page.tsx              ← 'use server' — fetches data, returns <CustomersClient />
  actions.ts            ← Server actions (already exists ✓)
  customers-client.tsx  ← 'use client' — receives props, handles search/filter/dialog
  
app/enquiries/
  page.tsx              ← 'use server' — fetches enquiries, returns <EnquiriesClient />
  enquiries-client.tsx  ← 'use client' — receives props, handles mobile/desktop split
```

This eliminates the `useEffect` + `setLoading` + `useState` boilerplate from every list page.

---

## PATTERN 3 — MOBILE / DESKTOP SPLIT

### Current State

The codebase has **two competing responsive systems**:

| System | File | Breakpoint | Used By |
|--------|------|-----------|---------|
| `useResponsive()` | `hooks/use-responsive.ts` | mobile <640px, tablet 640–1023px, desktop ≥1024px | Dashboard, AI chat, AppLayout |
| `useIsMobile()` | `hooks/use-mobile.ts` | mobile <768px (shadcn default) | Enquiries, Enquiry detail, New enquiry, Settings |

**Problem:** `use-mobile.ts` is redundant and conflicts with `use-responsive.ts`. The `use-responsive.ts` file already exports a `useIsMobile()` compat wrapper, but some pages still import from `use-mobile.ts` directly.

### Pages That Already Use Mobile/Desktop Split (GOOD)

These pages correctly use `isMobile ? <MobileView /> : <DesktopView />`:

| File | Pattern | Quality |
|------|---------|---------|
| `app/enquiries/page.tsx` | `isMobile ? card-list : table` | ✅ Good — true split |
| `app/enquiries/[id]/page.tsx` | `isMobile ? stack : grid` | ✅ Good |
| `app/enquiries/new/page.tsx` | `isMobile ? stack : grid` | ✅ Good |

### Pages That Need Mobile/Desktop Split (Priority: HIGH)

These pages use **heavy Tailwind responsive prefixes** (`sm:`, `md:`, `lg:`) on nearly every element. They should be refactored into clean conditional renders:

| # | File | Tailwind Clutter Found | What Mobile View Should Be |
|---|------|----------------------|---------------------------|
| 1 | `app/erp/accounts/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-4`, `sm:w-72` | Card-based mobile view (like enquiries) instead of horizontal-scroll table |
| 2 | `app/erp/assets/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-4`, `sm:grid-cols-2` | Mobile: swipeable asset cards. Desktop: grid + table. |
| 3 | `app/erp/hr/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-4` | Mobile: personnel cards with avatar + name + dept. Desktop: table. |
| 4 | `app/erp/journal-entries/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-4` | Mobile: entry cards with debit/credit badges. Desktop: table. |
| 5 | `app/erp/payments/page.tsx` | `flex-col sm:flex-row`, `grid-cols-2` | Mobile: payment cards. Desktop: table. |
| 6 | `app/erp/procurement/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-3` | Mobile: supplier/PO cards. Desktop: table. |
| 7 | `app/erp/projects/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-4` | Mobile: project cards with status. Desktop: table + tasks tab. |
| 8 | `app/erp/quotations/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-5` | Mobile: quotation cards. Desktop: table. |
| 9 | `app/erp/sales-orders/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-5` | Mobile: order cards. Desktop: table. |
| 10 | `app/erp/stock/page.tsx` | `flex-col sm:flex-row`, `md:grid-cols-3` | Mobile: item cards. Desktop: table + warehouse tabs. |
| 11 | `app/erp/timesheets/page.tsx` | `flex-col sm:flex-row`, `grid-cols-3` | Mobile: timesheet cards. Desktop: table. |
| 12 | `app/notebooks/page.tsx` | `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` | Mobile: 1-col card stack. Already has grid breakpoints but no true split. |
| 13 | `app/erp/reports/general-ledger/page.tsx` | `sm:grid-cols-3`, `w-28` columns | Mobile: GL entry cards. Desktop: full table. |
| 14 | `app/erp/reports/trial-balance/page.tsx` | Table with 7 columns | Mobile: account cards with balance. Desktop: table. |
| 15 | `app/erp/reports/balance-sheet/page.tsx` | `sm:flex-row`, `sm:grid-cols-3` | Mobile: collapsible section cards. Desktop: full tree. |
| 16 | `app/erp/reports/profit-and-loss/page.tsx` | `sm:flex-row` | Mobile: income/expense cards. Desktop: full sections. |

### The Repetitive Pattern Problem

Every ERP page repeats the **exact same responsive code**:

```tsx
// Repeated on ~15 pages:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="overflow-x-auto">
```

This should be extracted into shared layout components:

```
components/layout/
  page-header.tsx         // Title + subtitle + action button
  stat-grid.tsx           // Responsive stat card grid (2/3/4/5 cols)
  data-table.tsx          // Table with mobile card fallback
  search-bar.tsx          // Search + filter + refresh
```

Then each page becomes clean:

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
return (
  <>
    <PageHeader title="Customers" count={customers.length} action={<NewButton />} />
    <StatGrid stats={[...]} />
    <SearchBar onSearch={...} onFilter={...} />
    {isMobile ? <CustomerCards data={customers} /> : <CustomerTable data={customers} />}
  </>
);
```

### Mobile View Recommendation for ERP Tables

All 12 ERP list pages show full HTML tables on mobile with `overflow-x-auto`. This is a poor mobile UX. The reference pattern from `app/enquiries/page.tsx` should be adopted:

**Mobile:** Card list with key info visible, tap to expand or navigate to detail  
**Desktop:** Full table with all columns sortable/filterable

Example for `/erp/customers` mobile view:

```tsx
// MobileCustomerCard.tsx
<div className="rounded-lg border p-4">
  <div className="flex items-center justify-between">
    <p className="font-medium">{customer.name}</p>
    <Badge>{customer.status}</Badge>
  </div>
  <p className="text-sm text-muted-foreground">{customer.email}</p>
  <p className="text-sm text-muted-foreground">{customer.phone}</p>
</div>
```

---

## Cross-Cutting Recommendations

### 1. Add `loading.tsx` Boundaries

The app router supports `loading.tsx` files that automatically show while server components fetch data. Since there are **zero** `loading.tsx` files:

```
app/erp/customers/loading.tsx      → <CustomerListSkeleton />
app/erp/accounts/loading.tsx       → <AccountListSkeleton />
app/enquiries/loading.tsx          → <EnquiryListSkeleton />
// ... etc for every server component page
```

This would eliminate the need for `const [loading, setLoading] = useState(true)` in every page.

### 2. Add `error.tsx` Boundaries

Similarly, zero `error.tsx` files exist. Each route should have:

```tsx
// app/erp/customers/error.tsx
'use client';
export default function Error({ error, reset }) {
  return <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>;
}
```

### 3. Consolidate Responsive Hooks

**Delete** `hooks/use-mobile.ts`. All imports should come from `hooks/use-responsive.ts` which already exports `useIsMobile()` as a compat wrapper. The breakpoints should be standardized:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | < 768px | Card views, bottom nav, stacked layouts |
| Tablet | 768–1023px | Collapsible sidebar, condensed tables |
| Desktop | ≥ 1024px | Full sidebar, full tables, side panels |

Note: The current `use-responsive.ts` uses 640px for mobile, but `use-mobile.ts` uses 768px. **Standardize on 768px** to match shadcn defaults and common design systems.

### 4. Create Shared Skeleton Components

Instead of inline skeletons in every page, create:

```tsx
// components/skeletons/page-skeleton.tsx
export function PageSkeleton({ statCount = 4, rowCount = 5 }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><Skeleton className="h-8 w-32 mb-2" /><Skeleton className="h-4 w-64" /></div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array(statCount).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {Array(rowCount).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    </div>
  );
}
```

This single component could cover **all 12 ERP list pages** since they share the same layout structure.

---

## Priority Matrix

| Priority | Pattern | Files | Effort | Impact |
|----------|---------|-------|--------|--------|
| **P0** | Server Component + `loading.tsx` | 4 report pages (`general-ledger`, `trial-balance`, `balance-sheet`, `profit-and-loss`) | Low | High — eliminates worst `useEffect`+`fetch` offenders |
| **P0** | Skeleton | 12 ERP list pages (accounts, assets, hr, journal-entries, payments, procurement, projects, quotations, sales-orders, stock, timesheets, reports) | Medium | High — eliminates layout shift |
| **P1** | Server Component | 12 ERP list pages + enquiries + notebooks + wiki | Medium | High — faster first paint, better SEO |
| **P1** | Mobile/Desktop Split | 12 ERP list pages | High | Medium — better mobile UX |
| **P2** | Skeleton | Detail pages (`documents/[id]`, `notebooks/editor/[id]`, `enquiries/[id]`) | Low | Medium |
| **P2** | Consolidate hooks | `use-mobile.ts` → `use-responsive.ts` | Low | Low — code cleanup |
| **P3** | Shared components | Extract `PageHeader`, `StatGrid`, `DataTable` | Medium | Low — maintainability |

---

## Summary

| Metric | Count |
|--------|-------|
| Total pages audited | 31 |
| Client components | 31 (100%) |
| Server components | 0 (0%) |
| Pages with real skeletons | 7 |
| Pages with plain-text loading | 15 |
| Pages with no loading state | 9 |
| Pages using mobile/desktop split | 3 |
| Pages using Tailwind responsive prefixes | ~20 |
| `loading.tsx` files | 0 |
| `error.tsx` files | 0 |
| `useEffect` + `fetch(API_BASE)` pages | 7 |

**Bottom line:** The intern's port is functional but architecturally immature. Every page is a client component, most have poor loading states, and mobile UX is an afterthought (horizontal-scroll tables). Applying the 3 patterns would significantly improve perceived performance, mobile usability, and code maintainability.
