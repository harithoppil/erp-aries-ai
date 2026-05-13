// DocType metadata loader.
//
// Pulls per-field display metadata from the Frappe-derived `tabDocField` table
// (one row per fieldname per parent doctype), then computes the derived
// projections every metadata-driven frontend needs:
//   - list_view_fields   — columns for the list/table page
//   - standard_filters   — filter bar configuration
//   - child_tables       — declared Table-fieldtype children
//   - layout_tree        — Tab Break -> Section Break -> Column Break -> Field
//                          hierarchy parsed in `idx` order
//
// Implements the full Frappe Meta.process() 5-table merge pipeline:
//   1. Load DocField rows
//   2. Merge CustomField rows (append, mark is_custom_field)
//   3. Apply PropertySetter overrides (field props + doctype props)
//   4. Re-sort fields by insert_after / field_order
//   5. Load DocType row for doctype-level metadata
//   6. Load DocPerm rows for role-based permissions
//
// Cached in-process with a 5 min TTL keyed by doctype name. The metadata
// is read-only after the Frappe migration, so we don't need invalidation.

import { prisma } from '@/lib/prisma';
import { LIST_VIEW_OVERRIDES } from './list-view-overrides';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FrappeFieldType =
  | 'Data' | 'Int' | 'Float' | 'Currency' | 'Percent' | 'Check'
  | 'Date' | 'Datetime' | 'Time'
  | 'Link' | 'Dynamic Link' | 'Select' | 'Autocomplete'
  | 'Small Text' | 'Text' | 'Long Text' | 'Code' | 'Markdown Editor' | 'Text Editor' | 'HTML' | 'HTML Editor'
  | 'Section Break' | 'Column Break' | 'Tab Break' | 'Fold'
  | 'Table' | 'Table MultiSelect'
  | 'Button' | 'Image' | 'Attach' | 'Attach Image' | 'Signature'
  | 'Read Only' | 'Password' | 'Color' | 'Geolocation' | 'Rating' | 'Heading'
  | 'JSON' | 'Duration' | 'Phone' | 'Barcode' | 'Icon' | 'Date Range'
  | string; // accept any string — list is informational

export interface DocFieldMeta {
  fieldname: string;
  label: string | null;
  fieldtype: FrappeFieldType;
  options: string | null;
  idx: number;
  in_list_view: boolean;
  in_standard_filter: boolean;
  hidden: boolean;
  read_only: boolean;
  reqd: boolean;
  permlevel: number;
  depends_on: string | null;
  description: string | null;
  default: string | null;
  precision: string | null;
  collapsible: boolean;
  translatable: boolean;
  placeholder: string | null;
  // Extended fields (from DocField + CustomField models)
  fetch_from: string | null;
  fetch_if_empty: boolean;
  is_virtual: boolean;
  link_filters: string | null;
  bold: boolean;
  columns: number;
  width: string | null;
  no_copy: boolean;
  set_only_once: boolean;
  allow_on_submit: boolean;
  mandatory_depends_on: string | null;
  read_only_depends_on: string | null;
  collapsible_depends_on: string | null;
  in_preview: boolean;
  hide_border: boolean;
  non_negative: boolean;
  ignore_user_permissions: boolean;
  print_hide: boolean;
  report_hide: boolean;
  show_dashboard: boolean;
  in_global_search: boolean;
  is_custom_field: boolean;
}

export interface StandardFilter {
  fieldname: string;
  label: string;
  fieldtype: FrappeFieldType;
  options: string | null;
}

export interface ChildTable {
  fieldname: string;
  child_doctype: string;
  label: string | null;
  reqd: boolean;
}

export type LayoutNode =
  | { type: 'tab';     fieldname: string; label: string;        children: LayoutNode[] }
  | { type: 'section'; fieldname: string; label: string | null; collapsible: boolean; children: LayoutNode[] }
  | { type: 'column';  fieldname: string;                       children: LayoutNode[] }
  | { type: 'field';   field: DocFieldMeta };

export interface DocTypeInfo {
  title_field: string | null;
  sort_field: string;
  sort_order: string;
  is_submittable: boolean;
  is_tree: boolean;
  issingle: boolean;
  istable: boolean;
  search_fields: string[];
  default_view: string | null;
  is_calendar_and_gantt: boolean;
  icon: string | null;
  image_field: string | null;
  document_type: string | null;
  quick_entry: boolean;
  editable_grid: boolean;
  show_title_field_in_link: boolean;
  naming_rule: string | null;
  module: string | null;
}

export interface DocPermInfo {
  role: string;
  permlevel: number;
  read: boolean;
  write: boolean;
  create: boolean;
  submit: boolean;
  cancel: boolean;
  delete: boolean;
  amend: boolean;
  select: boolean;
  if_owner: boolean;
  match: string | null;
}

export interface DocTypeMeta {
  doctype: string;
  fields: DocFieldMeta[];
  list_view_fields: string[];
  standard_filters: StandardFilter[];
  child_tables: ChildTable[];
  layout_tree: LayoutNode[];
  doctype_info: DocTypeInfo | null;
  permissions: DocPermInfo[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fieldtypes that don't carry a value — never shown in list or filter bar. */
const NO_VALUE_TYPES: ReadonlySet<string> = new Set([
  'Section Break', 'Column Break', 'Tab Break', 'Fold',
  'HTML', 'HTML Editor', 'Heading',
  'Button', 'Image',
  'Table', 'Table MultiSelect',
]);

/** Always include these columns in the list view even if not marked `in_list_view`. */
const FORCE_INCLUDE_LIST_FIELDS: ReadonlySet<string> = new Set(['status']);

/** Per-doctype overrides imported from list-view-overrides.ts (reconciled — no inline copy). */

/** DocField property names that hold boolean values. */
const DOCFIELD_BOOL_KEYS: ReadonlySet<string> = new Set([
  'hidden', 'reqd', 'read_only', 'in_list_view', 'in_standard_filter',
  'fetch_if_empty', 'is_virtual', 'bold', 'no_copy', 'set_only_once',
  'allow_on_submit', 'in_preview', 'hide_border', 'non_negative',
  'ignore_user_permissions', 'print_hide', 'report_hide', 'show_dashboard',
  'in_global_search', 'collapsible', 'translatable',
]);

/** DocField property names that hold string | null values. */
const DOCFIELD_STRING_KEYS: ReadonlySet<string> = new Set([
  'label', 'options', 'default', 'depends_on', 'description',
  'fetch_from', 'mandatory_depends_on', 'read_only_depends_on',
  'collapsible_depends_on', 'placeholder', 'width', 'precision',
  'link_filters',
]);

/** DocField property names that hold number values. */
const DOCFIELD_NUMBER_KEYS: ReadonlySet<string> = new Set([
  'permlevel', 'columns', 'idx',
]);

/** Subset of DocFieldMeta boolean keys for type-safe property setter application. */
type DocFieldBoolKey = 'hidden' | 'reqd' | 'read_only' | 'in_list_view' | 'in_standard_filter' |
  'fetch_if_empty' | 'is_virtual' | 'bold' | 'no_copy' | 'set_only_once' | 'allow_on_submit' |
  'in_preview' | 'hide_border' | 'non_negative' | 'ignore_user_permissions' | 'print_hide' |
  'report_hide' | 'show_dashboard' | 'in_global_search' | 'collapsible' | 'translatable';

/** Subset of DocFieldMeta string keys for type-safe property setter application. */
type DocFieldStringKey = 'label' | 'options' | 'default' | 'depends_on' | 'description' |
  'fetch_from' | 'mandatory_depends_on' | 'read_only_depends_on' | 'collapsible_depends_on' |
  'placeholder' | 'width' | 'precision' | 'link_filters';

/** Subset of DocFieldMeta number keys for type-safe property setter application. */
type DocFieldNumberKey = 'permlevel' | 'columns' | 'idx';

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry { meta: DocTypeMeta; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return false;
}

/** Convert a Prisma JsonValue to a JSON string, or return null. */
function jsonToString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

/** Cast a PropertySetter value based on its property_type. */
function castSetterValue(value: string, propertyType: string | null): boolean | number | string {
  switch (propertyType) {
    case 'Check':
      return value === '1';
    case 'Int':
      return parseInt(value, 10) || 0;
    case 'Data':
    default:
      return value;
  }
}

// ── Row conversion ────────────────────────────────────────────────────────────

/** Shape shared by both doc_field and custom_field Prisma rows. */
interface FieldRowInput {
  fieldname: string | null;
  label: string | null;
  fieldtype: string | null;
  options: string | null;
  idx: bigint;
  in_list_view: number;
  in_standard_filter: number;
  hidden: number;
  read_only: number;
  reqd: number;
  permlevel: number | null;
  depends_on: string | null;
  description: string | null;
  default: string | null;
  precision: string | null;
  collapsible: number;
  translatable: number;
  placeholder: string | null;
  fetch_from: string | null;
  fetch_if_empty: number;
  is_virtual: number;
  link_filters: unknown;
  bold: number;
  columns: number;
  width: string | null;
  no_copy: number;
  set_only_once: number;
  allow_on_submit: number;
  mandatory_depends_on: string | null;
  read_only_depends_on: string | null;
  collapsible_depends_on: string | null;
  in_preview: number;
  hide_border: number;
  non_negative: number;
  ignore_user_permissions: number;
  print_hide: number;
  report_hide: number;
  show_dashboard: number;
  in_global_search: number;
}

/** Convert a doc_field or custom_field Prisma row to DocFieldMeta. */
function rowToMeta(row: FieldRowInput, isCustom: boolean): DocFieldMeta {
  return {
    fieldname: row.fieldname ?? '',
    label: row.label,
    fieldtype: (row.fieldtype ?? 'Data') as FrappeFieldType,
    options: row.options,
    idx: Number(row.idx),
    in_list_view: asBool(row.in_list_view),
    in_standard_filter: asBool(row.in_standard_filter),
    hidden: asBool(row.hidden),
    read_only: asBool(row.read_only),
    reqd: asBool(row.reqd),
    permlevel: row.permlevel ?? 0,
    depends_on: row.depends_on,
    description: row.description,
    default: row.default,
    precision: row.precision,
    collapsible: asBool(row.collapsible),
    translatable: asBool(row.translatable),
    placeholder: row.placeholder,
    fetch_from: row.fetch_from ?? null,
    fetch_if_empty: asBool(row.fetch_if_empty),
    is_virtual: asBool(row.is_virtual),
    link_filters: jsonToString(row.link_filters),
    bold: asBool(row.bold),
    columns: row.columns ?? 0,
    width: row.width ?? null,
    no_copy: asBool(row.no_copy),
    set_only_once: asBool(row.set_only_once),
    allow_on_submit: asBool(row.allow_on_submit),
    mandatory_depends_on: row.mandatory_depends_on ?? null,
    read_only_depends_on: row.read_only_depends_on ?? null,
    collapsible_depends_on: row.collapsible_depends_on ?? null,
    in_preview: asBool(row.in_preview),
    hide_border: asBool(row.hide_border),
    non_negative: asBool(row.non_negative),
    ignore_user_permissions: asBool(row.ignore_user_permissions),
    print_hide: asBool(row.print_hide),
    report_hide: asBool(row.report_hide),
    show_dashboard: asBool(row.show_dashboard),
    in_global_search: asBool(row.in_global_search),
    is_custom_field: isCustom,
  };
}

// ── Pipeline Step 2: Merge Custom Fields ──────────────────────────────────────

interface CustomFieldRow extends FieldRowInput {
  insert_after: string | null;
}

function mergeCustomFields(
  fields: DocFieldMeta[],
  customRows: CustomFieldRow[],
): { fields: DocFieldMeta[]; insertAfterMap: Map<string, string> } {
  const insertAfterMap = new Map<string, string>();
  const customMetas: DocFieldMeta[] = [];

  for (const row of customRows) {
    const meta = rowToMeta(row, true);
    customMetas.push(meta);
    if (row.insert_after) {
      insertAfterMap.set(meta.fieldname, row.insert_after);
    }
  }

  return { fields: [...fields, ...customMetas], insertAfterMap };
}

// ── Pipeline Step 3: Apply Property Setters ───────────────────────────────────

interface PropertySetterRow {
  doctype_or_field: string | null;
  doc_type: string | null;
  field_name: string | null;
  property: string | null;
  value: string | null;
  property_type: string | null;
}

interface DocTypeOverrides {
  doctypeInfo: Partial<DocTypeInfo>;
  fieldOrder: string[] | null;
}

function applyPropertySetters(
  fields: DocFieldMeta[],
  setters: PropertySetterRow[],
): DocTypeOverrides {
  const doctypeInfo: Partial<DocTypeInfo> = {};
  let fieldOrder: string[] | null = null;

  // Build field lookup by fieldname for O(1) access
  const fieldMap = new Map<string, DocFieldMeta>();
  for (const f of fields) {
    fieldMap.set(f.fieldname, f);
  }

  for (const setter of setters) {
    if (!setter.property || setter.value === null || setter.value === undefined) continue;

    const casted = castSetterValue(setter.value, setter.property_type);

    if (setter.doctype_or_field === 'DocField') {
      // Override a field property
      const field = fieldMap.get(setter.field_name ?? '');
      if (!field) continue;
      const prop = setter.property;
      if (DOCFIELD_BOOL_KEYS.has(prop) && typeof casted === 'boolean') {
        field[prop as DocFieldBoolKey] = casted;
      } else if (DOCFIELD_STRING_KEYS.has(prop) && typeof casted === 'string') {
        field[prop as DocFieldStringKey] = casted;
      } else if (DOCFIELD_NUMBER_KEYS.has(prop) && typeof casted === 'number') {
        field[prop as DocFieldNumberKey] = casted;
      }
    } else if (setter.doctype_or_field === 'DocType') {
      // Override a doctype property
      if (setter.property === 'field_order') {
        // Special: JSON array of fieldnames defining exact order
        try {
          const parsed: unknown = JSON.parse(setter.value);
          if (Array.isArray(parsed)) {
            fieldOrder = parsed as string[];
          }
        } catch {
          // not valid JSON — skip
        }
      } else {
        applyDocTypeOverride(doctypeInfo, setter.property, casted);
      }
    }
  }

  return { doctypeInfo, fieldOrder };
}

/** Apply a single DocType-level property setter override. */
function applyDocTypeOverride(
  info: Partial<DocTypeInfo>,
  prop: string,
  value: boolean | number | string,
): void {
  switch (prop) {
    case 'title_field':
      if (typeof value === 'string') info.title_field = value || null;
      break;
    case 'sort_field':
      if (typeof value === 'string') info.sort_field = value;
      break;
    case 'sort_order':
      if (typeof value === 'string') info.sort_order = value;
      break;
    case 'is_submittable':
      if (typeof value === 'boolean') info.is_submittable = value;
      break;
    case 'is_tree':
      if (typeof value === 'boolean') info.is_tree = value;
      break;
    case 'issingle':
      if (typeof value === 'boolean') info.issingle = value;
      break;
    case 'istable':
      if (typeof value === 'boolean') info.istable = value;
      break;
    case 'search_fields':
      if (typeof value === 'string') {
        info.search_fields = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      break;
    case 'default_view':
      if (typeof value === 'string') info.default_view = value || null;
      break;
    case 'is_calendar_and_gantt':
      if (typeof value === 'number' || typeof value === 'boolean') info.is_calendar_and_gantt = Boolean(value);
      break;
    case 'icon':
      if (typeof value === 'string') info.icon = value || null;
      break;
    case 'image_field':
      if (typeof value === 'string') info.image_field = value || null;
      break;
    case 'document_type':
      if (typeof value === 'string') info.document_type = value || null;
      break;
    case 'quick_entry':
      if (typeof value === 'boolean') info.quick_entry = value;
      break;
    case 'editable_grid':
      if (typeof value === 'boolean') info.editable_grid = value;
      break;
    case 'show_title_field_in_link':
      if (typeof value === 'boolean') info.show_title_field_in_link = value;
      break;
    case 'naming_rule':
      if (typeof value === 'string') info.naming_rule = value || null;
      break;
    case 'module':
      if (typeof value === 'string') info.module = value || null;
      break;
  }
}

// ── Pipeline Step 4: Sort Fields ──────────────────────────────────────────────

function sortFieldsByLayout(
  fields: DocFieldMeta[],
  fieldOrder: string[] | null,
  insertAfterMap: Map<string, string>,
): DocFieldMeta[] {
  // Case 1: field_order Property Setter gives exact ordering
  if (fieldOrder && fieldOrder.length > 0) {
    const fieldMap = new Map<string, DocFieldMeta>();
    for (const f of fields) fieldMap.set(f.fieldname, f);

    const sorted: DocFieldMeta[] = [];
    const placed = new Set<string>();

    for (const fieldname of fieldOrder) {
      const field = fieldMap.get(fieldname);
      if (field && !placed.has(fieldname)) {
        sorted.push(field);
        placed.add(fieldname);
      }
    }

    // Append any fields not in field_order, preserving their relative order
    for (const f of fields) {
      if (!placed.has(f.fieldname)) {
        sorted.push(f);
      }
    }

    return sorted;
  }

  // Case 2: No field_order — place custom fields after insert_after target,
  // keep standard fields in idx order.
  const standard = fields.filter((f) => !f.is_custom_field);
  const custom = fields.filter((f) => f.is_custom_field);

  if (custom.length === 0) return standard;

  // Group custom fields by their insert_after target for correct ordering
  const byInsertAfter = new Map<string, DocFieldMeta[]>();
  const noInsertAfter: DocFieldMeta[] = [];

  for (const cf of custom) {
    const target = insertAfterMap.get(cf.fieldname);
    if (target) {
      const group = byInsertAfter.get(target) ?? [];
      group.push(cf);
      byInsertAfter.set(target, group);
    } else {
      noInsertAfter.push(cf);
    }
  }

  // Walk result in reverse so splice indices stay valid
  const result: DocFieldMeta[] = [...standard];
  for (let i = result.length - 1; i >= 0; i--) {
    const group = byInsertAfter.get(result[i].fieldname);
    if (group) {
      result.splice(i + 1, 0, ...group);
      byInsertAfter.delete(result[i].fieldname);
    }
  }

  // Handle chained custom fields (insert_after targets another custom field)
  // with up to 3 passes
  for (let pass = 0; pass < 3; pass++) {
    let inserted = false;
    for (let i = result.length - 1; i >= 0; i--) {
      const group = byInsertAfter.get(result[i].fieldname);
      if (group) {
        result.splice(i + 1, 0, ...group);
        byInsertAfter.delete(result[i].fieldname);
        inserted = true;
      }
    }
    if (!inserted) break;
  }

  // Append any remaining custom fields (target not found or no insert_after)
  for (const group of byInsertAfter.values()) {
    result.push(...group);
  }
  result.push(...noInsertAfter);

  return result;
}

// ── Pipeline Step 5: Build DocTypeInfo from DocType row ───────────────────────

interface DocTypeRow {
  title_field: string | null;
  sort_field: string | null;
  sort_order: string | null;
  is_submittable: number;
  is_tree: number;
  issingle: number;
  istable: number;
  search_fields: string | null;
  default_view: string | null;
  is_calendar_and_gantt: number;
  icon: string | null;
  image_field: string | null;
  document_type: string | null;
  quick_entry: number;
  editable_grid: number;
  show_title_field_in_link: number;
  naming_rule: string | null;
  module: string | null;
}

function buildDocTypeInfo(row: DocTypeRow | null, overrides: Partial<DocTypeInfo>): DocTypeInfo {
  return {
    title_field: overrides.title_field ?? row?.title_field ?? null,
    sort_field: overrides.sort_field ?? row?.sort_field ?? 'creation',
    sort_order: overrides.sort_order ?? row?.sort_order ?? 'DESC',
    is_submittable: overrides.is_submittable ?? asBool(row?.is_submittable),
    is_tree: overrides.is_tree ?? asBool(row?.is_tree),
    issingle: overrides.issingle ?? asBool(row?.issingle),
    istable: overrides.istable ?? asBool(row?.istable),
    search_fields: overrides.search_fields ?? (row?.search_fields
      ? row.search_fields.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []),
    default_view: overrides.default_view ?? row?.default_view ?? null,
    is_calendar_and_gantt: overrides.is_calendar_and_gantt ?? asBool(row?.is_calendar_and_gantt),
    icon: overrides.icon ?? row?.icon ?? null,
    image_field: overrides.image_field ?? row?.image_field ?? null,
    document_type: overrides.document_type ?? row?.document_type ?? null,
    quick_entry: overrides.quick_entry ?? asBool(row?.quick_entry),
    editable_grid: overrides.editable_grid ?? asBool(row?.editable_grid),
    show_title_field_in_link: overrides.show_title_field_in_link ?? asBool(row?.show_title_field_in_link),
    naming_rule: overrides.naming_rule ?? row?.naming_rule ?? null,
    module: overrides.module ?? row?.module ?? null,
  };
}

// ── Pipeline Step 6: Build DocPermInfo from DocPerm rows ──────────────────────

interface DocPermRow {
  role: string | null;
  permlevel: number | null;
  read: number;
  write: number;
  create: number;
  submit: number;
  cancel: number;
  delete: number;
  amend: number;
  select: number;
  if_owner: number;
  match: string | null;
}

function buildDocPermInfo(rows: DocPermRow[]): DocPermInfo[] {
  return rows.map((p) => ({
    role: p.role ?? '',
    permlevel: p.permlevel ?? 0,
    read: asBool(p.read),
    write: asBool(p.write),
    create: asBool(p.create),
    submit: asBool(p.submit),
    cancel: asBool(p.cancel),
    delete: asBool(p.delete),
    amend: asBool(p.amend),
    select: asBool(p.select),
    if_owner: asBool(p.if_owner),
    match: p.match ?? null,
  }));
}

// ── Layout Parser ─────────────────────────────────────────────────────────────

/**
 * Walk fields in `idx` order, producing the Tab > Section > Column > Field
 * hierarchy used by ERPNext's form renderer.
 *
 *   Tab Break        starts a new tab
 *   Section Break    starts a new section inside the current tab (or root)
 *   Column Break     starts a new column inside the current section
 *   anything else    is a leaf field attached to the deepest open container
 */
export function parseLayout(fields: DocFieldMeta[]): LayoutNode[] {
  const root: LayoutNode[] = [];
  let currentTab: Extract<LayoutNode, { type: 'tab' }> | null = null;
  let currentSection: Extract<LayoutNode, { type: 'section' }> | null = null;
  let currentColumn: Extract<LayoutNode, { type: 'column' }> | null = null;

  const containerChildren = (): LayoutNode[] => {
    if (currentColumn) return currentColumn.children;
    if (currentSection) return currentSection.children;
    if (currentTab) return currentTab.children;
    return root;
  };

  for (const f of fields) {
    if (f.hidden) continue;
    switch (f.fieldtype) {
      case 'Tab Break': {
        const tab: Extract<LayoutNode, { type: 'tab' }> = {
          type: 'tab',
          fieldname: f.fieldname,
          label: f.label ?? f.fieldname,
          children: [],
        };
        root.push(tab);
        currentTab = tab;
        currentSection = null;
        currentColumn = null;
        break;
      }
      case 'Section Break': {
        const section: Extract<LayoutNode, { type: 'section' }> = {
          type: 'section',
          fieldname: f.fieldname,
          label: f.label || null,
          collapsible: f.collapsible,
          children: [],
        };
        (currentTab ? currentTab.children : root).push(section);
        currentSection = section;
        currentColumn = null;
        break;
      }
      case 'Column Break': {
        const column: Extract<LayoutNode, { type: 'column' }> = {
          type: 'column',
          fieldname: f.fieldname,
          children: [],
        };
        if (!currentSection) {
          // Implicit section if a Column Break appears without a preceding
          // Section Break — matches Frappe's lenient rendering.
          const section: Extract<LayoutNode, { type: 'section' }> = {
            type: 'section',
            fieldname: `__implicit_section_${f.idx}`,
            label: null,
            collapsible: false,
            children: [],
          };
          (currentTab ? currentTab.children : root).push(section);
          currentSection = section;
        }
        currentSection.children.push(column);
        currentColumn = column;
        break;
      }
      default: {
        // Need at least a column to hold this field. Create an implicit
        // section + column if neither has been opened yet.
        if (!currentColumn) {
          if (!currentSection) {
            const section: Extract<LayoutNode, { type: 'section' }> = {
              type: 'section',
              fieldname: `__implicit_section_${f.idx}`,
              label: null,
              collapsible: false,
              children: [],
            };
            (currentTab ? currentTab.children : root).push(section);
            currentSection = section;
          }
          const column: Extract<LayoutNode, { type: 'column' }> = {
            type: 'column',
            fieldname: `__implicit_column_${f.idx}`,
            children: [],
          };
          currentSection.children.push(column);
          currentColumn = column;
        }
        currentColumn.children.push({ type: 'field', field: f });
        break;
      }
    }
  }
  return root;
}

// ── Main Loader ───────────────────────────────────────────────────────────────

export async function loadDocTypeMeta(doctype: string): Promise<DocTypeMeta> {
  const cached = CACHE.get(doctype);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.meta;

  // Step 1: Load DocField rows
  const rows = await prisma.doc_field.findMany({
    where: { parent: doctype },
    orderBy: { idx: 'asc' },
  });

  let fields = rows.map((row) => rowToMeta(row, false));

  // Step 2: Merge Custom Fields
  const customRows = await prisma.custom_field.findMany({
    where: { dt: doctype },
  });
  const mergeResult = mergeCustomFields(fields, customRows as CustomFieldRow[]);
  fields = mergeResult.fields;

  // Step 3: Apply Property Setters
  const setters = await prisma.property_setter.findMany({
    where: { doc_type: doctype },
  });
  const { doctypeInfo: overrides, fieldOrder } = applyPropertySetters(
    fields,
    setters as PropertySetterRow[],
  );

  // Step 4: Sort fields by insert_after / field_order
  fields = sortFieldsByLayout(fields, fieldOrder, mergeResult.insertAfterMap);

  // Step 5: Load DocType row — provides base values; PropertySetter overrides
  // take precedence (already applied in step 3).
  const docTypeRow = await prisma.doc_type.findUnique({
    where: { name: doctype },
    select: {
      title_field: true,
      sort_field: true,
      sort_order: true,
      search_fields: true,
      default_view: true,
      is_calendar_and_gantt: true,
      icon: true,
      image_field: true,
      module: true,
      is_submittable: true,
      is_tree: true,
      issingle: true,
      istable: true,
      document_type: true,
      quick_entry: true,
      editable_grid: true,
      show_title_field_in_link: true,
      naming_rule: true,
    },
  });

  const doctype_info: DocTypeInfo | null = docTypeRow
    ? buildDocTypeInfo(docTypeRow as DocTypeRow, overrides)
    : (Object.keys(overrides).length > 0 ? buildDocTypeInfo(null, overrides) : null);

  // Step 6: Load DocPerm rows
  const permRows = await prisma.doc_perm.findMany({
    where: { parent: doctype },
  });
  const permissions = buildDocPermInfo(permRows as DocPermRow[]);

  // Step 7: Compute derived projections
  let list_view_fields = fields
    .filter((f) =>
      !f.hidden &&
      !NO_VALUE_TYPES.has(f.fieldtype) &&
      (f.in_list_view || FORCE_INCLUDE_LIST_FIELDS.has(f.fieldname)),
    )
    .map((f) => f.fieldname);

  const standard_filters: StandardFilter[] = fields
    .filter((f) =>
      !f.hidden &&
      !NO_VALUE_TYPES.has(f.fieldtype) &&
      f.in_standard_filter,
    )
    .map((f) => ({
      fieldname: f.fieldname,
      label: f.label ?? f.fieldname,
      fieldtype: f.fieldtype,
      options: f.options,
    }));

  const child_tables: ChildTable[] = fields
    .filter((f) => f.fieldtype === 'Table' && f.options)
    .map((f) => ({
      fieldname: f.fieldname,
      child_doctype: f.options!,
      label: f.label,
      reqd: f.reqd,
    }));

  const layout_tree = parseLayout(fields);

  // Apply LIST_VIEW_OVERRIDES
  const override = LIST_VIEW_OVERRIDES[doctype];
  if (override?.append) {
    for (const f of override.append) {
      if (!list_view_fields.includes(f)) list_view_fields.push(f);
    }
  }
  if (override?.hide) {
    const hideSet = new Set(override.hide);
    list_view_fields = list_view_fields.filter((f) => !hideSet.has(f));
  }

  // Step 8: Assemble and cache
  const meta: DocTypeMeta = {
    doctype,
    fields,
    list_view_fields,
    standard_filters,
    child_tables,
    layout_tree,
    doctype_info,
    permissions,
  };
  CACHE.set(doctype, { meta, expires: now + TTL_MS });
  return meta;
}

export function clearDocTypeMetaCache(doctype?: string) {
  if (doctype) CACHE.delete(doctype);
  else CACHE.clear();
}
