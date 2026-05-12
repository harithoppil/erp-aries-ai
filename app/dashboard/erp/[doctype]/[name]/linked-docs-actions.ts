'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/prisma/client';
import { getDelegate, toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import type { DmmfModel, DmmfField } from '@/lib/erpnext/prisma-delegate';

export interface LinkedDocType {
  doctype: string;
  doctypeLabel: string;
  fieldname: string;
  count: number;
  records: { name: string; label: string }[];
}

export interface LinkedDocsResult {
  success: true;
  links: LinkedDocType[];
}
export interface LinkedDocsError {
  success: false;
  error: string;
}
export type FetchLinkedDocsResult = LinkedDocsResult | LinkedDocsError;

// Known link field → target doctype mappings (same as in form actions)
const LINK_FIELD_MAP: Record<string, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  item_code: 'Item',
  warehouse: 'Warehouse',
  account: 'Account',
  expense_account: 'Account',
  income_account: 'Account',
  debit_to: 'Account',
  credit_to: 'Account',
  cost_center: 'CostCenter',
  company: 'Company',
  currency: 'Currency',
  uom: 'Uom',
  project: 'Project',
  employee: 'Employee',
  department: 'Department',
  branch: 'Branch',
  designation: 'Designation',
  lead: 'Lead',
  opportunity: 'Opportunity',
  quotation: 'Quotation',
  sales_order: 'SalesOrder',
  purchase_order: 'PurchaseOrder',
  delivery_note: 'DeliveryNote',
  purchase_receipt: 'PurchaseReceipt',
  sales_invoice: 'SalesInvoice',
  purchase_invoice: 'PurchaseInvoice',
};

// Reverse map: target doctype → list of { source_doctype, fieldname }
function findLinkFieldsToTarget(targetDoctype: string): { sourceAccessor: string; sourceDoctype: string; fieldname: string; labelField?: string }[] {
  const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];
  const results: { sourceAccessor: string; sourceDoctype: string; fieldname: string; labelField?: string }[] = [];

  // Also include known link fields from LINK_FIELD_MAP
  for (const [field, target] of Object.entries(LINK_FIELD_MAP)) {
    if (target.toLowerCase() !== toAccessor(targetDoctype)) continue;
    // Find which models have this field
    for (const model of dmmfModels) {
      const hasField = model.fields.some((f: DmmfField) => f.name === field && f.type === 'String');
      if (hasField) {
        const accessor = model.name.charAt(0).toLowerCase() + model.name.slice(1);
        results.push({
          sourceAccessor: accessor,
          sourceDoctype: model.name,
          fieldname: field,
        });
      }
    }
  }

  // Also check for fields named after the target doctype (e.g. 'customer' on Sales Invoice)
  const targetSnake = targetDoctype.replace(/-/g, '_').toLowerCase();
  const targetCamel = toAccessor(targetDoctype);

  for (const model of dmmfModels) {
    if (model.name.toLowerCase() === targetCamel.toLowerCase()) continue; // skip self
    const accessor = model.name.charAt(0).toLowerCase() + model.name.slice(1);

    for (const f of model.fields) {
      if (f.type !== 'String' || f.name === 'name') continue;
      // Match field names that look like they reference the target
      if (f.name === targetSnake || f.name === targetSnake + '_name' || f.name === targetCamel) {
        // Avoid duplicates
        if (!results.some(r => r.sourceAccessor === accessor && r.fieldname === f.name)) {
          results.push({
            sourceAccessor: accessor,
            sourceDoctype: model.name,
            fieldname: f.name,
          });
        }
      }
    }
  }

  return results;
}

const LABEL_FIELDS: Record<string, string> = {
  customer: 'customer_name',
  supplier: 'supplier_name',
  item: 'item_name',
  account: 'account_name',
  warehouse: 'warehouse_name',
  cost_center: 'cost_center_name',
  company: 'company_name',
  employee: 'employee_name',
  project: 'project_name',
  task: 'subject',
  lead: 'lead_name',
  item_group: 'item_group_name',
};

export async function fetchLinkedDocs(
  doctype: string,
  name: string,
): Promise<FetchLinkedDocsResult> {
  try {
    const linkFields = findLinkFieldsToTarget(doctype);
    const links: LinkedDocType[] = [];

    for (const { sourceAccessor, sourceDoctype, fieldname } of linkFields) {
      const delegate = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]>; count: (a: unknown) => Promise<number> }>)[sourceAccessor];
      if (!delegate) continue;

      try {
        const where = { [fieldname]: name };
        const count = await delegate.count({ where });
        if (count === 0) continue;

        const labelField = LABEL_FIELDS[sourceAccessor] ?? null;
        const select = labelField ? { name: true, [labelField]: true } : { name: true };

        const rows = await delegate.findMany({
          where,
          select,
          take: 5,
          orderBy: { modified: 'desc' },
        }) as Record<string, unknown>[];

        links.push({
          doctype: sourceDoctype,
          doctypeLabel: toDisplayLabel(sourceDoctype),
          fieldname,
          count,
          records: rows.map((r) => ({
            name: String(r.name),
            label: labelField ? String(r[labelField] ?? '') : '',
          })),
        });
      } catch {
        // Skip models that error
      }
    }

    // Sort by count descending
    links.sort((a, b) => b.count - a.count);

    return { success: true, links };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchLinkedDocs]', msg);
    return { success: false, error: 'Failed to load linked documents' };
  }
}
