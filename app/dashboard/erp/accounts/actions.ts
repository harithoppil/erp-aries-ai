'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

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

export type AccountListResponse = { success: true; accounts: ClientSafeAccount[] } | { success: false; error: string };
export type InvoiceListResponse = { success: true; invoices: ClientSafeInvoice[] } | { success: false; error: string };
export type ValidationResult = { success: true } | { success: false; error: string };
export type TotalsResult = { success: true; net_total: number; tax_amount: number; grand_total: number } | { success: false; error: string };
export type OutstandingBalanceResult = { success: true; customer: string; outstanding_balance: number } | { success: false; error: string };

// ── Accounts ────────────────────────────────────────────────────────────────

export async function listAccounts(): Promise<AccountListResponse> {
  try {
    await requirePermission("Account", "read");
    const accounts = await prisma.account.findMany({
      where: { company: 'Aries' },
      orderBy: { lft: 'asc' },
      take: 1000,
    });
    const clientSafe: ClientSafeAccount[] = accounts.map((a) => ({
      id: a.name,
      name: a.account_name || a.name,
      account_number: a.account_number || null,
      account_type: a.account_type || null,
      root_type: a.root_type || null,
      is_group: a.is_group || false,
      company: a.company,
      account_currency: a.account_currency || 'AED',
      balance: 0,
      currency: a.account_currency || 'AED',
      created_at: a.creation || new Date(),
    }));
    return { success: true, accounts: clientSafe };
  } catch (error) {
    console.error('Error fetching accounts:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch accounts') };
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
    await requirePermission("Account", "read");
    const accounts = await prisma.account.findMany({
      where: { company: 'Aries' },
      orderBy: { lft: 'asc' },
      take: 1000,
    });
    const result: AccountTreeNode[] = [];
    const stack: { rgt: number }[] = [];
    for (const a of accounts) {
      while (stack.length > 0 && stack[stack.length - 1].rgt < (a.rgt || 0)) stack.pop();
      const level = stack.length;
      stack.push({ rgt: a.rgt || 0 });
      result.push({
        id: a.name,
        name: a.account_name || a.name,
        account_number: a.account_number || null,
        account_type: a.account_type || null,
        root_type: a.root_type || '',
        parent_account: a.parent_account || null,
        is_group: a.is_group || false,
        balance: 0,
        lft: a.lft || 0,
        rgt: a.rgt || 0,
        level,
        has_children: (a.rgt || 0) - (a.lft || 0) > 1,
      });
    }
    return { success: true, accounts: result };
  } catch (error) {
    console.error('[accounts] getAccountTree failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch account tree') };
  }
}

// ── Sales Invoices ──────────────────────────────────────────────────────────

export async function listInvoices(): Promise<InvoiceListResponse> {
  try {
    await requirePermission("Account", "read");
    const invoices = await prisma.salesInvoice.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });
    const clientSafe: ClientSafeInvoice[] = invoices.map((inv) => ({
      id: inv.name,
      invoice_number: inv.name,
      customer_name: inv.customer_name || 'Unknown',
      customer_email: null,
      posting_date: inv.posting_date ? inv.posting_date.toISOString().slice(0, 10) : '',
      due_date: inv.due_date ? inv.due_date.toISOString().slice(0, 10) : null,
      status: inv.status || 'Draft',
      subtotal: Number(inv.net_total || 0),
      tax_rate: 0,
      tax_amount: Number(inv.total_taxes_and_charges || 0),
      total: Number(inv.grand_total || 0),
      currency: inv.currency || 'AED',
      paid_amount: Number(inv.paid_amount || 0),
      outstanding_amount: Number(inv.outstanding_amount || 0),
      created_at: inv.creation || new Date(),
    }));
    return { success: true, invoices: clientSafe };
  } catch (error) {
    console.error('Error fetching invoices:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch invoices') };
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
    await requirePermission("Account", "create");
    const postingDate = new Date(); postingDate.setHours(0, 0, 0, 0);
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + (data.due_date_days || 30));
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    const name = `SINV-${Date.now()}`;

    const invoice = await prisma.salesInvoice.create({
      data: {
        name,
        naming_series: 'SINV-',
        customer: data.customer_name,
        customer_name: data.customer_name,
        company: 'Aries',
        posting_date: postingDate,
        due_date: dueDate,
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        debit_to: 'Debtors - A',
        is_opening: 'No',
        status: 'Draft',
        total_qty: data.items.reduce((s, i) => s + i.quantity, 0),
        total: subtotal,
        net_total: subtotal,
        total_net_weight: 0,
        total_taxes_and_charges: taxAmount,
        base_total_taxes_and_charges: taxAmount,
        loyalty_points: 0,
        loyalty_amount: 0,
        additional_discount_percentage: 0,
        base_discount_amount: 0,
        discount_amount: 0,
        grand_total: total,
        base_total: total,
        base_net_total: subtotal,
        base_grand_total: total,
        base_rounding_adjustment: 0,
        base_rounded_total: total,
        rounding_adjustment: 0,
        rounded_total: total,
        total_advance: 0,
        outstanding_amount: total,
        base_paid_amount: 0,
        paid_amount: 0,
        base_change_amount: 0,
        change_amount: 0,
        write_off_amount: 0,
        base_write_off_amount: 0,
        commission_rate: 0,
        total_commission: 0,
        total_billing_hours: 0,
        total_billing_amount: 0,
        amount_eligible_for_commission: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    revalidatePath('/erp/accounts');
    return {
      success: true,
      invoice: {
        id: invoice.name,
        invoice_number: invoice.name,
        customer_name: invoice.customer_name || data.customer_name,
        customer_email: null,
        posting_date: invoice.posting_date ? invoice.posting_date.toISOString().slice(0, 10) : '',
        due_date: invoice.due_date ? invoice.due_date.toISOString().slice(0, 10) : null,
        status: invoice.status || 'Draft',
        subtotal: Number(invoice.net_total || 0),
        tax_rate: taxRate,
        tax_amount: Number(invoice.total_taxes_and_charges || 0),
        total: Number(invoice.grand_total || 0),
        currency: invoice.currency || 'AED',
        paid_amount: Number(invoice.paid_amount || 0),
        outstanding_amount: Number(invoice.outstanding_amount || 0),
        created_at: invoice.creation || new Date(),
      },
    };
  } catch (error) {
    console.error('Error creating invoice:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create invoice') };
  }
}

// ── Invoice Mutations ──────────────────────────────────────────────────────

export async function updateInvoiceStatus(id: string, status: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "update");
    const updateData: Record<string, unknown> = { status };
    if (status === 'Paid') {
      const invoice = await prisma.salesInvoice.findUnique({ where: { name: id } });
      if (invoice) {
        updateData.paid_amount = invoice.grand_total;
        updateData.outstanding_amount = 0;
      }
    }
    await prisma.salesInvoice.update({ where: { name: id }, data: updateData });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error) {
    console.error('[accounts] updateInvoiceStatus failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to update invoice status') };
  }
}

export async function updateInvoice(
  id: string,
  data: Partial<{ customer_name: string; customer_email: string; tax_rate: number; due_date_days: number }>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "update");
    const updateData: Record<string, unknown> = {};
    if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;
    if (data.due_date_days !== undefined) {
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + data.due_date_days);
      updateData.due_date = dueDate;
    }
    await prisma.salesInvoice.update({ where: { name: id }, data: updateData });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error) {
    console.error('[accounts] updateInvoice failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to update invoice') };
  }
}

export async function deleteInvoice(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "delete");
    await prisma.salesInvoice.update({ where: { name: id }, data: { status: 'Cancelled' } });
    revalidatePath('/erp/accounts');
    return { success: true };
  } catch (error) {
    console.error('[accounts] deleteInvoice failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to delete invoice') };
  }
}

// ── Submit / Cancel (via document orchestrator) ─────────────────────────────

export async function submitInvoice(id: string): Promise<SubmitResult> {
  await requirePermission("Account", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Sales Invoice", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/accounts');
  return result;
}

export async function cancelInvoice(id: string): Promise<CancelResult> {
  await requirePermission("Account", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Sales Invoice", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/accounts');
  return result;
}

// ── Business Logic: Validation ──────────────────────────────────────────────

export async function validateSalesInvoice(data: SalesInvoiceData): Promise<ValidationResult> {
  await requirePermission("Account", "read");
  if (!data.customer || data.customer.trim() === '') return { success: false, error: 'Customer is mandatory' };
  if (!data.posting_date) return { success: false, error: 'Posting Date is mandatory' };
  if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };
  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    if (!item.description || item.description.trim() === '') return { success: false, error: `Row ${idx + 1}: Description is required` };
    if (typeof item.qty !== 'number' || item.qty <= 0) return { success: false, error: `Row ${idx + 1}: Quantity must be greater than 0` };
    if (typeof item.rate !== 'number' || item.rate < 0) return { success: false, error: `Row ${idx + 1}: Rate cannot be negative` };
    const expectedAmount = item.qty * item.rate;
    if (item.amount !== undefined && Math.abs(item.amount - expectedAmount) > 0.01) return { success: false, error: `Row ${idx + 1}: Amount ${item.amount} does not match Qty * Rate (${expectedAmount})` };
  }
  const netTotal = data.items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  if (data.taxes && data.taxes.length > 0) {
    for (let tidx = 0; tidx < data.taxes.length; tidx++) {
      const tax = data.taxes[tidx];
      if (!tax.account_head || tax.account_head.trim() === '') return { success: false, error: `Tax Row ${tidx + 1}: Account Head is required` };
      if (typeof tax.rate !== 'number' || tax.rate < 0) return { success: false, error: `Tax Row ${tidx + 1}: Tax Rate cannot be negative` };
    }
  }
  if (data.discount_amount !== undefined && data.discount_amount < 0) return { success: false, error: 'Discount Amount cannot be negative' };
  return { success: true };
}

export async function validatePurchaseInvoice(data: PurchaseInvoiceData): Promise<ValidationResult> {
  await requirePermission("Account", "read");
  if (!data.supplier || data.supplier.trim() === '') return { success: false, error: 'Supplier is mandatory' };
  if (!data.posting_date) return { success: false, error: 'Posting Date is mandatory' };
  if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };
  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    if (!item.description || item.description.trim() === '') return { success: false, error: `Row ${idx + 1}: Description is required` };
    if (typeof item.qty !== 'number' || item.qty <= 0) return { success: false, error: `Row ${idx + 1}: Quantity must be greater than 0` };
    if (typeof item.rate !== 'number' || item.rate < 0) return { success: false, error: `Row ${idx + 1}: Rate cannot be negative` };
  }
  if (data.is_paid && !data.mode_of_payment) return { success: false, error: 'Mode of Payment is required for paid invoices' };
  return { success: true };
}

export async function validateJournalEntry(data: JournalEntryData): Promise<ValidationResult> {
  await requirePermission("Account", "read");
  if (!data.posting_date) return { success: false, error: 'Posting Date is mandatory' };
  if (!data.company || data.company.trim() === '') return { success: false, error: 'Company is mandatory' };
  if (!data.voucher_type || data.voucher_type.trim() === '') return { success: false, error: 'Voucher Type is mandatory' };
  if (!data.accounts || data.accounts.length < 2) return { success: false, error: 'Journal Entry must have at least 2 account rows' };
  let totalDebit = 0; let totalCredit = 0;
  for (let idx = 0; idx < data.accounts.length; idx++) {
    const row = data.accounts[idx];
    if (!row.account || row.account.trim() === '') return { success: false, error: `Row ${idx + 1}: Account is required` };
    const debit = row.debit ?? row.debit_in_account_currency ?? 0;
    const credit = row.credit ?? row.credit_in_account_currency ?? 0;
    if (debit < 0 || credit < 0) return { success: false, error: `Row ${idx + 1}: Debit and Credit values cannot be negative` };
    if (debit > 0 && credit > 0) return { success: false, error: `Row ${idx + 1}: You cannot credit and debit the same account at the same time` };
    if (debit === 0 && credit === 0) return { success: false, error: `Row ${idx + 1}: Both Debit and Credit values cannot be zero` };
    totalDebit += debit; totalCredit += credit;
  }
  const difference = parseFloat((totalDebit - totalCredit).toFixed(2));
  if (difference !== 0) return { success: false, error: `Total Debit (${totalDebit}) must be equal to Total Credit (${totalCredit})` };
  return { success: true };
}

export async function validatePaymentEntry(data: PaymentEntryData): Promise<ValidationResult> {
  await requirePermission("Account", "read");
  if (!data.payment_type) return { success: false, error: 'Payment Type is mandatory' };
  if (!data.posting_date) return { success: false, error: 'Posting Date is mandatory' };
  if (!data.company || data.company.trim() === '') return { success: false, error: 'Company is mandatory' };
  if (!data.paid_from || data.paid_from.trim() === '') return { success: false, error: 'Paid From account is mandatory' };
  if (!data.paid_to || data.paid_to.trim() === '') return { success: false, error: 'Paid To account is mandatory' };
  if (data.payment_type !== 'Internal Transfer') {
    if (!data.party_type || data.party_type.trim() === '') return { success: false, error: 'Party Type is mandatory' };
    if (!data.party || data.party.trim() === '') return { success: false, error: 'Party is mandatory' };
  }
  if (typeof data.paid_amount !== 'number' || data.paid_amount <= 0) return { success: false, error: 'Paid Amount must be greater than 0' };
  if (typeof data.received_amount !== 'number' || data.received_amount <= 0) return { success: false, error: 'Received Amount must be greater than 0' };
  if (data.paid_amount < data.received_amount) return { success: false, error: 'Received Amount cannot be greater than Paid Amount' };
  if (data.references && data.references.length > 0) {
    for (let idx = 0; idx < data.references.length; idx++) {
      const ref = data.references[idx];
      if (!ref.reference_doctype || ref.reference_doctype.trim() === '') return { success: false, error: `Reference Row ${idx + 1}: Reference Doctype is required` };
      if (!ref.reference_name || ref.reference_name.trim() === '') return { success: false, error: `Reference Row ${idx + 1}: Reference Name is required` };
      if (typeof ref.allocated_amount !== 'number' || ref.allocated_amount <= 0) return { success: false, error: `Reference Row ${idx + 1}: Allocated Amount must be greater than 0` };
    }
  }
  return { success: true };
}

// ── Business Logic: Calculations ────────────────────────────────────────────

export async function calculateInvoiceTotals(items: SalesInvoiceItem[], taxes: SalesInvoiceTax[]): Promise<TotalsResult> {
  await requirePermission("Account", "read");
  if (!items || items.length === 0) return { success: false, error: 'Items are required to calculate totals' };
  const netTotal = items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  let taxAmount = 0;
  if (taxes && taxes.length > 0) {
    for (const tax of taxes) {
      if (tax.charge_type === 'On Net Total') taxAmount += netTotal * (tax.rate || 0) / 100;
      else taxAmount += tax.tax_amount || 0;
    }
  }
  const grandTotal = netTotal + taxAmount;
  return { success: true, net_total: parseFloat(netTotal.toFixed(2)), tax_amount: parseFloat(taxAmount.toFixed(2)), grand_total: parseFloat(grandTotal.toFixed(2)) };
}

// ── Business Logic: Outstanding Balance ─────────────────────────────────────

export async function getOutstandingBalance(customer: string): Promise<OutstandingBalanceResult> {
  try {
    await requirePermission("Account", "read");
    if (!customer || customer.trim() === '') return { success: false, error: 'Customer is required' };
    const invoices = await prisma.salesInvoice.findMany({
      where: { customer_name: customer, docstatus: 1, outstanding_amount: { gt: 0 } },
      select: { outstanding_amount: true },
    });
    const outstandingBalance = invoices.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0);
    return { success: true, customer, outstanding_balance: parseFloat(outstandingBalance.toFixed(2)) };
  } catch (error) {
    console.error('[accounts] getOutstandingBalance failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch outstanding balance') };
  }
}

// ── Business Logic: GL Entry ────────────────────────────────────────────────

export async function createGLEntry(data: GLEntryData): Promise<
  { success: true; entry: ClientSafeGLEntry } | { success: false; error: string }
> {
  try {
    await requirePermission("Account", "create");
    if (!data.account || data.account.trim() === '') return { success: false, error: 'Account is mandatory' };
    if (!data.voucher_type || data.voucher_type.trim() === '') return { success: false, error: 'Voucher Type is mandatory' };
    if (!data.voucher_no || data.voucher_no.trim() === '') return { success: false, error: 'Voucher No is mandatory' };
    if (!data.company || data.company.trim() === '') return { success: false, error: 'Company is mandatory' };
    if (!data.posting_date) return { success: false, error: 'Posting Date is mandatory' };
    const debit = data.debit ?? 0;
    const credit = data.credit ?? 0;
    if (debit < 0 || credit < 0) return { success: false, error: 'Debit and Credit cannot be negative' };
    if (debit === 0 && credit === 0) return { success: false, error: 'Either Debit or Credit must be greater than 0' };
    const account = await prisma.account.findFirst({ where: { name: data.account } });
    if (!account) return { success: false, error: `Account "${data.account}" not found` };
    const name = `GL-${Date.now()}`;
    const entry = await prisma.glEntry.create({
      data: {
        name,
        posting_date: new Date(data.posting_date),
        account: data.account,
        debit,
        credit,
        debit_in_account_currency: debit,
        credit_in_account_currency: credit,
        against: data.against || null,
        voucher_type: data.voucher_type,
        voucher_no: data.voucher_no,
        company: data.company,
        cost_center: data.cost_center || null,
        remarks: data.remarks || null,
        is_cancelled: false,
        is_opening: 'No',
        transaction_exchange_rate: 1,
        debit_in_transaction_currency: debit,
        credit_in_transaction_currency: credit,
        debit_in_reporting_currency: debit,
        credit_in_reporting_currency: credit,
        reporting_currency_exchange_rate: 1,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/accounts');
    return {
      success: true,
      entry: {
        id: entry.name, name: entry.name,
        posting_date: data.posting_date, account: data.account,
        debit, credit, against: data.against || null,
        voucher_type: entry.voucher_type || data.voucher_type,
        voucher_no: entry.voucher_no || data.voucher_no,
        company: data.company,
        created_at: entry.creation || new Date(),
      },
    };
  } catch (error) {
    console.error('[accounts] createGLEntry failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create GL Entry') };
  }
}

// ── Business Logic: Payment Reconciliation ──────────────────────────────────

export async function reconcilePayment(
  _paymentId: string,
  _invoiceIds: string[]
): Promise<{ success: true; allocated: number } | { success: false; error: string }> {
  await requirePermission("Account", "update");
  return { success: false, error: 'Payment reconciliation is not supported with the current Prisma schema' };
}

// ── Invoicing Dashboard ──────────────────────────────────────────────────────

export type AgeingBucket = {
  label: string;
  count: number;
  total: number;
};

export type InvoicingDashboardData = {
  totalOutgoing: number;
  totalIncoming: number;
  totalIncomingPayment: number;
  totalOutgoingPayment: number;
};

export type AccountsAgeingData = {
  buckets: AgeingBucket[];
  totalOutstanding: number;
};

export async function getInvoicingDashboardData(): Promise<InvoicingDashboardData> {
  await requirePermission('Sales Invoice', 'read');
  const [salesInvoices, purchaseInvoices, incomingPayments, outgoingPayments] = await Promise.all([
    prisma.salesInvoice.findMany({ where: { docstatus: 1 }, select: { grand_total: true } }),
    prisma.purchaseInvoice.findMany({ where: { docstatus: 1 }, select: { grand_total: true } }),
    prisma.paymentEntry.findMany({ where: { docstatus: 1, payment_type: 'Receive' }, select: { paid_amount: true } }),
    prisma.paymentEntry.findMany({ where: { docstatus: 1, payment_type: 'Pay' }, select: { paid_amount: true } }),
  ]);
  return {
    totalOutgoing: salesInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0),
    totalIncoming: purchaseInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0),
    totalIncomingPayment: incomingPayments.reduce((s, p) => s + Number(p.paid_amount || 0), 0),
    totalOutgoingPayment: outgoingPayments.reduce((s, p) => s + Number(p.paid_amount || 0), 0),
  };
}

export async function getAccountsReceivableAgeing(): Promise<AccountsAgeingData> {
  try {
    await requirePermission('Sales Invoice', 'read');
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        docstatus: 1,
        outstanding_amount: { gt: 0 },
      },
      select: {
        outstanding_amount: true,
        due_date: true,
      },
    });

    const now = new Date();
    const buckets: AgeingBucket[] = [
      { label: '<0', count: 0, total: 0 },
      { label: '0-30', count: 0, total: 0 },
      { label: '31-60', count: 0, total: 0 },
      { label: '61-90', count: 0, total: 0 },
      { label: '91-120', count: 0, total: 0 },
      { label: '121-Above', count: 0, total: 0 },
    ];

    let totalOutstanding = 0;

    for (const inv of invoices) {
      const outstanding = Number(inv.outstanding_amount || 0);
      totalOutstanding += outstanding;

      if (!inv.due_date) {
        buckets[1].count += 1;
        buckets[1].total += outstanding;
        continue;
      }

      const diffDays = Math.floor((now.getTime() - inv.due_date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        buckets[0].count += 1;
        buckets[0].total += outstanding;
      } else if (diffDays <= 30) {
        buckets[1].count += 1;
        buckets[1].total += outstanding;
      } else if (diffDays <= 60) {
        buckets[2].count += 1;
        buckets[2].total += outstanding;
      } else if (diffDays <= 90) {
        buckets[3].count += 1;
        buckets[3].total += outstanding;
      } else if (diffDays <= 120) {
        buckets[4].count += 1;
        buckets[4].total += outstanding;
      } else {
        buckets[5].count += 1;
        buckets[5].total += outstanding;
      }
    }

    return { buckets, totalOutstanding };
  } catch (error) {
    console.error('[accounts] getAccountsReceivableAgeing failed:', errorMessage(error));
    return {
      buckets: [
        { label: '<0', count: 0, total: 0 },
        { label: '0-30', count: 0, total: 0 },
        { label: '31-60', count: 0, total: 0 },
        { label: '61-90', count: 0, total: 0 },
        { label: '91-120', count: 0, total: 0 },
        { label: '121-Above', count: 0, total: 0 },
      ],
      totalOutstanding: 0,
    };
  }
}

export async function getAccountsPayableAgeing(): Promise<AccountsAgeingData> {
  try {
    await requirePermission('Purchase Invoice', 'read');
    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        docstatus: 1,
        outstanding_amount: { gt: 0 },
      },
      select: {
        outstanding_amount: true,
        due_date: true,
      },
    });

    const now = new Date();
    const buckets: AgeingBucket[] = [
      { label: '<0', count: 0, total: 0 },
      { label: '0-30', count: 0, total: 0 },
      { label: '31-60', count: 0, total: 0 },
      { label: '61-90', count: 0, total: 0 },
      { label: '91-120', count: 0, total: 0 },
      { label: '121-Above', count: 0, total: 0 },
    ];

    let totalOutstanding = 0;

    for (const inv of invoices) {
      const outstanding = Number(inv.outstanding_amount || 0);
      totalOutstanding += outstanding;

      if (!inv.due_date) {
        buckets[1].count += 1;
        buckets[1].total += outstanding;
        continue;
      }

      const diffDays = Math.floor((now.getTime() - inv.due_date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        buckets[0].count += 1;
        buckets[0].total += outstanding;
      } else if (diffDays <= 30) {
        buckets[1].count += 1;
        buckets[1].total += outstanding;
      } else if (diffDays <= 60) {
        buckets[2].count += 1;
        buckets[2].total += outstanding;
      } else if (diffDays <= 90) {
        buckets[3].count += 1;
        buckets[3].total += outstanding;
      } else if (diffDays <= 120) {
        buckets[4].count += 1;
        buckets[4].total += outstanding;
      } else {
        buckets[5].count += 1;
        buckets[5].total += outstanding;
      }
    }

    return { buckets, totalOutstanding };
  } catch (error) {
    console.error('[accounts] getAccountsPayableAgeing failed:', errorMessage(error));
    return {
      buckets: [
        { label: '<0', count: 0, total: 0 },
        { label: '0-30', count: 0, total: 0 },
        { label: '31-60', count: 0, total: 0 },
        { label: '61-90', count: 0, total: 0 },
        { label: '91-120', count: 0, total: 0 },
        { label: '121-Above', count: 0, total: 0 },
      ],
      totalOutstanding: 0,
    };
  }
}
