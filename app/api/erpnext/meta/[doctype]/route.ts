// GET /api/erpnext/meta/<doctype>
//
// Returns the DocField-driven metadata for a doctype: fields, list view
// columns, filter bar config, child tables, and the parsed Tab/Section/
// Column/Field layout tree. Used by ERPListClient / ERPFormClient.

import { NextRequest, NextResponse } from 'next/server';
import { loadDocTypeMeta } from '@/lib/erpnext/doctype-meta';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  try {
    // The URL carries the slug ("sales-invoice"); tabDocField uses the display
    // label ("Sales Invoice"). Resolve via the existing helper.
    const registryKey = toDisplayLabel(doctype);
    const meta = await loadDocTypeMeta(registryKey);
    if (meta.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: `No DocField metadata for "${registryKey}"` },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        // Core metadata (always present)
        doctype: meta.doctype,
        fields: meta.fields,
        list_view_fields: meta.list_view_fields,
        standard_filters: meta.standard_filters,
        child_tables: meta.child_tables,
        layout_tree: meta.layout_tree,
        // Doctype-level info & permissions (added by Agent 1's loadDocTypeMeta
        // expansion — fall back gracefully if not yet present)
        doctype_info: (meta as unknown as Record<string, unknown>).doctype_info ?? null,
        permissions: (meta as unknown as Record<string, unknown>).permissions ?? [],
      },
    });
  } catch (err) {
    console.error('[meta]', errorMessage(err));
    return NextResponse.json(
      { success: false, error: errorMessage(err, 'Failed to load metadata') },
      { status: 500 },
    );
  }
}
