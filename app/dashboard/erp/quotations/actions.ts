'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';

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

export interface FrappeSalesOrder {
  name: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listQuotations(): Promise<
  { success: true; quotations: ClientSafeQuotation[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.quotations.findMany({
      include: { quotation_items: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      quotations: rows.map((q) => ({
        id: q.id,
        quotation_number: q.quotation_number,
        customer_name: q.customer_name || 'Unknown',
        status: q.status || 'DRAFT',
        subtotal: q.subtotal || 0,
        tax_amount: q.tax_amount || 0,
        total: q.total || 0,
        currency: q.currency || 'AED',
        valid_till: q.valid_until,
        created_at: q.created_at,
        project_type: q.project_type || null,
        notes: q.notes || null,
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
    const subtotal = data.items.reduce((s, i) => s + (i.qty ?? i.quantity ?? 1) * i.rate, 0);
    const tax_amount = subtotal * (data.tax_rate || 0) / 100;
    const total = subtotal + tax_amount;

    const record = await prisma.quotations.create({
      data: {
        id: crypto.randomUUID(),
        quotation_number: `QTN-${Date.now()}`,
        customer_id: data.customer_id || null,
        customer_name: customer,
        project_type: data.project_type || null,
        valid_until: data.valid_until || null,
        subtotal,
        tax_rate: data.tax_rate || 0,
        tax_amount,
        total,
        currency: 'AED',
        notes: data.notes || null,
        status: 'DRAFT',
        quotation_items: {
          create: data.items.map((i) => ({
            id: crypto.randomUUID(),
            item_code: i.item_code || '',
            description: i.description || '',
            quantity: i.qty ?? i.quantity ?? 1,
            rate: i.rate,
            amount: (i.qty ?? i.quantity ?? 1) * i.rate,
          })),
        },
      },
      include: { quotation_items: true },
    });

    revalidatePath('/erp/quotations');
    return {
      success: true as const,
      quotation: {
        id: record.id,
        quotation_number: record.quotation_number,
        customer_name: customer,
        status: 'DRAFT',
        subtotal,
        tax_amount,
        total,
        currency: 'AED',
        valid_till: data.valid_until || null,
        valid_until: data.valid_until || null,
        created_at: record.created_at,
        project_type: data.project_type || null,
        notes: data.notes || null,
      } as ClientSafeQuotation,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create quotation' };
  }
}

// ── Submit / Cancel (via document orchestrator) ─────────────────────────────────

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function submitQuotation(id: string): Promise<SubmitResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Quotation", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/quotations');
  return result;
}

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function cancelQuotation(id: string): Promise<CancelResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Quotation", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/quotations');
  return result;
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

export async function validateQuotation(
  data: QuotationValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    if (!data.party_name || data.party_name.trim().length === 0) {
      return { success: false, error: 'Party Name is required' };
    }

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

    if (data.valid_till && data.transaction_date) {
      const validTill = new Date(data.valid_till);
      const transactionDate = new Date(data.transaction_date);
      if (validTill < transactionDate) {
        return { success: false, error: 'Valid till date cannot be before transaction date' };
      }
    }

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

export async function makeSalesOrder(
  quotationId: string
): Promise<{ success: true; salesOrder: FrappeSalesOrder } | { success: false; error: string }> {
  try {
    const qtn = await prisma.quotations.findUnique({
      where: { id: quotationId },
      include: { quotation_items: true },
    });
    if (!qtn) {
      return { success: false, error: 'Quotation not found' };
    }
    if (qtn.status !== 'SENT' && qtn.status !== 'ACCEPTED') {
      return { success: false, error: 'Quotation must be submitted before creating a Sales Order' };
    }

    if (qtn.valid_until) {
      const validTill = new Date(qtn.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validTill < today) {
        return { success: false, error: 'Validity period of this quotation has ended' };
      }
    }

    const so = await prisma.sales_orders.create({
      data: {
        id: crypto.randomUUID(),
        order_number: `SO-${Date.now()}`,
        quotation_id: quotationId,
        customer_id: qtn.customer_id,
        customer_name: qtn.customer_name,
        subtotal: qtn.subtotal || 0,
        tax_rate: qtn.tax_rate || 0,
        tax_amount: qtn.tax_amount || 0,
        total: qtn.total || 0,
        currency: qtn.currency || 'AED',
        status: 'DRAFT',
        sales_order_items: {
          create: (qtn.quotation_items || []).map((item) => ({
            id: crypto.randomUUID(),
            item_code: item.item_code || '',
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            amount: item.amount || 0,
            delivered_qty: 0,
          })),
        },
      },
    });

    revalidatePath('/erp/sales-orders');
    revalidatePath('/erp/quotations');
    return { success: true, salesOrder: { name: so.order_number } };
  } catch (error: any) {
    console.error('[quotations] makeSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create Sales Order from Quotation' };
  }
}

export async function getQuotationMargin(
  quotationId: string
): Promise<
  | { success: true; total: number; cost: number; margin: number; marginPercent: number }
  | { success: false; error: string }
> {
  try {
    const qtn = await prisma.quotations.findUnique({
      where: { id: quotationId },
      include: { quotation_items: true },
    });
    if (!qtn) {
      return { success: false, error: 'Quotation not found' };
    }

    const total = qtn.total || 0;
    const items = qtn.quotation_items || [];

    if (items.length === 0) {
      return { success: true, total, cost: 0, margin: 0, marginPercent: 0 };
    }

    const itemCodes = Array.from(new Set(items.map((i) => i.item_code).filter((code): code is string => typeof code === 'string' && code.length > 0)));
    const itemDocs = await prisma.items.findMany({
      where: { item_code: { in: itemCodes } },
      select: { item_code: true, standard_rate: true },
    });

    const costMap: Record<string, number> = {};
    for (const it of itemDocs) {
      costMap[it.item_code] = it.standard_rate || 0;
    }

    let cost = 0;
    for (const item of items) {
      const unitCost = costMap[item.item_code || ''] || 0;
      cost += unitCost * (item.quantity || 1);
    }

    const margin = total - cost;
    const marginPercent = total > 0 ? Math.round((margin / total) * 10000) / 100 : 0;

    return {
      success: true,
      total: Math.round(total * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
    };
  } catch (error: any) {
    console.error('[quotations] getQuotationMargin failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to calculate quotation margin' };
  }
}
