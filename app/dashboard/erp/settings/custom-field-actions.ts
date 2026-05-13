'use server';

import { prisma } from '@/lib/prisma';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomFieldInfo {
  name: string;
  dt: string;
  label: string;
  fieldname: string;
  fieldtype: string;
  insertAfter: string | null;
  options: string | null;
  defaultValue: string | null;
  required: boolean;
  readOnly: boolean;
  hidden: boolean;
  inListView: boolean;
  description: string | null;
}

export interface CreateCustomFieldInput {
  dt: string;
  label: string;
  fieldname: string;
  fieldtype: string;
  insertAfter?: string;
  options?: string;
  defaultValue?: string;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  inListView?: boolean;
  description?: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listCustomFields(dt: string): Promise<CustomFieldInfo[]> {
  const rows = await prisma.custom_field.findMany({
    where: { dt },
    orderBy: { label: 'asc' },
  });
  return rows.map((r) => ({
    name: r.name,
    dt: r.dt ?? '',
    label: r.label ?? '',
    fieldname: r.fieldname ?? '',
    fieldtype: r.fieldtype ?? 'Data',
    insertAfter: r.insert_after ?? null,
    options: r.options ?? null,
    defaultValue: r.default ?? null,
    required: r.reqd === 1,
    readOnly: r.read_only === 1,
    hidden: r.hidden === 1,
    inListView: (r as Record<string, unknown>).in_list_view === 1,
    description: (r as Record<string, unknown>).description as string | null ?? null,
  }));
}

export async function createCustomField(input: CreateCustomFieldInput): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    const row = await prisma.custom_field.create({
      data: {
        name: `custom_${input.dt}_${input.fieldname}`,
        dt: input.dt,
        label: input.label,
        fieldname: input.fieldname,
        fieldtype: input.fieldtype,
        insert_after: input.insertAfter ?? null,
        options: input.options ?? null,
        default: input.defaultValue ?? null,
        reqd: input.required ? 1 : 0,
        read_only: input.readOnly ? 1 : 0,
        hidden: input.hidden ? 1 : 0,
        in_list_view: input.inListView ? 1 : 0,
        description: input.description ?? null,
      },
    });
    return { success: true, name: row.name };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint')) {
      return { success: false, error: `Field "${input.fieldname}" already exists for ${input.dt}` };
    }
    return { success: false, error: msg };
  }
}

export async function deleteCustomField(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.custom_field.delete({ where: { name } });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Merge Logic ──────────────────────────────────────────────────────────────

/** Merge custom fields into standard DocType metadata fields */
export async function mergeCustomFieldsIntoMeta(dt: string, standardFields: DocFieldMeta[]): Promise<DocFieldMeta[]> {
  const customRows = await prisma.custom_field.findMany({
    where: { dt, hidden: 0 },
    orderBy: { label: 'asc' },
  });

  if (customRows.length === 0) return standardFields;

  const customFields: DocFieldMeta[] = customRows.map((r) => ({
    fieldname: r.fieldname ?? '',
    label: r.label ?? '',
    fieldtype: (r.fieldtype ?? 'Data') as DocFieldMeta['fieldtype'],
    idx: Number(r.idx ?? 0),
    in_list_view: (r as Record<string, unknown>).in_list_view === 1,
    in_standard_filter: false,
    hidden: r.hidden === 1,
    read_only: r.read_only === 1,
    reqd: r.reqd === 1,
    permlevel: 0,
    depends_on: r.depends_on ?? null,
    description: (r as Record<string, unknown>).description as string | null ?? null,
    default: r.default ?? null,
    precision: r.precision ?? null,
    collapsible: r.collapsible === 1,
    translatable: false,
    placeholder: r.placeholder ?? null,
    fetch_from: r.fetch_from ?? null,
    fetch_if_empty: r.fetch_if_empty === 1,
    is_virtual: r.is_virtual === 1,
    link_filters: r.link_filters as string | null ?? null,
    bold: false,
    columns: 0,
    width: null,
    no_copy: false,
    set_only_once: false,
    allow_on_submit: false,
    mandatory_depends_on: r.mandatory_depends_on ?? null,
    read_only_depends_on: r.read_only_depends_on ?? null,
    collapsible_depends_on: r.collapsible_depends_on ?? null,
    in_preview: false,
    hide_border: false,
    non_negative: r.non_negative === 1,
    ignore_user_permissions: r.ignore_user_permissions === 1,
    print_hide: r.print_hide === 1,
    report_hide: false,
    show_dashboard: false,
    in_global_search: false,
    is_custom_field: true,
    options: r.options ?? null,
  }));

  // Insert custom fields after their `insert_after` field, or append at end
  const merged = [...standardFields];
  for (const cf of customFields) {
    const customRow = customRows.find((r) => r.fieldname === cf.fieldname);
    const insertAfter = customRow?.insert_after;
    if (insertAfter) {
      const idx = merged.findIndex((f) => f.fieldname === insertAfter);
      if (idx >= 0) {
        merged.splice(idx + 1, 0, cf);
        continue;
      }
    }
    merged.push(cf);
  }

  return merged;
}