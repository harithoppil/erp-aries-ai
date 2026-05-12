# Production Readiness Audit — ERPNext Next.js Frontend

> Date: 2026-05-12
> Compared against: `/Users/harithoppil/Desktop/game/erp-aries/frappe-bench/` (reference ERPNext)
> Security items explicitly excluded per instructions.

---

## 1. CRITICAL — Blocks Client Handoff

### C1. Naming Series NOT wired into create flow
- **File:** `app/dashboard/erp/[doctype]/[name]/actions.ts` — `createDoctypeRecord()`
- **Problem:** `createDoctypeRecord` generates names by guessing from label fields or using `DoctypeName-TIMESTAMP`. The entire `lib/erpnext/naming-series.ts` module (with `SINV-.YYYY.-00001` style naming) exists but is **never called** from the create action. Frappe generates names like `SINV-2026-00001`; our app generates names like `SalesInvoice-M4XK3F`.
- **Fix:** Import `generateDocName()` from naming-series and call it when `data.name` is empty, passing doctype and company.

### C2. No Amend button for cancelled documents (docstatus=2)
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** When a submittable document is cancelled (docstatus=2), Frappe shows an "Amend" button that creates a new document copying all fields from the cancelled one. Our form shows no action at all for cancelled docs — the user is stuck. The dropdown only has "Copy Name" and "Print PDF" for non-draft docs.
- **Fix:** Add an Amend button that navigates to `/dashboard/erp/${doctype}/new` with prefilled data from the cancelled record.

### C3. No Duplicate action on form
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** Frappe has a "Duplicate" action in the form toolbar. Our form's dropdown menu only has Copy Name, Print PDF, and Delete. No duplicate action exists.
- **Fix:** Add a menu item that navigates to `/dashboard/erp/${doctype}/new?source=${recordName}` and prepopulates from the source record.

### C4. Naming Series selection missing on New forms
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx` and `page.tsx`
- **Problem:** Frappe shows a `naming_series` Select field on new forms where users pick from available series (e.g., `SINV-2026-` vs `SINV-.YYYY.-`). Our implementation does not render this field at all, and there is no UI for series selection.
- **Fix:** When `doctype_info.naming_rule` is set, show the naming_series field as a Select in the form header or as the first field.

### C5. Child table save has orphan risk for NEW parent records
- **File:** `app/dashboard/erp/[doctype]/[name]/actions.ts` — `saveChildTableRows()`
- **Problem:** When creating a new record, child table rows are saved after the parent is created. However, `findChildAccessorForField` tries to find existing rows via `findFirst({where: {parent: parentName}})`. For a freshly created parent, no rows exist yet, so it falls back to `childAccessors[0]`, which may be the **wrong** child table model (e.g., taxes instead of items).
- **Fix:** Map child table models by their `parentfield` default value from Prisma DMMF, not by probing for existing rows.

### C6. `toDisplayLabel` used as registry key is fragile
- **File:** `app/dashboard/erp/[doctype]/[name]/actions.ts` — `submitDoctypeRecord()` and `cancelDoctypeRecord()`
- **Problem:** The URL slug `sales-invoice` gets converted to `Sales invoice` via `toDisplayLabel()`, but the orchestrator registry uses `Sales Invoice` (capital I). If `toDisplayLabel` does not properly title-case every word, submit/cancel silently falls through to `simpleSubmit` — no GL entries, no stock entries, no validation.
- **Fix:** Verify `toDisplayLabel` handles all cases correctly, or use a lookup map from kebab-slug to proper DocType name.

---

## 2. HIGH — Will Frustrate Users Immediately

### H1. No bulk select or bulk actions on list
- **File:** `app/dashboard/erp/components/erp-meta/ERPListClient.tsx`
- **Problem:** No row checkboxes for multi-select. Frappe supports bulk delete, bulk submit, bulk cancel, bulk assign, bulk print. Our implementation has only a per-row delete dropdown.
- **Fix:** Add checkbox column, "Select All" header, and bulk action toolbar that appears when rows are selected.

### H2. No inline edit on list view (double-click to edit cell)
- **File:** `app/dashboard/erp/components/erp-meta/ERPListClient.tsx`
- **Problem:** Frappe allows double-clicking a cell in list view to edit it inline. Our list is read-only; editing requires navigating to the full form.
- **Fix:** Add double-click to toggle inline edit mode on list cells.

### H3. ExportButton exists but NOT imported in ERPListClient
- **File:** `app/dashboard/erp/components/erp-meta/ERPListClient.tsx`
- **Problem:** An `ExportButton` component exists at `app/dashboard/erp/components/ExportButton.tsx` with CSV and Excel support, but it is **not imported or rendered** anywhere in `ERPListClient.tsx`.
- **Fix:** Import and render `<ExportButton>` in the list header toolbar.

### H4. Filter bar does not support all Frappe filter operators
- **File:** `app/dashboard/erp/[doctype]/actions.ts` — `fetchDoctypeList()`
- **Problem:** Only supports: equals, contains (with wildcards), and range (from/to). Missing: `!=`, `like`, `not like`, `>`, `<`, `>=`, `<=`, `in`, `not in`, `is set`, `is not set`.
- **Fix:** Extend `FilterValue` type and where-clause builder to handle all operators.

### H5. No timeline/activity feed on form
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** Frappe's form has a timeline sidebar showing comments, communications, version diffs, and activity. Our form has none of this.
- **Fix:** Add a collapsible sidebar or bottom panel that queries `_comments`, version history, and activity.

### H6. No Comments / Assignments / Attachments on form
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** Frappe forms have dedicated sections for comments, assigning to users, and attaching files. The `_comments`, `_assign`, `_liked_by` fields exist in the database but are never rendered.
- **Fix:** Add a sidebar panel with comment input, assign-to dropdown, and file upload.

### H7. Creation/Modified timestamps and owner info not shown
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** Frappe shows "Created by X on Y, Modified by Z on W" at the bottom of every form. Our form filters out `creation`, `modified`, `owner`, `modified_by` and never displays them.
- **Fix:** Render a footer bar with `Created by ${owner} on ${creation}`, `Modified by ${modified_by} on ${modified}`.

### H8. No column resize or reorder on list table
- **File:** `app/dashboard/erp/components/erp-meta/ERPListClient.tsx`
- **Problem:** Frappe allows dragging column borders to resize and headers to reorder. Our table is fixed HTML.
- **Fix:** Add column resize handles and drag-to-reorder headers.

### H9. Missing field types in ERPFieldRenderer
- **File:** `app/dashboard/erp/components/erp-meta/ERPFieldRenderer.tsx`
- **Problem:** Several field types fall through to a plain text `<Input>`:
  - `Attach` / `Attach Image` — rendered as plain text input instead of file picker
  - `Signature` — rendered as plain text input instead of signature pad
  - `Geolocation` — rendered as default text input instead of map
  - `Rating` — not handled, falls to default text input
  - `Duration` — not handled, falls to default text input
  - `Icon` — not handled, falls to default text input
  - `Barcode` — not handled, falls to default text input
  - `MultiCheck` — not handled
  - `MultiSelect` / `MultiSelect Pair` — not handled
  - `Date Range` — not handled
  - `Iframe` — not handled
  - `Phone` — not handled
  - `Text Editor` / `HTML Editor` — edit mode falls to plain input
- **Fix:** Implement proper widgets for each type. At minimum: Attach needs file upload, Rating needs stars, Text Editor needs rich text.

### H10. Grid does not validate required fields per row
- **File:** `app/dashboard/erp/components/erp-meta/ERPGridClient.tsx`
- **Problem:** No per-row validation when saving child table rows. Required fields (like `item_code` in invoice items) can be left empty. Frappe highlights the row and shows "Mandatory fields required".
- **Fix:** Add `validateRow()` that checks all `reqd` fields before emitting rows upward.

### H11. No Print Format selection
- **File:** `app/dashboard/erp/components/erp-meta/ERPFormClient.tsx`
- **Problem:** Print PDF button only generates one format. Frappe lets users pick from multiple Print Formats. Our print is a single hardcoded template.
- **Fix:** Add Print Format selector dropdown next to the Print button, listing formats from the `print_format` table.

---

## 3. MEDIUM — Frappe Features We Don't Have (acknowledge to client)

| # | Feature | Notes |
|---|---------|-------|
| M1 | Workflow engine (state transitions, approval flows) | No workflow UI or engine. `app/dashboard/pipeline/` exists but is standalone |
| M2 | Calendar View on lists | Frappe offers Calendar/Gantt/Kanban/Report/Dashboard toggles on list pages |
| M3 | Gantt View | Projects and tasks need this |
| M4 | Kanban Board view | Opportunities, Leads, Tasks use Kanban in Frappe |
| M5 | Report View toggle on lists | Pivot/group/aggregate list data |
| M6 | Dashboard View toggle on lists | Charts based on doctype data |
| M7 | Global search bar (Ctrl+K / command palette) | Frappe searches across all doctypes from the header |
| M8 | Keyboard shortcuts | No Ctrl+S (save), Ctrl+B (new), Esc (close) |
| M9 | Dark mode | No theme toggle; shadcn/ui supports it via CSS vars |
| M10 | Email integration from form | No "Send Email" action on forms |
| M11 | Data Import tool | Import page may exist but not connected to metadata-driven field mapping |
| M12 | Rename or Merge functionality | Frappe allows renaming records and merging duplicates |
| M13 | Tree view for hierarchical doctypes | Only Chart of Accounts has a tree; Item Group, Customer Group, Territory need one too |
| M14 | Portal (customer/supplier self-service) | Out of scope for initial launch |
| M15 | Customization UI (Custom Field / Property Setter creation) | We read them but provide no UI to create them |
| M16 | Module landing pages may be hardcoded | Verify dashboards render real data |
| M17 | Notification center | No notification bell in header |
| M18 | Recent documents list | No recently viewed docs in sidebar |

---

## 4. LOW — Nice-to-Haves, Polish Items

| # | Item | File |
|---|------|------|
| L1 | No row-level delete confirmation in grid — deletes instantly | `ERPGridClient.tsx` |
| L2 | No Move Up / Move Down row buttons in grid (only drag) | `grid-row-actions.tsx` |
| L3 | Currency hardcoded to AED in grid totals | `ERPGridClient.tsx` |
| L4 | Breadcrumb hardcodes "ERP" link to `/dashboard/erp/selling` instead of using doctype module | `ERPListClient.tsx` |
| L5 | No spinner icon inside submit/cancel buttons during loading | `ERPFormClient.tsx` |
| L6 | No optimistic UI update after save — full server re-render flash | `ERPFormClient.tsx` |
| L7 | PRINTABLE set incomplete — only 7 doctypes | `ERPFormClient.tsx` |
| L8 | No "+" button on Link fields to create new target record | `LinkFieldCombobox.tsx` |

---

## 5. ALREADY DONE — Working Correctly

- Form layout engine (Tab Break → Section Break → Column Break → Field) via `ERPTabLayout.tsx`
- DocField metadata pipeline (5-table merge: DocField + CustomField + PropertySetter + DocType + DocPerm)
- Edit → Save → Submit → Cancel docstatus workflow in ERPFormClient
- Document orchestrator with GL/Stock/Status controllers for 40+ doctypes
- Child table grid (ERPGridClient) with add/delete/duplicate/insert/drag-reorder/expand/totals
- Field dependency resolution (`depends_on`, `mandatory_depends_on`, `read_only_depends_on`)
- Fetch-from auto-population on Link field change
- Filter bar with per-fieldtype standard filters
- Print PDF via `/print/erp/[doctype]/[name]`
- Reports: Trial Balance, General Ledger, Balance Sheet, Profit and Loss
- Chart of Accounts tree view
- Module dashboards (Selling, Buying, Stock, Manufacturing, Accounting, HR, CRM, Support, Assets, Projects)
- AI integration (assistant panel, action dispatcher, page context)
- Mobile responsive layouts (separate desktop/mobile in List and Grid)
- Toast notifications (sonner) on save/create/delete/submit/cancel/error
- Breadcrumb navigation on list and module pages
- Export utilities (CSV and Excel) — `ExportButton` component ready but not yet wired
- Zod validation pipeline for required fields
- RBAC permission checking in orchestrator
- Soft delete / docstatus-based delete prevention
- `set_only_once`, `allow_on_submit`, `collapsible_depends_on`, `hide_border` handled in layout
- Debounced search with `search_fields` from doctype info
- Column header click to sort with visual indicator
- Pagination (page size 20)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 11 |
| MEDIUM | 18 |
| LOW | 8 |
| DONE | ~25 features confirmed working |

**Estimated effort for CRITICAL + HIGH:** ~3-4 focused agent rounds to unblock client handoff.
