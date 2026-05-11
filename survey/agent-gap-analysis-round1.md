# Agent Gap Analysis — Round 1

> Date: 2026-05-11
> All 4 code agents + 1 explore agent completed (3 hit rate limits near the end)

---

## Agent 1: doctype-meta.ts (5-Table Merge Pipeline)

**Status**: ~80% complete

### What it DID:
- Extended `DocFieldMeta` with all 21 new fields (fetch_from, is_virtual, bold, etc.)
- Added `DocTypeInfo` interface (17 fields) and `DocPermInfo` interface
- Extended `DocTypeMeta` with `doctype_info` and `permissions`
- Extended `rowToMeta()` to map all new DocField columns
- Added `LIST_VIEW_OVERRIDES` inline and wired application logic
- Added `loadDocTypeMeta()` parallel fetch of `doc_type` row via `prisma.doc_type.findUnique`
- Constructed `doctype_info` object from DocType row with proper type conversion
- Applied list view overrides (append/hide)
- Changed `prisma.docField.findMany` → `prisma.doc_field.findMany` (matching new schema)

### What it DIDN'T:
- **CustomField merge** — `is_custom_field` is hardcoded `false`, no `custom_field` query
- **PropertySetter application** — no `property_setter` query, no property override logic
- **Field re-sorting** — no `sortFieldsByLayout()` function, no `insert_after` handling
- **DocPerm loading** — `permissions` field not populated (no `doc_perm` query)
- **LIST_VIEW_OVERRIDES duplicate** — Agent 4 created `lib/erpnext/list-view-overrides.ts` but Agent 1 inlined its own copy. Need to reconcile (use Agent 4's file, delete Agent 1's inline copy)
- `rowToMeta` still uses old `field_default`/`field_precision` mapping names — need to verify against new Prisma model column names from db pull

### Next-round prompt:
> Complete the 5-table merge pipeline in `lib/erpnext/doctype-meta.ts`. The types and DocType loading are done. Still needed:
> 1. Add `mergeCustomFields()`: query `prisma.custom_field.findMany({ where: { dt: doctype } })`, convert to DocFieldMeta with `is_custom_field: true`, append to fields array
> 2. Add `applyPropertySetters()`: query `prisma.property_setter.findMany({ where: { doc_type: doctype } })`, override field properties (hidden, reqd, label, default) and doctype properties (title_field, field_order)
> 3. Add `sortFieldsByLayout()`: handle `insert_after` from CustomField, handle `field_order` from PropertySetter
> 4. Add DocPerm loading: query `prisma.doc_perm.findMany({ where: { parent: doctype } })`, map to DocPermInfo[]
> 5. Remove inline LIST_VIEW_OVERRIDES and import from `lib/erpnext/list-view-overrides.ts` instead
> 6. Verify `rowToMeta` column names match the new Prisma schema (db pull renamed some columns)

---

## Agent 2: ERPFormClient + ERPTabLayout + ERPFieldRenderer

**Status**: ~90% complete

### What it DID:
- **ERPFormClient**: `title_field` resolution (`displayTitle`), `is_submittable` gating on Submit/Cancel buttons, `issingle` handling (hides name in header), icon resolution via `resolveIcon()`, `is_virtual` exclusion from save payload, passes `isNew`/`docstatus`/`isSubmittable` to ERPTabLayout
- **ERPTabLayout**: `set_only_once` (read-only on edit), `allow_on_submit` (editable when submitted), `bold` labels (`font-semibold`), `hide_border` (no Card wrapper), `collapsible_depends_on` evaluation (simple fieldname check, `eval:` warning)
- **ERPFieldRenderer**: `non_negative` (`min={0}` on numeric inputs), `fetch_from` indicator icon, `link_filters` JSON parsing (attached as data attribute)

### What it DIDN'T:
- **`issingle` "New" button hiding** — header still shows "New" for single doctypes (only hid the name display)
- **`editable_grid` passthrough** — not passed to ERPGridClient (future Stage 2)
- **`image_field` display** — no image thumbnail in form header or list
- **`quick_entry` mode** — no simplified dialog for quick_entry doctypes
- **`depends_on` conditional visibility** — fields with `depends_on` expressions still always visible
- **`mandatory_depends_on` / `read_only_depends_on`** — dynamic mandatory/read-only not evaluated

### Next-round prompt:
> Complete the ERPFormClient upgrade. Remaining work:
> 1. Hide "New" button when `doctypeInfo?.issingle` is true
> 2. Implement `depends_on` field visibility: parse simple expressions like `eval:doc.status=='Open'` or plain fieldname checks. Hide fields when expression is falsy
> 3. Implement `mandatory_depends_on`: when expression truthy, mark field as required dynamically
> 4. Implement `read_only_depends_on`: when expression truthy, mark field as read-only dynamically
> 5. Show `image_field` thumbnail in form header when `doctypeInfo?.image_field` is set

---

## Agent 3: ERPListClient + ERPFilterBar + list-cell + use-list-filters

**Status**: ~95% complete

### What it DID:
- Created `ERPListClient.tsx` (790 lines) — full metadata-driven list view
- Created `ERPFilterBar.tsx` (404 lines) — filter bar with per-fieldtype inputs
- Created `list-cell.tsx` (258 lines) — cell formatters with status badge palette
- Created `use-list-filters.ts` (141 lines) — filter state with URL sync + debounce
- Modified `page.tsx` — swaps to ERPListClient when metadata exists, falls back to GenericListClient
- Modified `actions.ts` — added `FilterValue` type, `filters` param, and where-clause builder

### What it DIDN'T:
- **`search_fields` multi-field search** — need to verify if ERPListClient uses `doctype_info.search_fields` for search or still only searches by `name`
- **`sort_field`/`sort_order` defaults** — need to verify if initial sort comes from `doctype_info`
- **AI action registration** — GenericListClient registers AI actions; ERPListClient must do the same
- **Mobile responsive card variant** — need to verify if mobile cards are implemented
- **`title_field` in Name column** — need to verify if list shows title_field value instead of name
- **`icon` in list header** — need to verify if doctype icon shows in list header
- Type-check — didn't get to run `tsc --noEmit` before rate limit

### Next-round prompt:
> Polish and verify ERPListClient. Check and fix:
> 1. Verify `doctype_info.search_fields` is used for search (not just `name`). If not, update search to query across all search_fields
> 2. Verify `doctype_info.sort_field`/`sort_order` sets initial sort state
> 3. Verify `doctype_info.title_field` is resolved in the Name column link text
> 4. Verify `doctype_info.icon` shows in list header
> 5. Add AI action registration (copy pattern from GenericListClient lines 260-323)
> 6. Verify mobile card variant renders properly
> 7. Run `tsc --noEmit` and fix all type errors

---

## Agent 4: list-view-overrides + meta API + utils

**Status**: 100% complete

### What it DID:
- Created `lib/erpnext/list-view-overrides.ts` — fully typed, clean
- Updated meta API route — added `doctype_info` and `permissions` with fallback
- Created `lib/erpnext/utils.ts` with `toKebabCase`
- Verified `useDocTypeMeta.ts` needs no changes (passes through all fields)
- Added TODO comment in `doctype-meta.ts` for overrides wiring

### What it DIDN'T:
- Nothing — fully complete. But Agent 1 duplicated the overrides inline, so that needs reconciliation.

---

## AI Assistant Audit (Explore Agent)

**Status**: Incomplete — hit rate limit before writing report

### What it found (from tool calls, ~76 tool uses):
The agent explored extensively but didn't write the `.md` report. Need to re-run.

### Next-round prompt:
> Re-run the AI assistant audit. Search for:
> - `lib/ai/` directory, `registerAction`, `aiAction`, `pageContext`, `usePageContext`
> - AI action registrations in GenericListClient.tsx and GenericDetailClient.tsx
> - The AI chat panel component
> - How page context is captured and passed to AI
> - Impact of ERPListClient/ERPFormClient on AI action registration
> Write report to `survey/ai-assistant-impact-audit.md`

---

## Summary: Lines Changed

| Agent | Files Modified | Files Created | Lines Added |
|-------|---------------|--------------|-------------|
| Agent 1 | 1 (doctype-meta.ts) | 0 | +185 |
| Agent 2 | 3 (ERPFormClient, ERPTabLayout, ERPFieldRenderer) | 0 | +253 |
| Agent 3 | 2 (page.tsx, actions.ts) | 4 (ERPListClient, ERPFilterBar, list-cell, use-list-filters) | ~1,600 |
| Agent 4 | 1 (route.ts) | 2 (list-view-overrides, utils.ts) | ~50 |
| **Total** | **7 modified** | **6 created** | **~2,088** |

## Build Verification: NOT YET DONE

Need to run `tsc --noEmit` and `bun run build` after next round fills gaps.
