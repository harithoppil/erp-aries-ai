'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import type { PurchaseInvoiceItemRow } from '@/lib/erpnext/types';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafePurchaseInvoice {
  name: string;
  supplier: string;
  supplier_name: string | null;
  posting_date: Date;
  due_date: Date | null;
  status: string;
  grand_total: number;
  outstanding_amount: number;
  paid_amount: number;
  currency: string | null;
  is_return: boolean;
  is_paid: boolean;
  on_hold: boolean;
  docstatus: number;
  company: string | null;
  project: string | null;
  bill_no: string | null;
  creation: Date | null;
}

export interface ClientSafePurchaseInvoiceItem {
  name: string;
  item_code: string | null;
  item_name: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  expense_account: string | null;
  cost_center: string | null;
  warehouse: string | null;
}

export interface ClientSafePurchaseInvoiceDetail extends ClientSafePurchaseInvoice {
  items: ClientSafePurchaseInvoiceItem[];
  net_total: number;
  total_taxes_and_charges: number;
  credit_to: string;
  remarks: string | null;
  tax_id: string | null;
}

export interface CreatePurchaseInvoiceInput {
  supplier: string;
  posting_date?: string;
  due_date?: string;
  items: { item_code: string; qty: number; rate: number; expense_account?: string }[];
  bill_no?: string;
  project?: string;
  remarks?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listPurchaseInvoices(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; invoices: ClientSafePurchaseInvoice[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Invoice", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { supplier: { contains: search, mode: 'insensitive' as const } },
            { supplier_name: { contains: search, mode: 'insensitive' as const } },
            { bill_no: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [invoices, total] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseInvoice.count({ where }),
    ]);

    return {
      success: true,
      total,
      invoices: invoices.map((i) => ({
        name: i.name,
        supplier: i.supplier,
        supplier_name: i.supplier_name,
        posting_date: i.posting_date,
        due_date: i.due_date,
        status: i.status || 'Draft',
        grand_total: Number(i.grand_total || 0),
        outstanding_amount: Number(i.outstanding_amount || 0),
        paid_amount: Number(i.paid_amount || 0),
        currency: i.currency,
        is_return: !!i.is_return,
        is_paid: !!i.is_paid,
        on_hold: !!i.on_hold,
        docstatus: i.docstatus || 0,
        company: i.company,
        project: i.project,
        bill_no: i.bill_no,
        creation: i.creation,
      })),
    };
  } catch (error: any) {
    console.error('[purchase-invoices] listPurchaseInvoices failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch purchase invoices' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getPurchaseInvoice(
  id: string
): Promise<{ success: true; invoice: ClientSafePurchaseInvoiceDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Invoice", "read");
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { name: id },
      
    });

    if (!invoice) return { success: false, error: 'Purchase Invoice not found' };

    return {
      success: true,
      invoice: {
        name: invoice.name,
        supplier: invoice.supplier,
        supplier_name: invoice.supplier_name,
        posting_date: invoice.posting_date,
        due_date: invoice.due_date,
        status: invoice.status || 'Draft',
        grand_total: Number(invoice.grand_total || 0),
        outstanding_amount: Number(invoice.outstanding_amount || 0),
        paid_amount: Number(invoice.paid_amount || 0),
        currency: invoice.currency,
        is_return: !!invoice.is_return,
        is_paid: !!invoice.is_paid,
        on_hold: !!invoice.on_hold,
        docstatus: invoice.docstatus || 0,
        company: invoice.company,
        project: invoice.project,
        bill_no: invoice.bill_no,
        creation: invoice.creation,
        items: ((invoice as Record<string, unknown>)?.purchaseInvoiceItems as PurchaseInvoiceItemRow[] || []).map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          qty: i.qty,
          uom: i.uom,
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          expense_account: i.expense_account,
          cost_center: i.cost_center,
          warehouse: i.warehouse,
        })),
        net_total: Number(invoice.net_total || 0),
        total_taxes_and_charges: Number(invoice.total_taxes_and_charges || 0),
        credit_to: invoice.credit_to,
        remarks: invoice.remarks,
        tax_id: invoice.tax_id,
      },
    };
  } catch (error: any) {
    console.error('[purchase-invoices] getPurchaseInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch purchase invoice' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createPurchaseInvoice(
  data: CreatePurchaseInvoiceInput
): Promise<{ success: true; invoice: ClientSafePurchaseInvoice } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Invoice", "create");
    if (!data.supplier) return { success: false, error: 'Supplier is required' };
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const total = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const name = `PINV-${Date.now()}`;

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        name,
        naming_series: 'PINV-',
        supplier: data.supplier,
        supplier_name: data.supplier,
        company: 'Aries',
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        due_date: data.due_date ? new Date(data.due_date) : new Date(),
        currency: 'AED',
        conversion_rate: 1,
        credit_to: 'Creditors - A',
        status: 'Draft',
        is_opening: 'No',
        is_paid: false,
        on_hold: false,
        total_qty: data.items.reduce((s, i) => s + i.qty, 0),
        total,
        net_total: total,
        grand_total: total,
        base_total: total,
        base_net_total: total,
        base_grand_total: total,
        outstanding_amount: total,
        paid_amount: 0,
        bill_no: data.bill_no || null,
        project: data.project || null,
        remarks: data.remarks || null,
        // @ts-expect-error Prisma schema no relation
        purchaseInvoiceItems: {
          create: data.items.map((item, idx) => ({
            name: `PINVITEM-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Purchase Invoice',
            item_code: item.item_code,
            item_name: item.item_code,
            qty: item.qty,
            stock_qty: item.qty,
            uom: 'Nos',
            conversion_factor: 1,
            rate: item.rate,
            amount: item.qty * item.rate,
            base_rate: item.rate,
            base_amount: item.qty * item.rate,
            net_rate: item.rate,
            net_amount: item.qty * item.rate,
            base_net_rate: item.rate,
            base_net_amount: item.qty * item.rate,
            expense_account: item.expense_account || 'Cost of Goods Sold - A',
            cost_center: 'Main - A',
          })),
        },
      },
      
    });

    revalidatePath('/dashboard/erp/buying/invoices');
    return {
      success: true,
      invoice: {
        name: invoice.name,
        supplier: invoice.supplier,
        supplier_name: invoice.supplier_name,
        posting_date: invoice.posting_date,
        due_date: invoice.due_date,
        status: invoice.status || 'Draft',
        grand_total: Number(invoice.grand_total || 0),
        outstanding_amount: Number(invoice.outstanding_amount || 0),
        paid_amount: Number(invoice.paid_amount || 0),
        currency: invoice.currency,
        is_return: !!invoice.is_return,
        is_paid: !!invoice.is_paid,
        on_hold: !!invoice.on_hold,
        docstatus: invoice.docstatus || 0,
        company: invoice.company,
        project: invoice.project,
        bill_no: invoice.bill_no,
        creation: invoice.creation,
      },
    };
  } catch (error: any) {
    console.error('[purchase-invoices] createPurchaseInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create purchase invoice' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitPurchaseInvoice(id: string): Promise<SubmitResult> {
  await requirePermission("Purchase Invoice", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Purchase Invoice", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/buying/invoices');
  return result;
}

export async function cancelPurchaseInvoice(id: string): Promise<CancelResult> {
  await requirePermission("Purchase Invoice", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Purchase Invoice", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/buying/invoices');
  return result;
}
