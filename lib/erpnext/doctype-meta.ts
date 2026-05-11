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
// Cached in-process with a 5 min TTL keyed by doctype name. The metadata
// is read-only after the Frappe migration, so we don't need invalidation.

import { prisma } from '@/lib/prisma';

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

export interface DocTypeMeta {
  doctype: string;
  fields: DocFieldMeta[];
  list_view_fields: string[];
  standard_filters: StandardFilter[];
  child_tables: ChildTable[];
  layout_tree: LayoutNode[];
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

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry { meta: DocTypeMeta; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

// ── Loader ────────────────────────────────────────────────────────────────────

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return false;
}

function rowToMeta(row: {
  fieldname: string | null;
  label: string | null;
  fieldtype: string | null;
  options: string | null;
  idx: number;
  in_list_view: number;
  in_standard_filter: number;
  hidden: number;
  read_only: number;
  reqd: number;
  permlevel: number | null;
  depends_on: string | null;
  description: string | null;
  field_default: string | null;
  field_precision: string | null;
  collapsible: number;
  translatable: number;
  placeholder: string | null;
}): DocFieldMeta {
  return {
    fieldname: row.fieldname ?? '',
    label: row.label,
    fieldtype: (row.fieldtype ?? 'Data') as FrappeFieldType,
    options: row.options,
    idx: row.idx,
    in_list_view: asBool(row.in_list_view),
    in_standard_filter: asBool(row.in_standard_filter),
    hidden: asBool(row.hidden),
    read_only: asBool(row.read_only),
    reqd: asBool(row.reqd),
    permlevel: row.permlevel ?? 0,
    depends_on: row.depends_on,
    description: row.description,
    default: row.field_default,
    precision: row.field_precision,
    collapsible: asBool(row.collapsible),
    translatable: asBool(row.translatable),
    placeholder: row.placeholder,
  };
}

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

export async function loadDocTypeMeta(doctype: string): Promise<DocTypeMeta> {
  const cached = CACHE.get(doctype);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.meta;

  const rows = await prisma.docField.findMany({
    where: { parent: doctype },
    orderBy: { idx: 'asc' },
  });

  const fields = rows.map(rowToMeta);

  const list_view_fields = fields
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

  const meta: DocTypeMeta = {
    doctype,
    fields,
    list_view_fields,
    standard_filters,
    child_tables,
    layout_tree,
  };
  CACHE.set(doctype, { meta, expires: now + TTL_MS });
  return meta;
}

export function clearDocTypeMetaCache(doctype?: string) {
  if (doctype) CACHE.delete(doctype);
  else CACHE.clear();
}
