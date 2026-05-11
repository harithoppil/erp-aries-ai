# Stage 1 — Metadata-Driven List View (`ERPListClient` + `ERPFilterBar`)

> **Goal**: Replace the auto-detecting `GenericListClient` (which picks an arbitrary 5–10 columns from the first row) with a metadata-driven list view that reads `tabDocField.in_list_view` / `in_standard_filter` to render proper columns and a real filter bar.
>
> **Outcome at end of stage**: `/dashboard/erp/<any-doctype>` matches the column set and filter bar that ERPNext (`localhost:8000`) shows for the same doctype, with type-aware cell formatting and a typed filter bar driven by `standard_filters`.
>
> **Effort**: 1.5–2 days
>
> **Depends on**: nothing new — the `DocField` model, `loadDocTypeMeta()`, and `/api/erpnext/meta/[doctype]` shipped in commit `616cb12` already provide everything needed.

---

## 1. Files to create

### 1.1 `app/dashboard/erp/components/erp-meta/ERPListClient.tsx`
The list/table component. Same external props as `GenericListClient` (`doctype`, `initialData`, `meta`) so existing routes can swap it in by a one-line import change.

**Contract**:
```ts
interface ERPListClientProps {
  doctype: string;                                  // url slug, e.g. "supplier"
  initialData: Record<string, unknown>[];           // SSR first-page rows
  meta: ListMeta;                                   // pagination meta
}
```

**Internal flow**:
1. `useDocTypeMeta(doctype)` from `app/dashboard/erp/components/erp-meta/useDocTypeMeta.ts` (already exists).
2. Build column definitions from `meta.list_view_fields` plus a permanent `Name` column at the front and a `Status` (docstatus) column at the end.
3. Per-column type-aware renderers — see §1.1.1.
4. Filter bar mounts `ERPFilterBar` with `meta.standard_filters` and lifts filter state up.
5. Sort/paginate state is the same as `GenericListClient` lines 158–230 — reuse the same `fetchDoctypeList` action; just pass an extra `filters` arg (§3).

**Cell rendering by `fieldtype`** (extracted to a small helper, see §1.4):

| `fieldtype` | Render |
|---|---|
| `Data`, `Small Text`, `Read Only`, `Password` | plain text, truncated to 60 chars |
| `Int` | `value.toLocaleString()` |
| `Float`, `Percent` | `value.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})` |
| `Currency` | `value.toLocaleString('en-AE', {style:'currency', currency: rowCurrency ?? 'AED'})` — `rowCurrency` is the value of the row's `currency` column if present, else AED |
| `Date` | `new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})` |
| `Datetime` | same + time `HH:mm` |
| `Check` | `<Badge variant={v?'default':'outline'}>{v?'Yes':'No'}</Badge>` |
| `Link` | `<Link href="/dashboard/erp/<options-slug>/<v>">{v}</Link>` — `options-slug` = kebab-case of `field.options` |
| `Select` | colored badge if the option set is one of the well-known status sets (Draft/Submitted/Cancelled/Open/Closed/Paid/etc.); else plain text |
| `Tab Break`/`Section Break`/`Column Break`/`Table`/`HTML` | never appear because `loadDocTypeMeta` filters them out of `list_view_fields` |

**Existing pieces to reuse verbatim**:
- Sticky header/footer layout: `GenericListClient.tsx` lines 348–474.
- Pagination controls: `GenericListClient.tsx` lines 442–470.
- AI action registration: `GenericListClient.tsx` lines 260–323 — keep as-is, change only the search action implementation to push into the new filter state.
- Mobile card variant: `MobileList` at `GenericListClient.tsx` lines 600–668. Refactor to take the same column array so it picks the same fields the desktop table shows.

### 1.2 `app/dashboard/erp/components/erp-meta/ERPFilterBar.tsx`
The horizontal filter bar above the table.

**Contract**:
```ts
interface ERPFilterBarProps {
  doctype: string;
  filters: StandardFilter[];                        // from meta.standard_filters
  value: Record<string, FilterValue>;
  onChange: (next: Record<string, FilterValue>) => void;
}
type FilterValue = string | number | boolean | { from: string; to: string } | null;
```

**Per-fieldtype input**:
| `fieldtype` | Input |
|---|---|
| `Link` | reuse `LinkFieldCombobox` from `app/dashboard/erp/[doctype]/[name]/LinkFieldCombobox.tsx`; pass `linkTo = field.options` |
| `Select` | shadcn `Select` with `field.options.split('\n')` |
| `Date` | two `Input[type=date]` rendered side-by-side to capture a range; value shape `{ from, to }` |
| `Datetime` | one `Input[type=datetime-local]` (start), one for end — same `{from,to}` shape |
| `Check` | tri-state shadcn `Select` with options `Any / Yes / No`; emits `null`/`true`/`false` |
| `Data`, `Small Text` | shadcn `Input` (debounced 250 ms via `useDebouncedValue` — already exists in `hooks/`) |
| `Int`/`Float`/`Currency` | two number inputs `min` and `max`, same `{from,to}` |

**Empty state**: if a field is `null` / empty string / `{from:'', to:''}`, exclude it from the outgoing filter triple set.

**Layout**:
- Show at most the **first six** filters by default. The rest are accessible via an "+ Add Filter" dropdown that opens a popover with checkboxes for every other `standard_filter`. State of which optional filters are visible lives in `localStorage` keyed by `erp-filter-visible:<doctype>`.
- A reset link (`<button>Clear all</button>`) on the right when `Object.keys(value).length > 0`.

### 1.3 `app/dashboard/erp/components/erp-meta/list-cell.tsx`
Pure render helpers — exported so `ERPGridClient` (Stage 2) can reuse the same formatting in child-table rows.

Exports:
```ts
export function formatListCell(value: unknown, field: DocFieldMeta, row: Record<string, unknown>): React.ReactNode
export function listColumnLabel(field: DocFieldMeta): string  // `field.label || field.fieldname.replace(/_/g,' ')`
export function statusBadge(status: unknown, fieldtype: string): React.ReactNode
```

`statusBadge` recognises a hard-coded palette for `Draft / Submitted / Cancelled / Open / Closed / Paid / Overdue / Approved / Pending / Active / Disabled`. Anything else falls back to outline-style.

### 1.4 `app/dashboard/erp/components/erp-meta/use-list-filters.ts`
Tiny hook that owns the filter map, syncs to the URL query string (so filtered lists are shareable), and debounces text-type changes.

```ts
function useListFilters(doctype: string, initial: Record<string, FilterValue> = {}): {
  filters: Record<string, FilterValue>;
  setFilter: (fieldname: string, v: FilterValue) => void;
  clearAll: () => void;
}
```

URL sync via `useRouter().replace(`?${qs}`)` — keep the call inside a `useEffect` to avoid SSR/hydration mismatches.

---

## 2. Files to modify

### 2.1 `app/dashboard/erp/[doctype]/actions.ts` — server action
Add `filters` to `FetchParams` and convert them into a Prisma `where` clause.

```ts
export interface FetchParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderby?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, FilterValue>;          // NEW
}
```

In `fetchDoctypeList`:
```ts
const where: Record<string, unknown> = params?.search
  ? { name: { contains: params.search, mode: 'insensitive' } }
  : {};

if (params?.filters) {
  for (const [k, v] of Object.entries(params.filters)) {
    if (v == null || v === '') continue;
    if (typeof v === 'object' && 'from' in v) {
      const fromTo: Record<string, unknown> = {};
      if (v.from) fromTo.gte = v.from;
      if (v.to)   fromTo.lte = v.to;
      if (Object.keys(fromTo).length > 0) where[k] = fromTo;
    } else if (typeof v === 'string' && /[*%]/.test(v)) {
      where[k] = { contains: v.replace(/[*%]/g, ''), mode: 'insensitive' };
    } else {
      where[k] = v;
    }
  }
}
```

This mirrors the existing `parseFilters` already in `app/api/erpnext/[doctype]/route.ts` lines 92–174 — port that helper into the action so both share one implementation.

### 2.2 `app/dashboard/erp/[doctype]/page.tsx` — server entry
The list-page server component currently fetches initial data and hands off to `GenericListClient`. Change the import to `ERPListClient` and also pull metadata server-side so the first render isn't blocked on a client roundtrip:

```ts
import { loadDocTypeMeta } from '@/lib/erpnext/doctype-meta';
import ERPListClient from '@/app/dashboard/erp/components/erp-meta/ERPListClient';
// ...
const meta = await loadDocTypeMeta(toDisplayLabel(doctype)).catch(() => null);
if (!meta) return <GenericListClient ... />;  // fallback
return <ERPListClient doctype={doctype} initialData={...} initialMeta={meta} ... />;
```

### 2.3 `app/dashboard/erp/[doctype]/GenericListClient.tsx`
Keep it. It becomes the fallback for doctypes that don't have `tabDocField` rows. No code change required at this stage.

### 2.4 `app/api/erpnext/meta/[doctype]/route.ts`
No change. The endpoint already returns `standard_filters` and `list_view_fields`.

### 2.5 `next.config.ts`
No change.

---

## 3. Per-doctype overrides (escape hatch)

A few doctypes need columns the metadata doesn't surface (e.g. our `Customer` list shows `outstanding` which doesn't have `in_list_view = 1` in Frappe stock). Build a tiny override table:

`lib/erpnext/list-view-overrides.ts`:
```ts
export const LIST_VIEW_OVERRIDES: Record<string, {
  append?: string[];                       // extra fieldnames to show
  hide?: string[];                         // fieldnames to remove
  defaultSort?: { field: string; dir: 'asc' | 'desc' };
}> = {
  'Customer':       { append: ['outstanding_amount'], defaultSort: { field: 'modified', dir: 'desc' } },
  'Sales Invoice':  { append: ['outstanding_amount', 'due_date'] },
  'Purchase Invoice': { append: ['outstanding_amount', 'due_date'] },
  // Add doctypes here as gaps surface.
};
```

`loadDocTypeMeta` applies these in `lib/erpnext/doctype-meta.ts` after computing `list_view_fields` and before caching.

---

## 4. Testing plan

### 4.1 Build
```bash
bun run build
bunx tsc --noEmit
```

### 4.2 Visual parity check
Add to `scripts/e2e/screenshot-supplier.ts` (already exists):
- After login, hit `/dashboard/erp/supplier` and `/dashboard/erp/customer` and `/dashboard/erp/sales-invoice`.
- Assert the rendered `<th>` set matches the expected columns coming from `tabDocField`.
- Drop screenshots under `test-output/parity/list-*.png`.

### 4.3 Filter functional test
New: `scripts/e2e/list-filter-test.ts`:
1. Visit `/dashboard/erp/sales-invoice`.
2. Pick a Link filter (customer), select a customer with ≥1 invoice from the dropdown.
3. Assert visible rows all have that customer in their Customer column.
4. Clear, then apply a Date range filter on posting_date, assert rows fall in range.

### 4.4 No regression on doctypes without metadata
Visit `/dashboard/erp/enquiry` (or any non-Frappe doctype) — should still render via the legacy `GenericListClient`.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `tabDocField.in_list_view` is too aggressive for some doctypes (e.g. `Item` has ~15 columns flagged) | Truncate to first 8 columns; full set available via a future "Columns" dropdown |
| Link-options string carries spaces (`"Sales Order"`) so building a URL slug needs care | Reuse `toKebabCase` from `lib/erpnext/prisma-delegate.ts` (already used by the sidebar) |
| Filter values for `Check` need tri-state, but URL sync only handles strings | Encode as `1`/`0`/empty in the URL; decode in `use-list-filters.ts` |
| Some doctypes (System, Framework) have `tabDocField` rows but no Prisma model → list page would 500 on fetch | `loadDocTypeMeta` already returns 404 for empty metadata; in the route the `where` `getDelegate(prisma, doctype)` returns null and surfaces a friendly "Unknown DocType" error. No new code needed |

---

## 6. Order of operations

```
1. (10 min)   Add list-view-overrides.ts (empty for now) + wire into loadDocTypeMeta
2. (30 min)   list-cell.tsx — render helpers + statusBadge palette
3. (1 hr)     ERPFilterBar.tsx — all 6 fieldtype inputs + Add Filter popover
4. (1.5 hrs)  ERPListClient.tsx — header/footer reuse + table + mobile cards + filter wiring
5. (45 min)   use-list-filters.ts — URL sync + debounce
6. (45 min)   actions.ts — extend FetchParams + filter where-builder; reuse parseFilters
7. (15 min)   page.tsx — swap default to ERPListClient
8. (1 hr)     E2E tests + screenshots
9. (30 min)   Commit + push to claude/parity-gap-close
```

**Total ~6 hours of focused work**; one calendar day to absorb review feedback.

---

## 7. After-state inventory

| Path | Status |
|---|---|
| `app/dashboard/erp/[doctype]/GenericListClient.tsx` | kept as fallback |
| `app/dashboard/erp/[doctype]/page.tsx` | uses `ERPListClient` when meta exists |
| `app/dashboard/erp/components/erp-meta/ERPListClient.tsx` | new |
| `app/dashboard/erp/components/erp-meta/ERPFilterBar.tsx` | new |
| `app/dashboard/erp/components/erp-meta/list-cell.tsx` | new |
| `app/dashboard/erp/components/erp-meta/use-list-filters.ts` | new |
| `app/dashboard/erp/[doctype]/actions.ts` | extended (`filters` param) |
| `lib/erpnext/list-view-overrides.ts` | new |
| `lib/erpnext/doctype-meta.ts` | applies overrides |
| `scripts/e2e/list-filter-test.ts` | new |

**Net code added**: ~900 lines  
**Net code untouched**: every per-module list page in §`app/dashboard/erp/*` continues to use its custom client until Stage 3 migrates them.
