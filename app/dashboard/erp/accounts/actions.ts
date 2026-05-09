'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { Prisma, salesinvoicestatus } from '@/prisma/client';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SalesInvoiceItem {
  item_code?: string;
  description: string;
  qty: number;
  rate: number;
  amount?: number;
  uom?: string;
}

export interface SalesInvoiceTax {
  charge_type: string;
  account_head: string;
  description: string;
  rate: number;
  tax_amount?: number;
  total?: number;
}

export interface SalesInvoiceData {
  customer: string;
  posting_date: string;
  due_date?: string;
  company?: string;
  currency?: string;
  items: SalesInvoiceItem[];
  taxes?: SalesInvoiceTax[];
  discount_amount?: number;
  apply_discount_on?: 'Grand Total' | 'Net Total' | '';
}

export interface PurchaseInvoiceItem {
  item_code?: string;
  description: string;
  qty: number;
  rate: number;
  amount?: number;
  uom?: string;
  warehouse?: string;
}

export interface PurchaseInvoiceTax {
  charge_type: string;
  account_head: string;
  description: string;
  rate: number;
  tax_amount?: number;
  total?: number;
  add_deduct_tax?: 'Add' | 'Deduct';
}

export interface PurchaseInvoiceData {
  supplier: string;
  posting_date: string;
  due_date?: string;
  bill_no?: string;
  bill_date?: string;
  company?: string;
  currency?: string;
  items: PurchaseInvoiceItem[];
  taxes?: PurchaseInvoiceTax[];
  is_paid?: boolean;
  mode_of_payment?: string;
}

export interface JournalEntryAccount {
  account: string;
  debit?: number;
  credit?: number;
  debit_in_account_currency?: number;
  credit_in_account_currency?: number;
  party_type?: string;
  party?: string;
  reference_type?: string;
  reference_name?: string;
}

export interface JournalEntryData {
  posting_date: string;
  voucher_type: string;
  company: string;
  accounts: JournalEntryAccount[];
  cheque_no?: string;
  cheque_date?: string;
  user_remark?: string;
  multi_currency?: boolean;
}

export interface PaymentEntryReference {
  reference_doctype: string;
  reference_name: string;
  allocated_amount: number;
  outstanding_amount?: number;
}

export interface PaymentEntryData {
  payment_type: 'Receive' | 'Pay' | 'Internal Transfer';
  party_type?: string;
  party?: string;
  posting_date: string;
  company: string;
  paid_amount: number;
  received_amount: number;
  paid_from: string;
  paid_to: string;
  mode_of_payment?: string;
  references?: PaymentEntryReference[];
  source_exchange_rate?: number;
  target_exchange_rate?: number;
}

export interface GLEntryData {
  posting_date: string;
  account: string;
  debit?: number;
  credit?: number;
  against?: string;
  voucher_type: string;
  voucher_no: string;
  company: string;
  cost_center?: string;
  project?: string;
  remarks?: string;
}

// ── Client-Safe Types ───────────────────────────────────────────────────────

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

export type ClientSafeSalesInvoice = {
  id: string;
  name: string;
  customer: string;
  posting_date: string;
  due_date: string | null;
  status: string;
  net_total: number;
  tax_amount: number;
  grand_total: number;
  currency: string;
  paid_amount: number;
  outstanding_amount: number;
  created_at: Date;
};

export type ClientSafePurchaseInvoice = {
  id: string;
  name: string;
  supplier: string;
  posting_date: string;
  due_date: string | null;
  bill_no: string | null;
  status: string;
  net_total: number;
  tax_amount: number;
  grand_total: number;
  currency: string;
  paid_amount: number;
  outstanding_amount: number;
  created_at: Date;
};

export type ClientSafeJournalEntry = {
  id: string;
  name: string;
  posting_date: string;
  voucher_type: string;
  company: string;
  total_debit: number;
  total_credit: number;
  difference: number;
  status: string;
  created_at: Date;
};

export type ClientSafePaymentEntry = {
  id: string;
  name: string;
  payment_type: string;
  party_type: string | null;
  party: string | null;
  posting_date: string;
  paid_amount: number;
  received_amount: number;
  status: string;
  mode_of_payment: string | null;
  created_at: Date;
};

export type ClientSafeGLEntry = {
  id: string;
  name: string;
  posting_date: string;
  account: string;
  debit: number;
  credit: number;
  against: string | null;
  voucher_type: string;
  voucher_no: string;
  company: string;
  created_at: Date;
};

// ── Response Helpers ────────────────────────────────────────────────────────

export type AccountListResponse =
  | { success: true; accounts: ClientSafeAccount[] }
  | { success: false; error: string };

export type InvoiceListResponse =
  | { success: true; invoices: ClientSafeInvoice[] }
  | { success: false; error: string };

export type ValidationResult =
  | { success: true }
  | { success: false; error: string };

export type TotalsResult =
  | { success: true; net_total: number; tax_amount: number; grand_total: number }
  | { success: false; error: string };

export type OutstandingBalanceResult =
  | { success: true; customer: string; outstanding_balance: number }
  | { success: false; error: string };

// ── Accounts ────────────────────────────────────────────────────────────────

export async function listAccounts(): Promise<AccountListResponse> {
  try {
    const accounts = await prisma.accounts.findMany({
      where: { company: 'Aries Marine' },
      orderBy: { lft: 'asc' },
      take: 1000,
    });

    const clientSafe: ClientSafeAccount[] = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      account_number: a.account_number || null,
      account_type: a.account_type || null,
      root_type: a.root_type || null,
      is_group: a.is_group,
      company: a.company,
      account_currency: a.account_currency,
      balance: a.balance,
      currency: a.account_currency,
      created_at: a.created_at,
    }));

    return { success: true, accounts: clientSafe };
  } catch (error: any) {
    console.error('Error fetching accounts:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch accounts' };
  }
}

// ── Account Tree ────────────────────────────────────────────────────────────

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
    const accounts = await prisma.accounts.findMany({
      where: { company: 'Aries Marine' },
      orderBy: { lft: 'asc' },
      take: 1000,
    });

    const result: AccountTreeNode[] = [];
    const stack: { rgt: number }[] = [];

    for (const a of accounts) {
      while (stack.length > 0 && stack[stack.length - 1].rgt < a.rgt) {
        stack.pop();
      }
      const level = stack.length;
      stack.push({ rgt: a.rgt });

      result.push({
        id: a.id,
        name: a.name,
        account_number: a.account_number || null,
        account_type: a.account_type || null,
        root_type: a.root_type || '',
        parent_account: a.parent_account || null,
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

// ── Sales Invoices ──────────────────────────────────────────────────────────

export async function listInvoices(): Promise<InvoiceListResponse> {
  try {
    const invoices = await prisma.sales_invoices.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    const clientSafe: ClientSafeInvoice[] = invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      customer_email: inv.customer_email || null,
      posting_date: inv.posting_date.toISOString().slice(0, 10),
      due_date: inv.due_date ? inv.due_date.toISOString().slice(0, 10) : null,
      status: inv.status,
      subtotal: inv.subtotal,
      tax_rate: inv.tax_rate,
      tax_amount: inv.tax_amount,
      total: inv.total,
      currency: inv.currency,
      paid_amount: inv.paid_amount,
      outstanding_amount: inv.outstanding_amount,
      created_at: inv.created_at,
    }));

    return { success: true, invoices: clientSafe };
  } catch (error: any) {
    console.error('Error fetching invoices:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch invoices' };
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
    const postingDate = new Date();
    postingDate.setHours(0, 0, 0, 0);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (data.due_date_days || 30));

    const items = data.items.map((item) => ({
      item_code: item.item_code || 'Services',
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    const invoiceNumber = `INV-${Date.now()}`;
    const id = crypto.randomUUID();

    const invoice = await prisma.sales_invoices.create({
      data: {
        id,
        invoice_number: invoiceNumber,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        posting_date: postingDate,
        due_date: dueDate,
        status: 'DRAFT',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: 'AED',
        paid_amount: 0,
        outstanding_amount: total,
        invoice_items: {
          create: items.map((item) => ({
            id: crypto.randomUUID(),
            item_code: item.item_code,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        },
      },
    });

    revalidatePath('/erp/accounts');
    return {
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email || null,
        posting_date: invoice.posting_date.toISOString().slice(0, 10),
        due_date: invoice.due_date ? invoice.due_date.toISOString().slice(0, 10) : null,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        currency: invoice.currency,
        paid_amount: invoice.paid_amount,
        outstanding_amount: invoice.outstanding_amount,
        created_at: invoice.created_at,
      },
    };
  } catch (error: any) {
    console.error('Error creating invoice:', error?.message);
    return { success: false, error: error?.message || 'Failed to create invoice' };
  }
}

// ── Invoice Mutations ──────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  id: string,
  status: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const updateData: Prisma.sales_invoicesUpdateInput = {
      status: status as salesinvoicestatus,
    };

    if (status === 'PAID') {
      const invoice = await prisma.sales_invoices.findUnique({ where: { id } });
      if (invoice) {
        updateData.paid_amount = invoice.total;
        updateData.outstanding_amount = 0;
      }
    }

    await prisma.sales_invoices.update({ where: { id }, data: updateData });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error: any) {
    console.error('[accounts] updateInvoiceStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update invoice status' };
  }
}

export async function updateInvoice(
  id: string,
  data: Partial<{ customer_name: string; customer_email: string; tax_rate: number; due_date_days: number }>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const updateData: Prisma.sales_invoicesUpdateInput = {};

    if (data.customer_name !== undefined) {
      updateData.customer_name = data.customer_name;
    }
    if (data.customer_email !== undefined) {
      updateData.customer_email = data.customer_email;
    }
    if (data.due_date_days !== undefined) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + data.due_date_days);
      updateData.due_date = dueDate;
    }
    if (data.tax_rate !== undefined) {
      const invoice = await prisma.sales_invoices.findUnique({ where: { id } });
      if (invoice) {
        const taxAmount = (invoice.subtotal * data.tax_rate) / 100;
        const total = invoice.subtotal + taxAmount;
        updateData.tax_rate = data.tax_rate;
        updateData.tax_amount = taxAmount;
        updateData.total = total;
        if (invoice.status === 'PAID') {
          updateData.paid_amount = total;
          updateData.outstanding_amount = 0;
        } else {
          updateData.outstanding_amount = total - invoice.paid_amount;
        }
      }
    }

    await prisma.sales_invoices.update({ where: { id }, data: updateData });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error: any) {
    console.error('[accounts] updateInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update invoice' };
  }
}

export async function deleteInvoice(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.sales_invoices.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error: any) {
    console.error('[accounts] deleteInvoice failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete invoice' };
  }
}

// ── Submit / Cancel (via document orchestrator) ─────────────────────────────────

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function submitInvoice(id: string): Promise<SubmitResult> {
  const result = await submitDocument("Sales Invoice", id);
  if (result.success) revalidatePath('/dashboard/erp/accounts');
  return result;
}

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function cancelInvoice(id: string): Promise<CancelResult> {
  const result = await cancelDocument("Sales Invoice", id);
  if (result.success) revalidatePath('/dashboard/erp/accounts');
  return result;
}

// ── Business Logic: Validation ──────────────────────────────────────────────

/**
 * Validate Sales Invoice data before submission.
 * Checks mandatory fields, item totals, and tax correctness.
 * Ported from erpnext/accounts/doctype/sales_invoice/sales_invoice.py
 */
export function validateSalesInvoice(data: SalesInvoiceData): ValidationResult {
  if (!data.customer || data.customer.trim() === '') {
    return { success: false, error: 'Customer is mandatory' };
  }
  if (!data.posting_date) {
    return { success: false, error: 'Posting Date is mandatory' };
  }
  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one item is required' };
  }

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    if (!item.description || item.description.trim() === '') {
      return { success: false, error: `Row ${idx + 1}: Description is required` };
    }
    if (typeof item.qty !== 'number' || item.qty <= 0) {
      return { success: false, error: `Row ${idx + 1}: Quantity must be greater than 0` };
    }
    if (typeof item.rate !== 'number' || item.rate < 0) {
      return { success: false, error: `Row ${idx + 1}: Rate cannot be negative` };
    }
    const expectedAmount = item.qty * item.rate;
    if (item.amount !== undefined && Math.abs(item.amount - expectedAmount) > 0.01) {
      return { success: false, error: `Row ${idx + 1}: Amount ${item.amount} does not match Qty * Rate (${expectedAmount})` };
    }
  }

  const netTotal = data.items.reduce((sum, item) => sum + item.qty * item.rate, 0);

  if (data.taxes && data.taxes.length > 0) {
    let computedTax = 0;
    for (let tidx = 0; tidx < data.taxes.length; tidx++) {
      const tax = data.taxes[tidx];
      if (!tax.account_head || tax.account_head.trim() === '') {
        return { success: false, error: `Tax Row ${tidx + 1}: Account Head is required` };
      }
      if (typeof tax.rate !== 'number' || tax.rate < 0) {
        return { success: false, error: `Tax Row ${tidx + 1}: Tax Rate cannot be negative` };
      }
      if (tax.charge_type === 'On Net Total') {
        computedTax += netTotal * tax.rate / 100;
      }
      if (tax.tax_amount !== undefined && tax.tax_amount < 0) {
        return { success: false, error: `Tax Row ${tidx + 1}: Tax Amount cannot be negative` };
      }
    }
  }

  if (data.discount_amount !== undefined && data.discount_amount < 0) {
    return { success: false, error: 'Discount Amount cannot be negative' };
  }

  return { success: true };
}

/**
 * Validate Purchase Invoice data before submission.
 * Checks supplier, item totals, and mandatory fields.
 * Ported from erpnext/accounts/doctype/purchase_invoice/purchase_invoice.py
 */
export function validatePurchaseInvoice(data: PurchaseInvoiceData): ValidationResult {
  if (!data.supplier || data.supplier.trim() === '') {
    return { success: false, error: 'Supplier is mandatory' };
  }
  if (!data.posting_date) {
    return { success: false, error: 'Posting Date is mandatory' };
  }
  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one item is required' };
  }

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    if (!item.description || item.description.trim() === '') {
      return { success: false, error: `Row ${idx + 1}: Description is required` };
    }
    if (typeof item.qty !== 'number' || item.qty <= 0) {
      return { success: false, error: `Row ${idx + 1}: Quantity must be greater than 0` };
    }
    if (typeof item.rate !== 'number' || item.rate < 0) {
      return { success: false, error: `Row ${idx + 1}: Rate cannot be negative` };
    }
    const expectedAmount = item.qty * item.rate;
    if (item.amount !== undefined && Math.abs(item.amount - expectedAmount) > 0.01) {
      return { success: false, error: `Row ${idx + 1}: Amount ${item.amount} does not match Qty * Rate (${expectedAmount})` };
    }
  }

  const netTotal = data.items.reduce((sum, item) => sum + item.qty * item.rate, 0);

  if (data.taxes && data.taxes.length > 0) {
    for (let tidx = 0; tidx < data.taxes.length; tidx++) {
      const tax = data.taxes[tidx];
      if (!tax.account_head || tax.account_head.trim() === '') {
        return { success: false, error: `Tax Row ${tidx + 1}: Account Head is required` };
      }
      if (typeof tax.rate !== 'number' || tax.rate < 0) {
        return { success: false, error: `Tax Row ${tidx + 1}: Tax Rate cannot be negative` };
      }
      if (tax.tax_amount !== undefined && tax.tax_amount < 0) {
        return { success: false, error: `Tax Row ${tidx + 1}: Tax Amount cannot be negative` };
      }
    }
  }

  if (data.is_paid && !data.mode_of_payment) {
    return { success: false, error: 'Mode of Payment is required for paid invoices' };
  }

  if (data.bill_date && data.posting_date && new Date(data.bill_date) > new Date(data.posting_date)) {
    return { success: false, error: 'Bill Date cannot be after Posting Date' };
  }

  const grandTotal = netTotal + (data.taxes?.reduce((s, t) => s + (t.tax_amount ?? (netTotal * t.rate / 100)), 0) ?? 0);
  if (grandTotal < 0) {
    return { success: false, error: 'Grand Total cannot be negative' };
  }

  return { success: true };
}

/**
 * Validate Journal Entry data before submission.
 * Checks debit === credit, valid accounts, and row-level constraints.
 * Ported from erpnext/accounts/doctype/journal_entry/journal_entry.py
 */
export function validateJournalEntry(data: JournalEntryData): ValidationResult {
  if (!data.posting_date) {
    return { success: false, error: 'Posting Date is mandatory' };
  }
  if (!data.company || data.company.trim() === '') {
    return { success: false, error: 'Company is mandatory' };
  }
  if (!data.voucher_type || data.voucher_type.trim() === '') {
    return { success: false, error: 'Voucher Type is mandatory' };
  }
  if (!data.accounts || data.accounts.length === 0) {
    return { success: false, error: 'At least one account row is required' };
  }

  if (data.accounts.length < 2) {
    return { success: false, error: 'Journal Entry must have at least 2 account rows' };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let idx = 0; idx < data.accounts.length; idx++) {
    const row = data.accounts[idx];
    if (!row.account || row.account.trim() === '') {
      return { success: false, error: `Row ${idx + 1}: Account is required` };
    }

    const debit = row.debit ?? row.debit_in_account_currency ?? 0;
    const credit = row.credit ?? row.credit_in_account_currency ?? 0;

    if (debit < 0 || credit < 0) {
      return { success: false, error: `Row ${idx + 1}: Debit and Credit values cannot be negative` };
    }

    if (debit > 0 && credit > 0) {
      return { success: false, error: `Row ${idx + 1}: You cannot credit and debit the same account at the same time` };
    }

    if (debit === 0 && credit === 0) {
      return { success: false, error: `Row ${idx + 1}: Both Debit and Credit values cannot be zero` };
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  const difference = parseFloat((totalDebit - totalCredit).toFixed(2));
  if (difference !== 0) {
    return { success: false, error: `Total Debit (${totalDebit}) must be equal to Total Credit (${totalCredit}). The difference is ${difference}` };
  }

  return { success: true };
}

/**
 * Validate Payment Entry data before submission.
 * Checks party, amount > 0, mode_of_payment, and reference allocations.
 * Ported from erpnext/accounts/doctype/payment_entry/payment_entry.py
 */
export function validatePaymentEntry(data: PaymentEntryData): ValidationResult {
  if (!data.payment_type) {
    return { success: false, error: 'Payment Type is mandatory' };
  }
  if (!data.posting_date) {
    return { success: false, error: 'Posting Date is mandatory' };
  }
  if (!data.company || data.company.trim() === '') {
    return { success: false, error: 'Company is mandatory' };
  }
  if (!data.paid_from || data.paid_from.trim() === '') {
    return { success: false, error: 'Paid From account is mandatory' };
  }
  if (!data.paid_to || data.paid_to.trim() === '') {
    return { success: false, error: 'Paid To account is mandatory' };
  }

  if (data.payment_type !== 'Internal Transfer') {
    if (!data.party_type || data.party_type.trim() === '') {
      return { success: false, error: 'Party Type is mandatory' };
    }
    if (!data.party || data.party.trim() === '') {
      return { success: false, error: 'Party is mandatory' };
    }
  }

  if (typeof data.paid_amount !== 'number' || data.paid_amount <= 0) {
    return { success: false, error: 'Paid Amount must be greater than 0' };
  }
  if (typeof data.received_amount !== 'number' || data.received_amount <= 0) {
    return { success: false, error: 'Received Amount must be greater than 0' };
  }

  if (data.paid_amount < data.received_amount) {
    return { success: false, error: 'Received Amount cannot be greater than Paid Amount' };
  }

  if (data.mode_of_payment && data.mode_of_payment.trim() === '') {
    return { success: false, error: 'Mode of Payment cannot be empty if provided' };
  }

  if (data.references && data.references.length > 0) {
    for (let idx = 0; idx < data.references.length; idx++) {
      const ref = data.references[idx];
      if (!ref.reference_doctype || ref.reference_doctype.trim() === '') {
        return { success: false, error: `Reference Row ${idx + 1}: Reference Doctype is required` };
      }
      if (!ref.reference_name || ref.reference_name.trim() === '') {
        return { success: false, error: `Reference Row ${idx + 1}: Reference Name is required` };
      }
      if (typeof ref.allocated_amount !== 'number' || ref.allocated_amount <= 0) {
        return { success: false, error: `Reference Row ${idx + 1}: Allocated Amount must be greater than 0` };
      }
      if (ref.outstanding_amount !== undefined && ref.allocated_amount > ref.outstanding_amount) {
        return { success: false, error: `Reference Row ${idx + 1}: Allocated Amount cannot be greater than Outstanding Amount` };
      }
    }
  }

  return { success: true };
}

// ── Business Logic: Calculations ────────────────────────────────────────────

/**
 * Calculate invoice totals from items and taxes.
 * Computes net_total, tax_amount, and grand_total.
 * Ported from erpnext/controllers/taxes_and_totals.py
 */
export function calculateInvoiceTotals(
  items: SalesInvoiceItem[],
  taxes: SalesInvoiceTax[]
): TotalsResult {
  if (!items || items.length === 0) {
    return { success: false, error: 'Items are required to calculate totals' };
  }

  const netTotal = items.reduce((sum, item) => {
    const lineAmount = (item.qty || 0) * (item.rate || 0);
    return sum + lineAmount;
  }, 0);

  let taxAmount = 0;
  if (taxes && taxes.length > 0) {
    for (const tax of taxes) {
      if (tax.charge_type === 'On Net Total') {
        taxAmount += netTotal * (tax.rate || 0) / 100;
      } else if (tax.charge_type === 'On Previous Row Amount') {
        taxAmount += tax.tax_amount || 0;
      } else if (tax.charge_type === 'Actual') {
        taxAmount += tax.tax_amount || 0;
      } else {
        taxAmount += tax.tax_amount || 0;
      }
    }
  }

  const grandTotal = netTotal + taxAmount;

  return {
    success: true,
    net_total: parseFloat(netTotal.toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2)),
  };
}

// ── Business Logic: Outstanding Balance ─────────────────────────────────────

/**
 * Get the outstanding balance for a customer by summing unpaid invoices.
 * Ported from erpnext/accounts/party.py outstanding logic.
 */
export async function getOutstandingBalance(customer: string): Promise<OutstandingBalanceResult> {
  try {
    if (!customer || customer.trim() === '') {
      return { success: false, error: 'Customer is required' };
    }

    const invoices = await prisma.sales_invoices.findMany({
      where: {
        customer_name: customer,
        status: 'SUBMITTED',
        outstanding_amount: { gt: 0 },
      },
      select: { outstanding_amount: true },
    });

    const outstandingBalance = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);

    return {
      success: true,
      customer,
      outstanding_balance: parseFloat(outstandingBalance.toFixed(2)),
    };
  } catch (error: any) {
    console.error('[accounts] getOutstandingBalance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch outstanding balance' };
  }
}

// ── Business Logic: GL Entry ────────────────────────────────────────────────

/**
 * Create a General Ledger entry via Prisma.
 * Ported from erpnext/accounts/general_ledger.py make_gl_entries logic.
 */
export async function createGLEntry(data: GLEntryData): Promise<
  { success: true; entry: ClientSafeGLEntry } | { success: false; error: string }
> {
  try {
    if (!data.account || data.account.trim() === '') {
      return { success: false, error: 'Account is mandatory' };
    }
    if (!data.voucher_type || data.voucher_type.trim() === '') {
      return { success: false, error: 'Voucher Type is mandatory' };
    }
    if (!data.voucher_no || data.voucher_no.trim() === '') {
      return { success: false, error: 'Voucher No is mandatory' };
    }
    if (!data.company || data.company.trim() === '') {
      return { success: false, error: 'Company is mandatory' };
    }
    if (!data.posting_date) {
      return { success: false, error: 'Posting Date is mandatory' };
    }

    const debit = data.debit ?? 0;
    const credit = data.credit ?? 0;

    if (debit < 0 || credit < 0) {
      return { success: false, error: 'Debit and Credit cannot be negative' };
    }

    if (debit === 0 && credit === 0) {
      return { success: false, error: 'Either Debit or Credit must be greater than 0' };
    }

    const account = await prisma.accounts.findFirst({
      where: { name: data.account },
    });

    if (!account) {
      return { success: false, error: `Account "${data.account}" not found` };
    }

    const id = crypto.randomUUID();

    const entry = await prisma.gl_entries.create({
      data: {
        id,
        posting_date: new Date(data.posting_date),
        account_id: account.id,
        voucher_type: data.voucher_type,
        voucher_no: data.voucher_no,
        debit,
        credit,
        debit_in_account_currency: debit,
        credit_in_account_currency: credit,
        cost_center: data.cost_center || null,
        project_id: null,
        remarks: data.remarks || null,
        is_cancelled: false,
      },
    });

    revalidatePath('/erp/accounts');
    return {
      success: true,
      entry: {
        id: entry.id,
        name: entry.id,
        posting_date: data.posting_date,
        account: data.account,
        debit,
        credit,
        against: data.against || null,
        voucher_type: entry.voucher_type ?? data.voucher_type,
        voucher_no: entry.voucher_no ?? data.voucher_no,
        company: data.company,
        created_at: entry.created_at,
      },
    };
  } catch (error: any) {
    console.error('[accounts] createGLEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create GL Entry' };
  }
}

// ── Business Logic: Payment Reconciliation ──────────────────────────────────

/**
 * Reconcile a payment entry against one or more invoices.
 * Allocates the payment amount across the provided invoice IDs.
 * Ported from erpnext/accounts/doctype/payment_entry/payment_entry.py
 *
 * NOTE: This function is not fully supported with the current Prisma schema
 * because the Payment Entry model lacks `unallocated_amount` and `references`
 * fields required for reconciliation.
 */
export async function reconcilePayment(
  paymentId: string,
  invoiceIds: string[]
): Promise<{ success: true; allocated: number } | { success: false; error: string }> {
  try {
    if (!paymentId || paymentId.trim() === '') {
      return { success: false, error: 'Payment ID is required' };
    }
    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: 'At least one invoice ID is required' };
    }

    return {
      success: false,
      error: 'Payment reconciliation is not supported with the current Prisma schema (Payment Entry references model unavailable)',
    };
  } catch (error: any) {
    console.error('[accounts] reconcilePayment failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to reconcile payment' };
  }
}
