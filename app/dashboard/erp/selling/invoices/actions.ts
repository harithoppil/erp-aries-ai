'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument } from '@/lib/erpnext/document-orchestrator';
import type { SalesInvoiceItemRow } from '@/lib/erpnext/types';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeSalesInvoice {
  name: string;
  customer: string;
  customer_name: string | null;
  posting_date: Date;
  due_date: Date | null;
  status: string;
  grand_total: number;
  outstanding_amount: number;
  paid_amount: number;
  currency: string;
  is_return: boolean;
  is_pos: boolean;
  docstatus: number;
  company: string;
  project: string | null;
  creation: Date | null;
}

export interface ClientSafeSalesInvoiceItem {
  name: string;
  item_code: string | null;
  item_name: string;
  qty: number | null;
  uom: string;
  rate: number;
  amount: number;
  income_account: string;
  cost_center: string | null;
  warehouse: string | null;
}

export interface ClientSafeSalesInvoiceDetail extends ClientSafeSalesInvoice {
  items: ClientSafeSalesInvoiceItem[];
  net_total: number;
  total_taxes_and_charges: number;
  debit_to: string;
  po_no: string | null;
  po_date: Date | null;
  remarks: string | null;
  territory: string | null;
  customer_group: string | null;
  shipping_address: string | null;
}

export interface CreateSalesInvoiceInput {
  customer: string;
  posting_date?: string;
  due_date?: string;
  items: { item_code: string; qty: number; rate: number; income_account?: string }[];
  po_no?: string;
  project?: string;
  remarks?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listSalesInvoices(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; invoices: ClientSafeSalesInvoice[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { customer: { contains: search, mode: 'insensitive' as const } },
            { customer_name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [invoices, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesInvoice.count({ where }),
    ]);

    return {
      success: true,
      total,
      invoices: invoices.map((i) => ({
        name: i.name,
        customer: i.customer,
        customer_name: i.customer_name,
        posting_date: i.posting_date,
        due_date: i.due_date,
        status: i.status || 'Draft',
        grand_total: Number(i.grand_total || 0),
        outstanding_amount: Number(i.outstanding_amount || 0),
        paid_amount: Number(i.paid_amount || 0),
        currency: i.currency || 'AED',
        is_return: !!i.is_return,
        is_pos: !!i.is_pos,
        docstatus: i.docstatus || 0,
        company: i.company,
        project: i.project,
        creation: i.creation,
      })),
    };
  } catch (error: any) {
    console.error('[sales-invoices] listSalesInvoices failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch sales invoices' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getSalesInvoice(
  id: string
): Promise<{ success: true; invoice: ClientSafeSalesInvoiceDetail } | { success: false; error: string }> {
  try {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { name: id },
      
    });

    if (!invoice) return { success: false, error: 'Sales Invoice not found' };

    return {
      success: true,
      invoice: {
        name: invoice.name,
        customer: invoice.customer,
        customer_name: invoice.customer_name,
        posting_date: invoice.posting_date,
        due_date: invoice.due_date,
        status: invoice.status || 'Draft',
        grand_total: Number(invoice.grand_total || 0),
        outstanding_amount: Number(invoice.outstanding_amount || 0),
        paid_amount: Number(invoice.paid_amount || 0),
        currency: invoice.currency || 'AED',
        is_return: !!invoice.is_return,
        is_pos: !!invoice.is_pos,
        docstatus: invoice.docstatus || 0,
        company: invoice.company,
        project: invoice.project,
        creation: invoice.creation,
        items: ((invoice as Record<string, unknown>)?.salesInvoiceItems as SalesInvoiceItemRow[] || []).map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          qty: i.qty,
          uom: i.uom,
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          income_account: i.income_account,
          cost_center: i.cost_center,
          warehouse: null,
        })),
        net_total: Number(invoice.net_total || 0),
        total_taxes_and_charges: Number(invoice.total_taxes_and_charges || 0),
        debit_to: invoice.debit_to,
        po_no: invoice.po_no,
        po_date: invoice.po_date,
        remarks: invoice.remarks,
        territory: invoice.territory,
        customer_group: invoice.customer_group,
        shipping_address: invoice.shipping_address,
      },
    };
  } catch (error: any) {
    console.error('[sales-invoices] getSalesInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch sales invoice' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createSalesInvoice(
  data: CreateSalesInvoiceInput
): Promise<{ success: true; invoice: ClientSafeSalesInvoice } | { success: false; error: string }> {
  try {
    if (!data.customer) return { success: false, error: 'Customer is required' };
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const total = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const name = `SINV-${Date.now()}`;

    const invoice = await prisma.salesInvoice.create({
      data: {
        name,
        naming_series: 'SINV-',
        customer: data.customer,
        customer_name: data.customer,
        company: 'Aries',
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        due_date: data.due_date ? new Date(data.due_date) : new Date(),
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        debit_to: 'Debtors - A',
        status: 'Draft',
        is_opening: 'No',
        total_qty: data.items.reduce((s, i) => s + i.qty, 0),
        total,
        net_total: total,
        grand_total: total,
        base_total: total,
        base_net_total: total,
        base_grand_total: total,
        outstanding_amount: total,
        paid_amount: 0,
        po_no: data.po_no || null,
        project: data.project || null,
        remarks: data.remarks || null,
        // @ts-expect-error Prisma schema no relation
        salesInvoiceItems: {
          create: data.items.map((item, idx) => ({
            name: `SINVITEM-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Sales Invoice',
            item_code: item.item_code,
            item_name: item.item_code,
            qty: item.qty,
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
            income_account: item.income_account || 'Sales - A',
            cost_center: 'Main - A',
          })),
        },
      },
      
    });

    revalidatePath('/dashboard/erp/selling/invoices');
    return {
      success: true,
      invoice: {
        name: invoice.name,
        customer: invoice.customer,
        customer_name: invoice.customer_name,
        posting_date: invoice.posting_date,
        due_date: invoice.due_date,
        status: invoice.status || 'Draft',
        grand_total: Number(invoice.grand_total || 0),
        outstanding_amount: Number(invoice.outstanding_amount || 0),
        paid_amount: Number(invoice.paid_amount || 0),
        currency: invoice.currency || 'AED',
        is_return: !!invoice.is_return,
        is_pos: !!invoice.is_pos,
        docstatus: invoice.docstatus || 0,
        company: invoice.company,
        project: invoice.project,
        creation: invoice.creation,
      },
    };
  } catch (error: any) {
    console.error('[sales-invoices] createSalesInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create sales invoice' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitSalesInvoice(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await submitDocument("Sales Invoice", id);
  if (result.success) revalidatePath('/dashboard/erp/selling/invoices');
  return result;
}

export async function cancelSalesInvoice(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await cancelDocument("Sales Invoice", id);
  if (result.success) revalidatePath('/dashboard/erp/selling/invoices');
  return result;
}
