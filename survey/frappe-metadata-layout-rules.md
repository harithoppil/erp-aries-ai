# Frappe Metadata Layout Rules — What Our Next.js Frontend Is Missing

> **Audit date**: 2026-05-11
> **Sources**: Frappe `meta.py`, local DB JSON dumps (`sql/`), Next.js project code, Frappe framework source
> **Purpose**: Identify every layout/rendering rule from Frappe's 4 metadata tables that our ERPFormClient/ERPListClient must implement

---

## Executive Summary

Our metadata-driven frontend only uses **tabDocField** (Step 1 of Frappe's merge pipeline). We completely skip Steps 2-4:

**Frappe's merge order:**
1. `tabDocField` — standard field definitions (WE DO THIS)
2. `tabCustom Field` — merge custom fields at `insert_after` position (MISSING)
3. `tabProperty Setter` — override field/doctype properties (MISSING)
4. `tabDocPerm` — filter by role/permlevel (MISSING)

Plus: **tabDocType** is not even in our Prisma schema. This means we have zero doctype-level metadata (title_field, sort_field, is_submittable, icon, etc.).

---

## 1. tabDocType — Doctype-Level Metadata (NOT IN PRISMA SCHEMA)

~300 rows. Controls how a doctype behaves at the top level. **We query NONE of this.**

### Layout-Critical Columns

| Column | Effect on UI | Our Current Behavior |
|--------|-------------|---------------------|
| `title_field` | Which field is the display title in lists, links, breadcrumbs | Always show `name` (the ID) |
| `image_field` | Which Attach Image field shows thumbnail in list/form | No thumbnails |
| `sort_field` | Default sort column for list views | Defaults to `creation`/`desc` |
| `sort_order` | Default sort direction (ASC/DESC) | Hardcoded `desc` |
| `is_submittable` | Whether doctype supports Draft→Submitted→Cancelled workflow | Show Submit based only on `docstatus==0` |
| `is_tree` | Whether it's a tree structure (Account, Item Group, etc.) | No tree view option |
| `issingle` | Single-doctype (only one record). Hides "New" button | Shows "New" for everything |
| `istable` | Child table doctype — never shown standalone | Can be navigated to standalone |
| `search_fields` | Comma-separated fieldnames used for search | Search only by `name` |
| `default_view` | Which view opens first: List/Tree/Report/Calendar/Gantt/Kanban | Always opens List |
| `icon` | Icon class shown in sidebar, breadcrumbs | No icons |
| `document_type` | "Document"/"Setup"/"System"/"Other" — affects sidebar grouping | Not used |
| `quick_entry` | If 1, open simplified dialog for new records (only reqd + standard_filter fields) | Always full form |
| `editable_grid` | If 1, child table rows are editable inline | Child tables show JSON preview |
| `show_title_field_in_link` | Show title_field value instead of `name` in Link fields | Link fields always show `name` |
| `naming_rule` / `autoname` | How document names are generated | Not used — may show naming_series field incorrectly |
| `hide_toolbar` | Hide the standard toolbar | Toolbar always shown |
| `allow_copy` | Show "Copy" button | Not shown |
| `allow_rename` | Show "Rename" button | Not shown |
| `default_print_format` | Name of default print format | Not used |

### What This Breaks

- **Customer list** shows "CUST-001" instead of "John Smith" (`title_field = "customer_name"`)
- **Item list** has no image thumbnails (`image_field = "image"`)
- **Account list** should open Tree view by default (`default_view = "Tree"`, `is_tree = 1`)
- **Accounts Settings** should show single-record form, not a list (`issingle = 1`)
- **Search** across Customer finds nothing by customer_name (`search_fields = "customer_name"`)
- **Submit button** appears on non-submittable doctypes

---

## 2. tabCustom Field — User-Added Custom Fields (NOT IN AZURE)

99 rows. These are fields that don't exist in stock Frappe but were added by users or apps.

### Layout-Critical Columns

| Column | Effect |
|--------|--------|
| `dt` | Parent doctype this custom field belongs to |
| `fieldname` | Field name |
| `label`, `fieldtype`, `options` | Same as DocField |
| `insert_after` | **Which field this custom field should appear after** — controls ordering |
| `insert_before` | Alternative positioning |
| `is_system_generated` | Created by migration vs. manual |

### How Frappe Merges Them

From `frappe/model/meta.py` line 404-420 (`add_custom_fields()`):
1. Fetch all `Custom Field` rows where `dt = doctype_name`
2. Tag each with `is_custom_field = 1`
3. **Append** them to the standard fields list
4. Then **re-sort** based on `insert_after` (see Property Setter section below)

### What This Breaks

- Address has a custom `emirate` field — completely invisible
- POS Invoice/Item have multiple custom fields — invisible
- 99 fields across 15+ doctypes are simply not rendered

---

## 3. tabProperty Setter — Field/Doctype Property Overrides (NOT IN AZURE)

95 rows. These override properties on existing fields or on the doctype itself — "hide this field", "make that field required", "change this label".

### Layout-Critical Columns

| Column | Effect |
|--------|--------|
| `doctype_or_field` | "DocType" (override doctype property) or "DocField" (override field property) |
| `doc_type` | Which doctype |
| `field_name` | Which field (DocField mode) or null (DocType mode) |
| `property` | Name of property being overridden |
| `value` | The override value |
| `property_type` | Type for casting: "Check", "Data", "Int", etc. |

### Actual Overrides Found in Our Data

| Property | Count | Example |
|----------|-------|---------|
| `hidden` | 58 | Fields that Frappe hides but we still show |
| `print_hide` | 21 | Print-only overrides (lower priority) |
| `default` | 9 | Default value overrides for fields |
| `reqd` | 4 | Fields made mandatory or optional via customization |
| `mandatory_depends_on` | 2 | Dynamic mandatory rules |
| `read_only` | 1 | Fields made read-only via customization |
| `field_order` | — | JSON array of fieldnames defining exact field ordering for a doctype |

### How Frappe Applies Them

From `frappe/model/meta.py` line 422-462 (`apply_property_setters()`):
1. Fetch all `Property Setter` rows where `doc_type = doctype_name`
2. If `doctype_or_field == "DocType"`: apply property directly to Meta object (e.g. override `title_field`, set `field_order`)
3. If `doctype_or_field == "DocField"`: find matching field by `field_name`, override its property with casted value
4. Also handles `DocType Link`, `DocType Action`, `DocType State` rows

### What This Breaks

- 58 fields that should be **hidden** are still visible
- 9 fields have wrong **default values**
- 4 fields have wrong **required** state
- Custom field ordering via `field_order` is ignored
- Custom field positioning via `insert_after` is never applied

---

## 4. tabDocPerm — Role-Based Permissions (NOT IN AZURE)

~1,093 rows. Controls who can see/edit/submit/delete what.

### Layout-Critical Columns

| Column | Effect |
|--------|--------|
| `parent` | Which doctype |
| `role` | Which role |
| `permlevel` | Permission level (0=default, 1, 2...) |
| `read` / `write` / `create` / `submit` / `cancel` / `delete` / `amend` | Boolean CRUD + workflow permissions |
| `select` | Can the role even see this doctype in lists? |
| `if_owner` | Permission only applies when current user is document owner |
| `match` | Permission only applies when document matches a condition |
| `report` / `export` / `import` / `share` / `print` / `email` | Secondary action permissions |

### How Frappe Uses Permissions

**A. Doctype-level** — Can the user see/create/edit/submit this doctype at all?

**B. Field-level via `permlevel`** — Each DocField has a `permlevel`. A user can only see/edit a field if their roles grant access to that permlevel:
- 1,045 perms at permlevel=0 (default — everyone)
- 43 perms at permlevel=1 (e.g., System Manager gets special fields on User)
- 5 perms at permlevel=2

From `frappe/model/meta.py` line 677-719 (`get_permitted_fieldnames()`):
1. Get user's roles
2. For each role, collect which permlevels they have `read`/`write` access to
3. A field is visible only if `df.permlevel` is in the user's permitted permlevels
4. If no permissions defined at all → all fields accessible (open mode)

### What This Breaks

- Our `rbac.ts` uses **hardcoded** role-to-action mapping — ignores actual DocPerm data entirely
- Fields with `permlevel > 0` are always visible (e.g., User doctype permlevel=1 fields)
- `if_owner` checks not implemented — users can edit others' documents
- `match` conditions not implemented — company-scoped permissions ignored

---

## 5. The Complete Merge Pipeline

This is what Frappe's `Meta.process()` does (simplified):

```
┌─────────────────────────────────────────────────────┐
│ 1. Load DocField rows for the doctype               │
│    → prisma.docField.findMany({ where: { parent }}) │
│    ✅ WE DO THIS                                    │
├─────────────────────────────────────────────────────┤
│ 2. Append Custom Fields                             │
│    → prisma.customField.findMany({ where: { dt }})  │
│    → Mark as is_custom_field, append to fields list │
│    ❌ MISSING                                       │
├─────────────────────────────────────────────────────┤
│ 3. Apply Property Setter overrides                  │
│    → prisma.propertySetter.findMany({ where: ... }) │
│    → Override field.hidden, field.reqd, field.label │
│    → Override doctype.title_field, doctype.icon     │
│    → Apply field_order re-sorting                   │
│    ❌ MISSING                                       │
├─────────────────────────────────────────────────────┤
│ 4. Re-sort fields by insert_after + field_order     │
│    → Custom fields placed after insert_after target │
│    → field_order Property Setter gives exact order  │
│    ❌ MISSING                                       │
├─────────────────────────────────────────────────────┤
│ 5. Apply DocPerm / Custom DocPerm                   │
│    → Filter fields by user's permlevel access       │
│    → Determine CRUD + workflow permissions          │
│    ❌ MISSING                                       │
├─────────────────────────────────────────────────────┤
│ 6. Load DocType row for doctype-level metadata      │
│    → title_field, sort_field, is_submittable, etc.  │
│    ❌ MISSING (NO PRISMA MODEL)                     │
└─────────────────────────────────────────────────────┘
```

---

## 6. Missing DocField Columns (Not Yet in Our Prisma Model)

These columns exist in `tabDocField` but our Prisma `DocField` model doesn't map them:

| Column | Effect | Priority |
|--------|--------|----------|
| `fetch_from` | Auto-fetch value from linked doctype (e.g. `customer.customer_name`) | P1 |
| `fetch_if_empty` | Only fetch from link if field is currently empty | P1 |
| `is_virtual` | Not stored in DB; computed at runtime — must exclude from save | P1 |
| `link_filters` | JSON filters to restrict Link field options | P1 |
| `bold` | Bold the field label for visual emphasis | P3 |
| `columns` | Width/column span in section layout | P2 |
| `width` | Explicit width for column break fields | P3 |
| `no_copy` | Exclude from document duplication | P3 |
| `set_only_once` | Field value only settable on creation, not edit | P2 |
| `allow_on_submit` | Allow editing even when docstatus=1 | P2 |
| `mandatory_depends_on` | Expression; when true, field becomes mandatory | P2 |
| `read_only_depends_on` | Expression; when true, field becomes read-only | P2 |
| `collapsible_depends_on` | Expression controlling collapsible section expand/collapse | P2 |
| `in_preview` | Show in link preview popup | P3 |
| `hide_border` | Hide section break border | P3 |
| `non_negative` | Disallow negative values for numeric fields | P2 |
| `ignore_user_permissions` | Link field ignores user permission restrictions | P2 |
| `in_global_search` | Include in global search index | P3 |

---

## 7. Implementation Priority

### P0 — Must Do Before Stage 1 (ERPListClient)

1. **Add DocType model to Prisma** with layout-relevant columns. Map to `doc_type` table in Azure.
2. **Load `doc_type` data into Azure** (~300 rows from local dump).
3. **Update `loadDocTypeMeta()`** to also fetch DocType row and expose: `title_field`, `sort_field`, `sort_order`, `is_submittable`, `is_tree`, `search_fields`, `icon`, `default_view`, `issingle`, `istable`, `image_field`, `quick_entry`, `editable_grid`, `show_title_field_in_link`.

### P1 — Must Do During Stage 1 (ERPListClient + ERPFilterBar)

4. **Use `title_field`** in list rows, form header, breadcrumbs, Link field display.
5. **Use `sort_field`/`sort_order`** as default list view sort.
6. **Use `search_fields`** for multi-field search in list view.
7. **Add Custom Field merge** to `loadDocTypeMeta()`.
8. **Add Property Setter application** to `loadDocTypeMeta()`.
9. **Load `custom_field`, `property_setter`, `doc_perm` data into Azure**.

### P2 — Should Do During Stage 2 (ERPGridClient) or Soon After

10. **Use `is_submittable`** to gate Submit/Cancel buttons.
11. **Handle `issingle` doctypes** (hide "New", no list view).
12. **Handle `is_tree` doctypes** (offer Tree view option).
13. **Enforce permlevel** on fields using DocPerm data.
14. **Evaluate `depends_on`** expressions for conditional visibility.
15. **Implement `fetch_from`** auto-population on Link field change.
16. **Apply `set_only_once`** and `allow_on_submit`**.
17. **Apply `non_negative`** on numeric fields.

### P3 — Nice to Have

18. **`quick_entry` mode** for new records.
19. **`editable_grid`** for child tables.
20. **`image_field`** thumbnails in list/form.
21. **`icon`** in sidebar/breadcrumbs.
22. **`link_filters`** on Link field combobox.
23. **`mandatory_depends_on` / `read_only_depends_on`** dynamic rules.

---

## 8. Key Source Files in Frappe Framework

| File | What It Does |
|------|-------------|
| `frappe/model/meta.py` line 166-179 | `Meta.process()` — the authoritative merge pipeline |
| `frappe/model/meta.py` line 404-420 | `add_custom_fields()` — Custom Field merge |
| `frappe/model/meta.py` line 422-462 | `apply_property_setters()` — Property Setter application |
| `frappe/model/meta.py` line 543-615 | `sort_fields()` — field re-ordering logic |
| `frappe/model/meta.py` line 627-640 | `set_custom_permissions()` — Custom DocPerm |
| `frappe/model/meta.py` line 677-719 | `get_permitted_fieldnames()` — permlevel enforcement |
| `frappe/model/meta.py` line 371-380 | `title_field` resolution with fallback chain |
| `frappe/custom/doctype/property_setter/property_setter.py` | Property Setter application logic |
| `frappe/custom/doctype/custom_field/custom_field.py` | Custom Field merge logic |
| `frappe/permissions.py` line 153 | `is_submittable` check before submit actions |
| `frappe/desk/listview.py` | List view uses sort_field, search_fields, default_view |
| `frappe/desk/search.py` line 169-197 | Search uses title_field, search_fields |

---

## 9. Data Counts for Azure Import

| Table | Rows | Status |
|-------|------|--------|
| `doc_field` (tabDocField) | 13,416 | ✅ LOADED |
| `doc_type` (tabDocType) | ~300 | ❌ NOT IN AZURE |
| `property_setter` (tabProperty Setter) | 95 | ❌ NOT IN AZURE |
| `custom_field` (tabCustom Field) | 99 | ❌ NOT IN AZURE |
| `doc_perm` (tabDocPerm) | ~1,093 | ❌ NOT IN AZURE |

---

## 10. The 5-Table Rule

For the metadata-driven frontend to work correctly, **5 tables** must be loaded and queried in order:

```
DocType → DocField → CustomField → PropertySetter → DocPerm
  (what)    (fields)   (additions)   (overrides)     (permissions)
```

Each step refines the output of the previous one. Skip any step and the form/list will render incorrectly.
