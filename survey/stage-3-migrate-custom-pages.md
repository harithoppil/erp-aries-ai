# Stage 3 — Migrate the 77 Custom Per-Module Client Components

> **Goal**: Eliminate the 77 hand-rolled `*-client.tsx` files (and their paired `actions.ts` + `*-detail-client.tsx` siblings) by pointing every per-module list and detail route at the generic, metadata-driven `ERPListClient` / `ERPFormClient` shipped in Stages 1 and 2.
>
> **Outcome at end of stage**: Every URL of the form `/dashboard/erp/<module>/<entity>` and `/dashboard/erp/<module>/<entity>/<id>` is rendered by **at most 6 lines of code**. The custom dashboards (Selling/Buying/Stock/etc.), Chart of Accounts tree, financial reports, AI chat, Import, Settings, Setup pages stay untouched.
>
> **Effort**: 2–3 days
>
> **Depends on**: Stage 1 (`ERPListClient`) and Stage 2 (`ERPGridClient`). The merged Stage 1+2 must be working for an unspecified-doctype URL before starting this stage.

---

## 1. Current state inventory (sanity check before starting)

Run from the repo root:
```bash
find app/dashboard/erp -name "*-client.tsx" | sort | wc -l        # expect 77
find app/dashboard/erp -name "actions.ts"   | sort | wc -l        # expect 43
```

The full list of `*-client.tsx` files (as of commit `616cb12`):

```
accounts/[id]/invoice-detail-client.tsx
accounts/accounts-client.tsx
accounts/bank-accounts/[id]/bank-account-detail-client.tsx
accounts/bank-accounts/bank-accounts-client.tsx
accounts/budgets/[id]/budget-detail-client.tsx
accounts/budgets/budgets-client.tsx
accounts/cost-centers/[id]/cost-center-detail-client.tsx
accounts/cost-centers/cost-centers-client.tsx
accounts/invoicing-dashboard-client.tsx                    ← KEEP (dashboard)
assets/[id]/asset-detail-client.tsx
assets/assets-client.tsx
assets/assets-dashboard-client.tsx                         ← KEEP (dashboard)
buying/buying-dashboard-client.tsx                         ← KEEP (dashboard)
buying/invoices/[id]/purchase-invoice-detail-client.tsx
buying/invoices/purchase-invoices-client.tsx
buying/rfq/[id]/rfq-detail-client.tsx
buying/rfq/rfq-client.tsx
chart-of-accounts/chart-of-accounts-client.tsx             ← KEEP (tree)
crm/contracts/[id]/contract-detail-client.tsx
crm/contracts/contracts-client.tsx
crm/crm-dashboard-client.tsx                               ← KEEP (dashboard)
crm/leads/[id]/lead-detail-client.tsx
crm/leads/leads-client.tsx
crm/opportunities/[id]/opportunity-detail-client.tsx
crm/opportunities/opportunities-client.tsx
customers/[id]/customer-detail-client.tsx
customers/customers-client.tsx
hr/[id]/personnel-detail-client.tsx
hr/hr-client.tsx
hr/hr-dashboard-client.tsx                                 ← KEEP (dashboard)
journal-entries/journal-entries-client.tsx
manufacturing/bom/bom-client.tsx
manufacturing/job-cards/job-cards-client.tsx
manufacturing/manufacturing-dashboard-client.tsx           ← KEEP (dashboard)
manufacturing/work-orders/[id]/work-order-detail-client.tsx
manufacturing/work-orders/work-orders-client.tsx
material-requests/material-requests-client.tsx
organization/organization-dashboard-client.tsx             ← KEEP (dashboard)
payments/[id]/payment-detail-client.tsx
payments/payments-client.tsx
… (~37 more)
```

Of the 77, roughly **64 are pure list/detail CRUD** and migrate away cleanly. The remaining 13 are dashboards / charts / tree views / wizards — **keep all of those**.

---

## 2. Migration recipe per page

### 2.1 List route (e.g. `customers/page.tsx`)

**Before** (current `app/dashboard/erp/customers/page.tsx`):
```tsx
import { listCustomers } from "@/app/dashboard/erp/customers/actions";
import CustomersClient from "@/app/dashboard/erp/customers/customers-client";

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const result = await listCustomers();
  const customers = result.success ? result.customers : [];
  return <CustomersClient initialCustomers={customers} />;
}
```

**After**:
```tsx
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';

// All Customer list logic lives in the generic /dashboard/erp/[doctype]
// route which auto-discovers metadata from tabDocField.
export default function CustomersPage() {
  redirect('/dashboard/erp/customer');
}
```

**Then delete**:
- `app/dashboard/erp/customers/customers-client.tsx`
- `app/dashboard/erp/customers/actions.ts` (only if no other file imports it — see §3.1)

### 2.2 Detail route (e.g. `customers/[id]/page.tsx`)

**Before**:
```tsx
import { getCustomer } from "@/app/dashboard/erp/customers/actions";
import CustomerDetailClient from "./customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCustomer(id);
  if (!result.success) return notFound();
  return <CustomerDetailClient customer={result.customer} />;
}
```

**After**:
```tsx
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/customer/${encodeURIComponent(id)}`);
}
```

**Then delete**:
- `app/dashboard/erp/customers/[id]/customer-detail-client.tsx`

### 2.3 Why redirect, not inline-mount

Inline-mounting `<ERPFormClient doctype="customer" record={...} />` works, but every page would need to re-implement the data-fetching path that `/dashboard/erp/[doctype]/[name]/page.tsx` already does (fetch record + child tables + permissions + metadata probe). Redirect is a one-line forward to the single source of truth.

The cost is **one extra HTTP redirect** on first navigation to the old URL; subsequent clicks from the sidebar already use the canonical `/dashboard/erp/customer` URL because the sidebar (Stage 0) was updated in commit `cec11ca`.

### 2.4 Sidebar entry verification

Before deleting a page, confirm there's a sidebar entry pointing to the canonical `/dashboard/erp/<doctype>` path. Check `components/desktop/sidebar.tsx` — there are 194 entries already. The migration only DELETES routes that the sidebar doesn't need to point at directly.

---

## 3. What to actually delete

### 3.1 `actions.ts` files (43 total)
Most are pure data-fetchers (`listX`, `getX`, `createX`, `updateX`, `deleteX`) duplicating what `app/dashboard/erp/[doctype]/[name]/actions.ts` already does generically. Delete after a grep confirms no other file imports them:

```bash
# For each candidate actions.ts, check usage outside its own module:
for f in $(find app/dashboard/erp -name "actions.ts" -not -path "*/[doctype]/*" -not -path "*/import/*"); do
  dir=$(dirname "$f")
  name=$(basename "$dir")
  refs=$(grep -rln "from.*['\"]@/$dir" app/ lib/ 2>/dev/null | grep -v "^$dir" | wc -l)
  echo "$f → external refs: $refs"
done
```

Anything with `external refs: 0` is safe to delete. References that DO exist usually come from one of three places:
1. **The matching `page.tsx` you're about to redirect** — deleting that means deleting this action too.
2. **The `*-client.tsx` you're about to delete** — same.
3. **AI tool implementations in `lib/ai/`** — these reuse the per-module action's typed return shape. Two options: (a) keep the action file but remove the page reference, or (b) port the AI tool to use the generic `fetchDoctypeList` and delete.

### 3.2 `*-client.tsx` files (64 list/detail clients)
Delete all 64 unconditionally after the matching `page.tsx` redirects out. The 13 dashboards / Chart of Accounts tree / Import / Setup wizards stay.

### 3.3 `loading.tsx` / `error.tsx` boundaries
Per module these are fine; they apply to whatever the route renders. **Don't delete** — they make the redirect target's loading state look right too.

---

## 4. Per-module migration table

Status `M` = migrate (page → redirect; client+actions deleted), `K` = keep, `?` = inspect first.

| Module / Path | List page | Detail page | Custom client | Notes |
|---|---|---|---|---|
| `accounts/` | M `→ /erp/account` | M `→ /erp/account/<id>` | invoice-detail-client kept (different doctype) | Three siblings (bank-accounts, budgets, cost-centers) — all M |
| `accounts/invoicing-dashboard-client.tsx` | K | K | K | Dashboard |
| `assets/` | M `→ /erp/asset` | M | — | |
| `assets/assets-dashboard-client.tsx` | K | K | K | Dashboard |
| `buying/buying-dashboard-client.tsx` | K | K | K | Dashboard |
| `buying/invoices/` | M `→ /erp/purchase-invoice` | M | — | |
| `buying/rfq/` | M `→ /erp/request-for-quotation` | M | — | |
| `chart-of-accounts/` | K | — | K | Tree view, unique UX |
| `crm/contracts/` | M `→ /erp/contract` | M | — | |
| `crm/crm-dashboard-client.tsx` | K | K | K | Dashboard |
| `crm/leads/` | M `→ /erp/lead` | M | — | |
| `crm/opportunities/` | M `→ /erp/opportunity` | M | — | |
| `customers/` | M `→ /erp/customer` | M | — | |
| `hr/` | M `→ /erp/employee` | M | — | (HR dashboard kept) |
| `hr/hr-dashboard-client.tsx` | K | K | K | Dashboard |
| `import/` | K | — | K | Bulk import wizard |
| `journal-entries/` | M `→ /erp/journal-entry` | — | — | List only |
| `manufacturing/bom/` | M `→ /erp/bom` | — | — | |
| `manufacturing/job-cards/` | M `→ /erp/job-card` | — | — | |
| `manufacturing/manufacturing-dashboard-client.tsx` | K | K | K | Dashboard |
| `manufacturing/work-orders/` | M `→ /erp/work-order` | M | — | |
| `material-requests/` | M `→ /erp/material-request` | — | — | |
| `organization/` | K | K | K | Dashboard (single page) |
| `payments/` | M `→ /erp/payment-entry` | M | — | |
| `procurement/` | ? | ? | ? | Combined Supplier + PO — inspect, may need split into two redirects |
| `projects/` | M `→ /erp/project` | M | — | (Projects dashboard kept) |
| `projects/projects-dashboard` | K | K | K | Dashboard |
| `projects/tasks/` | M `→ /erp/task` | M | — | |
| `quality/` | K | K | K | Module landing only — no list page exists |
| `quotations/` | M `→ /erp/quotation` | M | — | |
| `reports/*` | K | K | K | All 4 reports: BS / P&L / TB / GL |
| `sales-orders/` | M `→ /erp/sales-order` | M | — | |
| `selling/invoices/` | M `→ /erp/sales-invoice` | M | — | |
| `selling/selling-dashboard-client.tsx` | K | K | K | Dashboard |
| `settings/` | K | K | K | Settings hub |
| `setup/company/` | ? | ? | ? | Likely a one-off wizard — inspect |
| `setup/fiscal-years/` | M `→ /erp/fiscal-year` | M | — | |
| `stock/delivery-notes/` | M `→ /erp/delivery-note` | M | — | |
| `stock/entries/` | M `→ /erp/stock-entry` | M | — | |
| `stock/purchase-receipts/` | M `→ /erp/purchase-receipt` | M | — | |
| `stock/warehouses/` | M `→ /erp/warehouse` | M | — | |
| `stock/stock-dashboard-client.tsx` | K | K | K | Dashboard |
| `support/issues/` | M `→ /erp/issue` | M | — | |
| `timesheets/` | M `→ /erp/timesheet` | — | — | |

**Count**: 32 list pages migrate · 23 detail pages migrate · 64 client files deleted · 13 dashboards + 4 reports + Chart of Accounts + Import + Setup pages kept.

---

## 5. Order of operations

Migrating all 32 modules in one PR is painful to review. Split into **5 PRs** by module group:

### PR 3.1 — Selling (4 routes)
- `customers/` `quotations/` `sales-orders/` `selling/invoices/`
- Smallest blast radius; easiest review

### PR 3.2 — Buying & Stock (8 routes)
- `procurement/` `buying/invoices/` `buying/rfq/` `material-requests/`
- `stock/entries/` `stock/delivery-notes/` `stock/purchase-receipts/` `stock/warehouses/`

### PR 3.3 — Accounting (7 routes)
- `accounts/` `accounts/bank-accounts/` `accounts/budgets/` `accounts/cost-centers/`
- `journal-entries/` `payments/`
- `setup/fiscal-years/`

### PR 3.4 — CRM, HR, Support (6 routes)
- `crm/leads/` `crm/opportunities/` `crm/contracts/`
- `hr/`
- `support/issues/`
- `timesheets/`

### PR 3.5 — Assets & Manufacturing & Projects (5 routes)
- `assets/`
- `manufacturing/bom/` `manufacturing/job-cards/` `manufacturing/work-orders/`
- `projects/` `projects/tasks/`

Each PR follows the same recipe (§2), passes `bun run build` + `bunx tsc --noEmit`, runs the screenshot script against 2–3 representative URLs, then merges.

---

## 6. Testing plan

### 6.1 Per-PR smoke test
For each migrated module:
1. `bun run build` clean.
2. `bunx tsc --noEmit` clean.
3. Login + navigate to **at least one** of:
   - The old URL — assert 308 redirect to canonical.
   - The canonical URL — assert tabs/columns render via metadata.
   - The same record's detail page — same.

Extend `scripts/e2e/screenshot-supplier.ts` to a parameterised `screenshot-doctype.ts <doctype> <example-name>` and run it per module in CI.

### 6.2 AI dispatcher regression
The AI chat panel registers actions per page. Migrated routes mount the new `ERPListClient`/`ERPFormClient` which register their own actions. After each PR, run the AI test in `scripts/e2e/run-suite.ts` (phase `ai`) against one migrated doctype.

### 6.3 Permissions regression
The RBAC middleware in `middleware.ts` matches paths like `/dashboard/erp/accounts`. After migrating `accounts/`, that prefix still matches because we redirect from there. Verify by logging in as a role that DOESN'T have accounts permission and confirming the redirect chain still gates correctly.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| A custom client did MORE than basic CRUD (e.g. custom buttons, charts, KPIs) | Each detail-client identified as "M" in §4 should be diffed against the generic `ERPFormClient` capabilities. If a feature is missing (e.g. an `Approve` button on `Enquiry`), either (a) port the feature into `ERPFormClient` behind a per-doctype config map, or (b) downgrade the row to "K" |
| A custom list had business-logic filters (e.g. "open invoices only") | Add the filter to `LIST_VIEW_OVERRIDES` from Stage 1 — extend it with `defaultFilters: Record<string, FilterValue>` |
| A custom action.ts is imported by AI tool definitions in `lib/ai/` | Grep before delete (§3.1). When imported, refactor the AI tool to use the generic `fetchDoctypeList` / `fetchDoctypeRecord` |
| Old URL is bookmarked / linked externally → redirect works but `<Link href>` in unrelated code may still target the old path | Grep for hardcoded paths; replace with canonical `/dashboard/erp/<doctype>`. `Sidebar` is already canonical (commit `cec11ca`) |
| `chart-of-accounts/` is kept — does its sidebar link still work? | Keep the route. The sidebar links to it independently of the migration |

---

## 8. After-state inventory

**Files deleted** (approximate per-PR counts):

| PR | List clients | Detail clients | Actions files | Total |
|---|---|---|---|---|
| 3.1 Selling | 4 | 4 | 4 | 12 |
| 3.2 Buying & Stock | 8 | 6 | 8 | 22 |
| 3.3 Accounting | 7 | 6 | 7 | 20 |
| 3.4 CRM/HR/Support | 6 | 5 | 6 | 17 |
| 3.5 Assets/Mfg/Projects | 5 | 4 | 5 | 14 |
| **Total** | **30** | **25** | **30** | **~85 files** |

**Files kept**:
- All 13 module dashboards
- 4 financial reports (BS, P&L, TB, GL)
- Chart of Accounts tree
- Import wizard
- Settings hub
- Setup wizards
- The generic `app/dashboard/erp/[doctype]/` route pair (now the single source of truth)
- The `app/dashboard/erp/components/erp-meta/` directory

**Net result**: ~85 files deleted · 32 thin redirect pages remain · all heavy logic concentrated in `ERPListClient` + `ERPFormClient` + `ERPGridClient`.

**Estimated net code reduction**: ~9,000 lines (averaging ~120 LOC per deleted file across 85 files).
