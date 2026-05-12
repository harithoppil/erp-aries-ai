export const dynamic = 'force-dynamic';

// ── Generic Detail Page — Server Component ────────────────────────────────────
// Pattern 3: Async server component fetches data, transforms to client-safe
// props, then renders a client component. No 'use client' here.

import { fetchDoctypeRecord, fetchDoctypeSchema } from './actions';
import GenericDetailClient from './GenericDetailClient';
import ERPFormClient from '@/app/dashboard/erp/components/erp-meta/ERPFormClient';
import { loadDocTypeMeta } from '@/lib/erpnext/doctype-meta';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { notFound } from 'next/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SYSTEM_FIELDS = new Set([
  'creation',
  'modified',
  'owner',
  'modified_by',
  'docstatus',
  'idx',
  'parent',
  'parentfield',
  'parenttype',
  '_user_tags',
  '_comments',
  '_assign',
  '_liked_by',
]);

/**
 * Determine if a value is a child-table array.
 * Child table rows are arrays of objects where each object has a `parent` field.
 */
function isChildTableArray(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  const first = value[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    !Array.isArray(first) &&
    ('parent' in first || 'parenttype' in first || 'parentfield' in first)
  );
}

/**
 * Transform a record value to a client-safe JSON value.
 * - Date objects become ISO strings
 * - Decimal/BigInt become strings
 * - Objects/arrays are recursed
 */
function toClientSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(toClientSafe);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = toClientSafe(v);
    }
    return result;
  }
  return String(value);
}

// ── Page Component ────────────────────────────────────────────────────────────

export default async function GenericDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ doctype: string; name: string }>;
  searchParams: Promise<{ source?: string; amend?: string }>;
}) {
  const { doctype, name } = await params;
  const query = await searchParams;

  // "new" route — render create form with metadata-driven layout when available
  if (name === 'new') {
    const registryKey = toDisplayLabel(doctype);
    let meta: import('@/lib/erpnext/doctype-meta').DocTypeMeta | null = null;
    try {
      meta = await loadDocTypeMeta(registryKey);
    } catch {
      meta = null;
    }

    if (meta && meta.fields.length > 0) {
      // Build base record with DocField defaults
      const emptyRecord: Record<string, unknown> = { docstatus: 0, name: '' };
      for (const field of meta.fields) {
        if (field.default != null && field.default !== '') {
          if (field.fieldtype === 'Check') {
            emptyRecord[field.fieldname] = field.default === '1';
          } else if (['Int', 'Float', 'Currency', 'Percent'].includes(field.fieldtype)) {
            emptyRecord[field.fieldname] = Number(field.default) || 0;
          } else {
            emptyRecord[field.fieldname] = field.default;
          }
        }
      }

      // Prefill from source record (Duplicate / Amend)
      let prefillChildTables: Record<string, Record<string, unknown>[]> = {};
      if (query.source) {
        const sourceResult = await fetchDoctypeRecord(doctype, query.source);
        if (sourceResult.success && sourceResult.data) {
          const sourceData = sourceResult.data;
          // Copy scalar fields from source, skip system/identity fields
          const skipFields = new Set(['name', 'docstatus', 'creation', 'modified', 'owner', 'modified_by', 'idx', 'parent', 'parenttype', 'parentfield', '_user_tags', '_comments', '_assign', '_liked_by', 'amended_from']);
          for (const [k, v] of Object.entries(sourceData)) {
            if (!skipFields.has(k) && !Array.isArray(v)) {
              emptyRecord[k] = v;
            }
          }
          // Track amend lineage
          if (query.amend) {
            emptyRecord.amended_from = query.source;
          }
          // Extract child tables from source
          for (const [k, v] of Object.entries(sourceData)) {
            if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object' && 'parentfield' in (v[0] as Record<string, unknown>)) {
              prefillChildTables[k] = (v as Record<string, unknown>[]).map((row) => {
                const clean: Record<string, unknown> = {};
                for (const [rk, rv] of Object.entries(row as Record<string, unknown>)) {
                  if (!skipFields.has(rk) && rk !== 'name') clean[rk] = rv;
                }
                return clean;
              });
            }
          }
        }
      }

      // Build child table arrays — prefill from source if available
      const childTables: Record<string, Record<string, unknown>[]> = {};
      for (const ct of meta.child_tables) {
        childTables[ct.fieldname] = prefillChildTables[ct.fieldname] ?? [];
      }

      return (
        <ERPFormClient
          doctype={doctype}
          record={emptyRecord}
          childTables={childTables}
          isNew={true}
          initialMeta={meta}
        />
      );
    }

    // Fallback to GenericDetailClient when no DocField metadata exists
    const schemaResult = await fetchDoctypeSchema(doctype);
    const schemaFields = schemaResult.success ? schemaResult.data : [];

    const emptyRecord: Record<string, unknown> = {};
    for (const field of schemaFields) {
      emptyRecord[field.name] = field.default ?? '';
    }

    return (
      <GenericDetailClient
        doctype={doctype}
        record={emptyRecord}
        childTables={{}}
        schemaFields={schemaFields}
        isNew
      />
    );
  }

  // Fetch the record via server action
  const result = await fetchDoctypeRecord(doctype, name);

  if (!result.success) {
    if (result.error === 'NOT_FOUND') {
      notFound();
    }
    // Other errors — show error state
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <div className="text-center space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Failed to load record</h2>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  const rawRecord = result.data;

  // ── Separate child tables from scalar fields ──────────────────────
  const scalarRecord: Record<string, unknown> = {};
  const childTables: Record<string, Record<string, unknown>[]> = {};

  for (const [key, value] of Object.entries(rawRecord)) {
    if (isChildTableArray(value)) {
      // Transform each child row to client-safe format
      childTables[key] = value.map((row) => toClientSafe(row) as Record<string, unknown>);
    } else {
      scalarRecord[key] = toClientSafe(value);
    }
  }

  // Probe DocField metadata. If the doctype has Frappe metadata, render the
  // metadata-driven form (tabs + sections + columns, mirrors localhost:8000).
  // Otherwise fall back to the flat GenericDetailClient.
  const registryKey = toDisplayLabel(doctype);
  let meta: import('@/lib/erpnext/doctype-meta').DocTypeMeta | null = null;
  try {
    meta = await loadDocTypeMeta(registryKey);
  } catch {
    meta = null;
  }

  if (meta && meta.fields.length > 0) {
    return (
      <ERPFormClient
        doctype={doctype}
        record={scalarRecord}
        childTables={childTables}
        initialMeta={meta}
      />
    );
  }

  // Fallback: legacy flat form for doctypes without DocField metadata.
  const schemaResult = await fetchDoctypeSchema(doctype);
  const schemaFields = schemaResult.success ? schemaResult.data : [];
  const isSubmittable = meta?.doctype_info?.is_submittable ?? false;

  return (
    <GenericDetailClient
      doctype={doctype}
      record={scalarRecord}
      childTables={childTables}
      schemaFields={schemaFields}
      isSubmittable={isSubmittable}
    />
  );
}
