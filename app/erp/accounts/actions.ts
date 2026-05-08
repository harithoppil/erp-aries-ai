'use server';

import { prisma } from '@/lib/prisma';

import { salesinvoicestatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';

export type ClientSafeAccount = {
  id: string;
  name: string;
  account_number: string | null;
  account_type: string | null;
  root_type: string | null;
  is_group: boolean;
  company: string;
  account_currency: string;
  balance: number;
  currency: string;
  created_at: Date;
};

export type ClientSafeInvoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  posting_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  paid_amount: number;
  outstanding_amount: number;
  created_at: Date;
};

export type AccountListResponse =
  | { success: true; accounts: ClientSafeAccount[] }
  | { success: false; error: string };

export type InvoiceListResponse =
  | { success: true; invoices: ClientSafeInvoice[] }
  | { success: false; error: string };

export async function listAccounts(): Promise<AccountListResponse> {
  try {
    const accounts = await prisma.accounts.findMany({
      orderBy: { name: 'asc' }
    });

    const clientSafe: ClientSafeAccount[] = accounts.map((a: typeof accounts[0]) => ({
      id: a.id,
      name: a.name,
      account_number: a.account_number,
      account_type: a.account_type,
      root_type: a.root_type,
      is_group: a.is_group,
      company: a.company,
      account_currency: a.account_currency,
      balance: a.balance,
      currency: a.account_currency || 'AED',
      created_at: a.created_at
    }));

    return { success: true, accounts: clientSafe };
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return { success: false, error: 'Failed to fetch accounts' };
  }
}

export async function listInvoices(): Promise<InvoiceListResponse> {
  try {
    const invoices = await prisma.sales_invoices.findMany({
      orderBy: { created_at: 'desc' }
    });

    const clientSafe: ClientSafeInvoice[] = invoices.map((inv: typeof invoices[0]) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      customer_email: inv.customer_email,
      posting_date: inv.posting_date?.toISOString() ?? '',
      due_date: inv.due_date?.toISOString() ?? null,
      status: inv.status,
      subtotal: inv.subtotal,
      tax_rate: inv.tax_rate,
      tax_amount: inv.tax_amount,
      total: inv.total,
      currency: inv.currency,
      paid_amount: inv.paid_amount,
      outstanding_amount: inv.outstanding_amount,
      created_at: inv.created_at
    }));

    return { success: true, invoices: clientSafe };
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return { success: false, error: 'Failed to fetch invoices' };
  }
}

export async function createInvoice(data: {
  customer_name: string;
  customer_email?: string;
  tax_rate?: number;
  due_date_days?: number;
  items: { description: string; quantity: number; rate: number; item_code?: string }[];
}): Promise<{ success: true; invoice: ClientSafeInvoice } | { success: false; error: string }> {
  try {
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const postingDate = new Date();
    const dueDate = new Date(postingDate);
    dueDate.setDate(dueDate.getDate() + (data.due_date_days || 30));

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.sales_invoices.create({
        data: {
          id: generateId(),
          invoice_number: invoiceNumber,
          customer_name: data.customer_name,
          customer_email: data.customer_email || null,
          posting_date: postingDate,
          due_date: dueDate,
          status: salesinvoicestatus.SUBMITTED,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          currency: 'AED',
          paid_amount: 0,
          outstanding_amount: total,
        }
      });

      for (const item of data.items) {
        await tx.invoice_items.create({
          data: {
            id: generateId(),
            invoice_id: inv.id,
            item_code: item.item_code || null,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
          }
        });
      }

      return inv;
    });

    revalidatePath('/erp/accounts');
    return {
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        posting_date: invoice.posting_date?.toISOString() ?? '',
        due_date: invoice.due_date?.toISOString() ?? null,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        currency: invoice.currency,
        paid_amount: invoice.paid_amount,
        outstanding_amount: invoice.outstanding_amount,
        created_at: invoice.created_at
      }
    };
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.code === 'P2002') return { success: false, error: 'Invoice number already exists' };
    return { success: false, error: 'Failed to create invoice' };
  }
}

// ── Account Tree (hierarchical chart of accounts) ───────────────────────────
// Direct Prisma query — no Python proxy needed.
// Ported from backend/app/api/routes/erp_financial_reports.py chart_of_accounts()

export interface AccountTreeNode {
  id: string;
  name: string;
  account_number: string | null;
  account_type: string | null;
  root_type: string;
  parent_account: string | null;
  is_group: boolean;
  balance: number;
  lft: number;
  rgt: number;
  level: number;
  has_children: boolean;
}

export async function getAccountTree(): Promise<
  { success: true; accounts: AccountTreeNode[] } | { success: false; error: string }
> {
  try {
    // Fetch all accounts ordered by lft for correct tree traversal
    const accounts = await prisma.accounts.findMany({
      where: { company: 'Aries Marine' },
      orderBy: { lft: 'asc' },
    });

    // Build tree with nested-set level computation (matches Python build_tree())
    const result: AccountTreeNode[] = [];
    const stack: { rgt: number }[] = [];

    for (const a of accounts) {
      // Pop stack until we find the parent
      while (stack.length > 0 && stack[stack.length - 1].rgt < a.rgt) {
        stack.pop();
      }
      const level = stack.length;
      stack.push({ rgt: a.rgt });

      result.push({
        id: a.id,
        name: a.name,
        account_number: a.account_number,
        account_type: a.account_type ?? null,
        root_type: a.root_type ?? '',
        parent_account: a.parent_account,
        is_group: a.is_group,
        balance: a.balance,
        lft: a.lft,
        rgt: a.rgt,
        level,
        has_children: a.rgt - a.lft > 1,
      });
    }

    return { success: true, accounts: result };
  } catch (error: any) {
    console.error('[accounts] getAccountTree failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch account tree' };
  }
}

// ── Invoice Mutations ──────────────────────────────────────────────────────

export async function updateInvoiceStatus(id: string, status: salesinvoicestatus) {
  try {
    const updateData: { status: salesinvoicestatus; paid_amount?: number; outstanding_amount?: number } = { status };
    if (status === salesinvoicestatus.PAID) {
      const invoice = await prisma.sales_invoices.findUnique({ where: { id }, select: { total: true } });
      if (invoice) {
        updateData.paid_amount = invoice.total;
        updateData.outstanding_amount = 0;
      }
    }
    const record = await prisma.sales_invoices.update({
      where: { id },
      data: updateData,
    });
    revalidatePath('/erp/accounts');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[accounts] updateInvoiceStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update invoice status' };
  }
}

export async function updateInvoice(
  id: string,
  data: Partial<{ customer_name: string; customer_email: string; tax_rate: number; due_date_days: number }>
) {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;
    if (data.customer_email !== undefined) updateData.customer_email = data.customer_email;
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
    if (data.due_date_days !== undefined) {
      const current = await prisma.sales_invoices.findUnique({ where: { id }, select: { posting_date: true } });
      if (current) {
        const dueDate = new Date(current.posting_date);
        dueDate.setDate(dueDate.getDate() + data.due_date_days);
        updateData.due_date = dueDate;
      }
    }
    const record = await prisma.sales_invoices.update({
      where: { id },
      data: updateData,
    });
    revalidatePath('/erp/accounts');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[accounts] updateInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update invoice' };
  }
}

export async function deleteInvoice(id: string) {
  try {
    await prisma.sales_invoices.update({
      where: { id },
      data: { status: salesinvoicestatus.CANCELLED },
    });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error: any) {
    console.error('[accounts] deleteInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete invoice' };
  }
}
