export const dynamic = 'force-dynamic';

// ── Generic Detail Page — Server Component ────────────────────────────────────
// Pattern 3: Async server component fetches data, transforms to client-safe
// props, then renders a client component. No 'use client' here.

import { fetchDoctypeRecord, fetchDoctypeSchema } from './actions';
import GenericDetailClient from './GenericDetailClient';
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
}: {
  params: Promise<{ doctype: string; name: string }>;
}) {
  const { doctype, name } = await params;

  // "new" route — render create form with schema fields
  if (name === 'new') {
    const schemaResult = await fetchDoctypeSchema(doctype);
    const schemaFields = schemaResult.success ? schemaResult.data : [];

    // Build empty record with defaults
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

  return (
    <GenericDetailClient
      doctype={doctype}
      record={scalarRecord}
      childTables={childTables}
    />
  );
}
