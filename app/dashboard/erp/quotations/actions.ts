'use server';

import { revalidatePath } from 'next/cache';
import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
  frappeCallMethod,
} from '@/lib/frappe-client';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeQuotation = {
  id: string;
  quotation_number: string;
  customer_name: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  valid_till: Date | null;
  valid_until?: Date | null;
  created_at: Date;
  project_type?: string | null;
  notes?: string | null;
};

export interface QuotationItemInput {
  item_code?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  rate: number;
}

export interface QuotationValidateInput {
  party_name: string;
  valid_till?: string;
  transaction_date?: string;
  items: QuotationItemInput[];
}

export interface FrappeQuotation {
  name: string;
  party_name?: string;
  status?: string;
  docstatus: number;
  base_net_total?: number;
  total_taxes_and_charges?: number;
  base_grand_total?: number;
  currency?: string;
  valid_till?: string;
  creation?: string;
  transaction_date?: string;
  items?: FrappeQuotationItem[];
}

export interface FrappeQuotationItem {
  name?: string;
  item_code: string;
  description?: string;
  qty: number;
  rate: number;
  amount?: number;
  ordered_qty?: number;
}

export interface FrappeSalesOrder {
  name: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listQuotations(): Promise<
  { success: true; quotations: ClientSafeQuotation[] } | { success: false; error: string }
> {
  try {
    const quotations = await frappeGetList<FrappeQuotation>('Quotation', {
      fields: ['name', 'party_name', 'status', 'docstatus', 'base_net_total', 'total_taxes_and_charges', 'base_grand_total', 'currency', 'valid_till', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      quotations: quotations.map((q) => ({
        id: q.name,
        quotation_number: q.name,
        customer_name: q.party_name || 'Unknown',
        status: q.docstatus === 1 ? 'SUBMITTED' : q.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        subtotal: q.base_net_total || 0,
        tax_amount: q.total_taxes_and_charges || 0,
        total: q.base_grand_total || 0,
        currency: q.currency || 'AED',
        valid_till: q.valid_till ? new Date(q.valid_till) : null,
        created_at: q.creation ? new Date(q.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching quotations:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch quotations' };
  }
}

export async function createQuotation(data: {
  customer_id?: string;
  customer_name?: string;
  project_type?: string;
  tax_rate?: number;
  valid_until?: Date;
  notes?: string;
  items: QuotationItemInput[];
}) {
  try {
    const customer = data.customer_name || data.customer_id || '';
    const doc = await frappeInsertDoc<FrappeQuotation>('Quotation', {
      quotation_to: 'Customer',
      party_name: customer,
      items: data.items.map((i) => {
        const qty = i.qty ?? i.quantity ?? 1;
        return {
          item_code: i.item_code || '',
          description: i.description || '',
          qty,
          rate: i.rate,
          amount: qty * i.rate,
        };
      }),
    });
    revalidatePath('/erp/quotations');
    return { success: true as const, quotation: { id: doc.name, quotation_number: doc.name, customer_name: customer, status: 'DRAFT', subtotal: 0, tax_amount: 0, total: 0, currency: 'AED', valid_till: data.valid_until || null, valid_until: data.valid_until || null, created_at: new Date(), project_type: data.project_type || null, notes: data.notes || null } as ClientSafeQuotation };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create quotation' };
  }
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate a Quotation before submission.
 * Checks: party_name exists, items present, valid_till after transaction_date.
 */
export async function validateQuotation(
  data: QuotationValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    // 1. Party name is required
    if (!data.party_name || data.party_name.trim().length === 0) {
      return { success: false, error: 'Party Name is required' };
    }

    // 2. Items must not be empty
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }
    for (const item of data.items) {
      const qty = item.qty ?? item.quantity ?? 0;
      if (qty <= 0) {
        return { success: false, error: `Item "${item.item_code || item.description || ''}" must have quantity > 0` };
      }
      if (typeof item.rate !== 'number' || item.rate < 0) {
        return { success: false, error: `Item "${item.item_code || item.description || ''}" must have a valid rate` };
      }
    }

    // 3. Valid till date must not be before transaction date
    if (data.valid_till && data.transaction_date) {
      const validTill = new Date(data.valid_till);
      const transactionDate = new Date(data.transaction_date);
      if (validTill < transactionDate) {
        return { success: false, error: 'Valid till date cannot be before transaction date' };
      }
    }

    // 4. Valid till must not be in the past
    if (data.valid_till) {
      const validTill = new Date(data.valid_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validTill < today) {
        return { success: false, error: 'Validity period of this quotation has ended' };
      }
    }

    return { success: true, valid: true };
  } catch (error: any) {
    console.error('[quotations] validateQuotation failed:', error?.message);
    return { success: false, error: error?.message || 'Quotation validation failed' };
  }
}

/**
 * Create a Sales Order from a submitted Quotation.
 */
export async function makeSalesOrder(
  quotationId: string
): Promise<{ success: true; salesOrder: FrappeSalesOrder } | { success: false; error: string }> {
  try {
    const qtn = await frappeGetDoc<FrappeQuotation>('Quotation', quotationId);
    if (qtn.docstatus !== 1) {
      return { success: false, error: 'Quotation must be submitted before creating a Sales Order' };
    }

    // Re-check expiry
    if (qtn.valid_till) {
      const validTill = new Date(qtn.valid_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validTill < today) {
        return { success: false, error: 'Validity period of this quotation has ended' };
      }
    }

    const soItems = (qtn.items || []).map((item) => ({
      item_code: item.item_code,
      description: item.description || '',
      qty: item.qty,
      rate: item.rate,
      amount: (item.qty * item.rate),
      prevdoc_docname: quotationId,
    }));

    const so = await frappeInsertDoc<FrappeSalesOrder>('Sales Order', {
      customer: qtn.party_name,
      items: soItems,
      order_type: 'Sales',
    });

    revalidatePath('/erp/sales-orders');
    revalidatePath('/erp/quotations');
    return { success: true, salesOrder: so };
  } catch (error: any) {
    console.error('[quotations] makeSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create Sales Order from Quotation' };
  }
}

/**
 * Calculate the profit margin of a Quotation.
 * Margin = total - sum(item_rate * qty) … using valuation_rate from Item as cost proxy.
 */
export async function getQuotationMargin(
  quotationId: string
): Promise<
  | { success: true; total: number; cost: number; margin: number; marginPercent: number }
  | { success: false; error: string }
> {
  try {
    const qtn = await frappeGetDoc<FrappeQuotation>('Quotation', quotationId);
    const total = qtn.base_grand_total || 0;
    const items = qtn.items || [];

    if (items.length === 0) {
      return { success: true, total, cost: 0, margin: 0, marginPercent: 0 };
    }

    // Fetch valuation_rate for each item_code as a cost proxy
    const itemCodes = Array.from(new Set(items.map((i) => i.item_code).filter((code): code is string => typeof code === 'string' && code.length > 0)));
    const itemDocs = await frappeGetList<{ name: string; valuation_rate?: number; standard_rate?: number }>('Item', {
      filters: { name: ['in', itemCodes] },
      fields: ['name', 'valuation_rate', 'standard_rate'],
      limit_page_length: itemCodes.length,
    });

    const costMap: Record<string, number> = {};
    for (const it of itemDocs) {
      costMap[it.name] = it.valuation_rate || it.standard_rate || 0;
    }

    let cost = 0;
    for (const item of items) {
      const unitCost = costMap[item.item_code] || 0;
      cost += unitCost * item.qty;
    }

    const margin = total - cost;
    const marginPercent = total > 0 ? Math.round((margin / total) * 10000) / 100 : 0;

    return {
      success: true,
      total: Math.round(total * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent,
    };
  } catch (error: any) {
    console.error('[quotations] getQuotationMargin failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to calculate quotation margin' };
  }
}
