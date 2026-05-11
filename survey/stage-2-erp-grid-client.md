# Stage 2 — Inline Child-Table Editing (`ERPGridClient`)

> **Goal**: Replace the placeholder child-table renderer in `ERPFormClient` (currently a `<pre>{json}</pre>` for the first 3 rows) with an inline-editable grid that mirrors Frappe's `Grid` widget — same column set the child DocType marks with `in_list_view`, add/delete/reorder rows, currency totals, optional row expand.
>
> **Outcome at end of stage**: On `/dashboard/erp/sales-invoice/<name>`, the **Items** child table shows as a proper inline grid with columns `Item Code · Qty · Rate · Amount`, inline editing, add-row, delete, drag-reorder, and a totals footer. Same on every Tab Break / child table everywhere.
>
> **Effort**: 1.5–2 days
>
> **Depends on**: Stage 1 doesn't have to ship first, but `list-cell.tsx` (created there) is reused for read-only cell formatting — keep that in mind for ordering.

---

## 1. Files to create

### 1.1 `app/dashboard/erp/components/erp-meta/ERPGridClient.tsx`
Main component.

**Contract**:
```ts
interface ERPGridClientProps {
  parentDoctype: string;                    // url slug of the parent ("sales-invoice")
  parentName: string | null;                // PK of the parent row, or null on /new
  childDoctype: string;                     // display label ("Sales Invoice Item")
  fieldname: string;                        // parent field that owns this grid ("items")
  rows: Record<string, unknown>[];          // initial child rows
  editable: boolean;                        // tied to ERPFormClient's `isEditing`
  reqd: boolean;                            // header asterisk
  label: string | null;
  onRowsChange: (rows: Record<string, unknown>[]) => void;
}
```

**Internal flow**:
1. `useDocTypeMeta(toKebabCase(childDoctype))` — loads the child's metadata.
2. `columns = meta.list_view_fields` (filter Tab/Section/Column/Table out — already handled by `loadDocTypeMeta`). Cap at 6 columns visible by default; the rest are accessible via a per-row `↕ Expand` button.
3. Local rows state mirrors the prop on first mount; emits changes upward via `onRowsChange` debounced 200 ms.
4. Renders:
   - Card header with `label`, row count, `+ Add Row` button (editable only), `↕ Bulk edit` button.
   - `<table>` with `Idx · …columns · Actions`.
   - Footer row: blank cells, except for `Currency`/`Float` columns which sum the column (skip `Int` unless name matches `qty|hours|count`).

### 1.2 `app/dashboard/erp/components/erp-meta/grid-cell.tsx`
Per-`fieldtype` inline editor — much narrower than `ERPFieldRenderer` because a grid cell is constrained to ~150 px wide and read-only fields render inline plain text.

| `fieldtype` | Editor |
|---|---|
| `Data`, `Small Text`, `Read Only` | `<input type="text">` |
| `Int` | `<input type="number" step="1">` |
| `Float`, `Currency`, `Percent` | `<input type="number" step="0.01">` |
| `Date` | `<input type="date">` |
| `Datetime` | `<input type="datetime-local">` |
| `Check` | `<input type="checkbox">` |
| `Link` | inline `LinkFieldCombobox` (compact variant, `size="sm"`) |
| `Select`, `Autocomplete` | native `<select>` (lighter than shadcn `Select` for grids) |
| `Text`, `Long Text` | inline single-line `<input>`; clicking expand opens a side panel `Sheet` for the full textarea |
| anything else | `<input type="text">` read-only |

All editors use unstyled `<input>` tags (no border, transparent bg, fill the cell). On focus, border lights up `border-primary`. On invalid (red border via `aria-invalid="true"`).

### 1.3 `app/dashboard/erp/components/erp-meta/grid-row-actions.tsx`
The right-side per-row icon column.
- 6-dot drag handle (`GripVertical`) — only visible in editable mode.
- `↕` row-expand toggle.
- `⋯` overflow menu with `Duplicate`, `Insert Above`, `Insert Below`, `Delete`.

Drag-reorder uses `@dnd-kit/core` + `@dnd-kit/sortable`. **Check `package.json` first** — if not installed, run `bun add @dnd-kit/core @dnd-kit/sortable`.

### 1.4 `app/dashboard/erp/components/erp-meta/grid-expand-panel.tsx`
Sheet (shadcn `Sheet`, slides in from the right) that opens when the user clicks a row's expand button. Shows **all** fields of the child DocType using `ERPTabLayout` (it works on child meta too because Frappe child DocTypes have the same `Tab Break / Section Break / Column Break` structure).

This panel makes the in-row editor approachable for fields that don't fit horizontally (Text/Long Text/HTML/Tax columns).

---

## 2. Files to modify

### 2.1 `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
Replace the `renderTable` placeholder at lines ~225–250 with an `ERPGridClient` mount:

```tsx
const renderTable = useCallback((field: DocFieldMeta) => {
  const rows = (isEditing ? editChildTables : childTables)[field.fieldname] ?? [];
  const onRowsChange = (next: Record<string, unknown>[]) =>
    setEditChildTables((prev) => ({ ...prev, [field.fieldname]: next }));
  return (
    <ERPGridClient
      parentDoctype={doctype}
      parentName={recordName || null}
      childDoctype={field.options ?? ''}
      fieldname={field.fieldname}
      rows={rows}
      editable={isEditing}
      reqd={field.reqd}
      label={field.label}
      onRowsChange={onRowsChange}
    />
  );
}, [doctype, recordName, isEditing, childTables, editChildTables]);
```

This requires `ERPFormClient` to track `editChildTables` state (mirror what `GenericDetailClient` lines 218–331 already does). Lift it up: add a `useState<Record<string, Record<string,unknown>[]>>` and copy the `handleAddChildRow / handleDeleteChildRow / handleChildCellChange` callbacks from `GenericDetailClient` into `ERPFormClient`. **Do not import from `GenericDetailClient`** — those are inlined helpers; copy them into a new file `erp-meta/use-edit-child-tables.ts` so both forms can share if needed later.

### 2.2 `app/dashboard/erp/[doctype]/[name]/actions.ts`
`updateDoctypeRecord` already strips child arrays (line 158 strips arrays from `updateData`). For child saves it needs a sibling action:

```ts
export async function saveChildTableRows(
  parentDoctype: string,
  parentName: string,
  fieldname: string,
  rows: Record<string, unknown>[],
): Promise<ActionResult<{ deleted: number; created: number; updated: number }>>
```

Implementation:
1. Resolve child accessor via `findChildAccessors(parentDoctype)` (already exists) — filter to `parentfield === fieldname`.
2. In a transaction:
   - `tx.<childModel>.deleteMany({ where: { parent: parentName, parentfield: fieldname } })`
   - `tx.<childModel>.createMany({ data: rows.map((r, i) => ({ ...r, parent: parentName, parenttype: toDisplayLabel(parentDoctype), parentfield: fieldname, idx: i + 1, name: r.name ?? crypto.randomUUID() })) })`
3. Return counts.

**Why delete-then-create**: easier than diffing, the transaction is fast, and Frappe itself does effectively the same dance on `child.save()`. If row counts get high (>500 rows per child table — rare in practice), revisit with upsert.

### 2.3 `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx` save path
After `updateDoctypeRecord` succeeds, walk `editChildTables` and call `saveChildTableRows` per fieldname, in parallel via `Promise.all`. Show a `Saving X child tables…` indicator. On any failure, surface the error and **don't** refresh — the parent saved but children didn't, so the user can retry without losing edits.

### 2.4 `lib/erpnext/doctype-meta.ts`
No change. The metadata already includes `meta.child_tables` derived from `Table`-fieldtype rows.

---

## 3. Wire-up checklist

| Concern | Implementation |
|---|---|
| Column ordering | `meta.list_view_fields` is already ordered by `idx` — use as-is |
| Currency formatting | reuse `formatListCell` from Stage 1's `list-cell.tsx` |
| Default values for new rows | `meta.fields.filter(f => f.default).reduce(...)` — `field.default` comes through as a string; numeric fields get `Number(default)` |
| Required-field validation | per-row: if a column's field has `reqd=true` and the cell is empty, mark `aria-invalid="true"`. Surface "Row N: <label> is required" via the parent `ERPFormClient` validate hook |
| `Read Only` row computed fields (e.g. `amount = qty * rate`) | recompute in cell-change handler; the underlying controller will recompute on submit anyway |
| Idx after reorder | rewrite `idx = i + 1` on every `onRowsChange` emission |
| Sticky header for long grids | `position: sticky; top: 0` on `<thead>` |
| Mobile view | render as a stacked card list (one card per row) — same pattern as `MobileList` in `GenericListClient.tsx` lines 600–668 |

---

## 4. Testing plan

### 4.1 Type/build
```bash
bun run build
bunx tsc --noEmit
```

### 4.2 Functional E2E
New script `scripts/e2e/grid-test.ts`:
1. Login, navigate to `/dashboard/erp/sales-invoice/new`.
2. Fill scalar fields (customer, posting_date).
3. Click `+ Add Row` on the Items grid → fill item_code (Link combobox), qty=2, rate=100.
4. Assert `amount` cell shows `200.00` and the footer total reads `200.00`.
5. Click Save → verify the request goes through and the redirect lands on the created invoice.
6. Reload the detail page → assert the row is persisted with the same values.
7. Edit → reorder rows by drag → save → reload → assert order persists (`idx` field).
8. Delete one row → save → reload → assert it's gone.
9. Drop screenshots in `test-output/parity/grid-*.png`.

### 4.3 Regression
- The old `GenericDetailClient` still works for doctypes without `tabDocField` rows; its existing child-table rendering at lines 721–858 isn't touched. Verify with `/dashboard/erp/enquiry/<name>`.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Delete-then-create breaks referential integrity (e.g. `GlEntry` references `SalesInvoiceItem.name`) | Submit-time only — Drafts have no GL/SLE yet. For Submitted/Cancelled records, the parent's docstatus blocks the parent update first (`updateDoctypeRecord` already enforces `docstatus !== 1`) |
| Grid cell input handlers thrash React state on every keystroke | Debounce 200ms on `onRowsChange`; keep cell-local state |
| 50+ rows × 8 columns rerender on each keystroke | Memoize each `<TableRow>` by `row.name`; pull cell components into separate memoized children |
| Drag-reorder library bundle weight | `@dnd-kit` core+sortable adds ~30 KB gzip — acceptable; alternative is plain HTML5 drag-and-drop but it has cross-browser pain |
| Long Text inside a grid | falls back to single-line preview + Expand panel; doesn't try to render multi-line in-cell |

---

## 6. Order of operations

```
1. (10 min)   Check/install @dnd-kit/core + @dnd-kit/sortable
2. (30 min)   grid-cell.tsx — per-fieldtype inline editor
3. (30 min)   grid-row-actions.tsx — drag handle + ⋯ menu
4. (1 hr)     ERPGridClient.tsx — table layout + totals footer + add/delete
5. (45 min)   grid-expand-panel.tsx — Sheet + ERPTabLayout reuse
6. (45 min)   actions.ts — saveChildTableRows server action
7. (30 min)   ERPFormClient.tsx — replace renderTable placeholder + wire save chain
8. (30 min)   use-edit-child-tables.ts — extract reusable state hook
9. (1 hr)     E2E test + screenshots
10. (15 min)  Commit + push to claude/parity-gap-close
```

**Total ~6 hours**; full calendar day with review.

---

## 7. After-state inventory

| Path | Status |
|---|---|
| `app/dashboard/erp/components/erp-meta/ERPGridClient.tsx` | new |
| `app/dashboard/erp/components/erp-meta/grid-cell.tsx` | new |
| `app/dashboard/erp/components/erp-meta/grid-row-actions.tsx` | new |
| `app/dashboard/erp/components/erp-meta/grid-expand-panel.tsx` | new |
| `app/dashboard/erp/components/erp-meta/use-edit-child-tables.ts` | new |
| `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx` | modified (renderTable now mounts grid; child state lifted) |
| `app/dashboard/erp/[doctype]/[name]/actions.ts` | added `saveChildTableRows` |
| `app/dashboard/erp/[doctype]/[name]/GenericDetailClient.tsx` | unchanged (legacy fallback) |
| `scripts/e2e/grid-test.ts` | new |

**Net code added**: ~1100 lines  
**Visual outcome**: opening a Sales Invoice or Purchase Order shows a real grid for `items`, identical-feeling to localhost:8000.
