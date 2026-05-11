'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeCustomer = {
  id: string;
  customer_name: string;
  customer_code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  tax_id: string | null;
  credit_limit: number | null;
  status: string;
  created_at: Date | null;
};

export interface CustomerValidateInput {
  customer_name: string;
  territory?: string;
  customer_group?: string;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listCustomers(): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Customer", "read");
    const customers = await prisma.customer.findMany({
      orderBy: { creation: 'desc' },
      take: 500,
    });

    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.name,
        customer_name: c.customer_name,
        customer_code: c.name,
        contact_person: c.customer_primary_contact || null,
        email: c.email_id || null,
        phone: c.mobile_no || null,
        address: c.primary_address || null,
        industry: c.industry || null,
        tax_id: c.tax_id || null,
        credit_limit: null, // resolved via CustomerCreditLimit child table
        status: c.disabled ? 'Inactive' : 'Active',
        created_at: c.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching customers:', msg);
    return { success: false, error: msg || 'Failed to fetch customers' };
  }
}

export async function createCustomer(data: {
  customer_name: string;
  customer_code?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  tax_id?: string;
  credit_limit?: number;
}) {
  try {
    await requirePermission("Customer", "create");
    const name = `CUST-${Date.now()}`;
    const customer = await prisma.customer.create({
      data: {
        name,
        customer_name: data.customer_name,
        customer_type: 'Company',
        email_id: data.email || null,
        mobile_no: data.phone || null,
        tax_id: data.tax_id || null,
        industry: data.industry || null,
        customer_group: 'All Customer Groups',
        territory: 'All Territories',
        naming_series: 'CUST-',
        default_commission_rate: 0,
        disabled: false,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // If credit_limit provided, create CustomerCreditLimit child row
    if (data.credit_limit && data.credit_limit > 0) {
      await prisma.customerCreditLimit.create({
        data: {
          name: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: name,
          parentfield: 'credit_limits',
          parenttype: 'Customer',
          credit_limit: data.credit_limit,
          company: 'Aries',
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    }

    revalidatePath('/erp/customers');
    return {
      success: true as const,
      customer: {
        id: customer.name,
        customer_name: customer.customer_name,
        customer_code: customer.name,
        contact_person: null,
        email: customer.email_id || null,
        phone: customer.mobile_no || null,
        address: null,
        industry: customer.industry || null,
        tax_id: customer.tax_id || null,
        credit_limit: data.credit_limit || null,
        status: 'Active',
        created_at: customer.creation,
      } as ClientSafeCustomer,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating customer:', msg);
    return { success: false as const, error: msg || 'Failed to create customer' };
  }
}

export async function searchCustomers(query: string): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Customer", "read");
    const customers = await prisma.customer.findMany({
      where: {
        customer_name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { creation: 'desc' },
      take: 50,
    });
    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.name,
        customer_name: c.customer_name,
        customer_code: c.name,
        contact_person: c.customer_primary_contact || null,
        email: c.email_id || null,
        phone: c.mobile_no || null,
        address: c.primary_address || null,
        industry: c.industry || null,
        tax_id: c.tax_id || null,
        credit_limit: null,
        status: c.disabled ? 'Inactive' : 'Active',
        created_at: c.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

// ── Validation & Business Logic ─────────────────────────────────────────────

export async function validateCustomer(
  data: CustomerValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "read");
    if (!data.customer_name || data.customer_name.trim().length === 0) {
      return { success: false, error: 'Customer Name is required' };
    }

    const existing = await prisma.customer.findFirst({
      where: { customer_name: data.customer_name.trim() },
    });
    if (existing) {
      return { success: false, error: `Customer "${data.customer_name}" already exists` };
    }

    return { success: true, valid: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[customers] validateCustomer failed:', msg);
    return { success: false, error: msg || 'Customer validation failed' };
  }
}

export async function getCustomerOutstanding(
  customerName: string
): Promise<{ success: true; outstanding: number } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "read");
    if (!customerName || customerName.trim().length === 0) {
      return { success: false, error: 'Customer name is required' };
    }

    // Outstanding from Sales Invoices
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        customer_name: customerName,
        outstanding_amount: { gt: 0 },
        docstatus: 1,
      },
      select: { outstanding_amount: true },
    });
    const invoiceOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0);

    // Outstanding from Sales Orders that are submitted
    const orders = await prisma.salesOrder.findMany({
      where: {
        customer_name: customerName,
        docstatus: 1,
      },
      select: { grand_total: true },
    });
    const orderOutstanding = orders.reduce((sum, so) => sum + Number(so.grand_total || 0), 0);

    const totalOutstanding = invoiceOutstanding + orderOutstanding;

    return { success: true, outstanding: Math.round(totalOutstanding * 100) / 100 };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[customers] getCustomerOutstanding failed:', msg);
    return { success: false, error: msg || 'Failed to get customer outstanding' };
  }
}

export async function checkCreditLimit(
  customerName: string,
  additionalAmount: number
): Promise<
  | { success: true; withinLimit: true; creditLimit: number; projectedOutstanding: number }
  | { success: true; withinLimit: false; creditLimit: number; projectedOutstanding: number; error: string }
  | { success: false; error: string }
> {
  try {
    await requirePermission("Customer", "read");
    if (!customerName || customerName.trim().length === 0) {
      return { success: false, error: 'Customer name is required' };
    }

    const customer = await prisma.customer.findFirst({
      where: { customer_name: customerName },
    });
    if (!customer) {
      return { success: false, error: `Customer "${customerName}" not found` };
    }

    // Look up credit limit from CustomerCreditLimit child table
    const creditLimitRow = await prisma.customerCreditLimit.findFirst({
      where: { parent: customer.name, company: 'Aries' },
      select: { credit_limit: true },
    });
    const creditLimit = Number(creditLimitRow?.credit_limit || 0);
    if (creditLimit <= 0) {
      return { success: true, withinLimit: true, creditLimit: 0, projectedOutstanding: 0 };
    }

    const outstandingResult = await getCustomerOutstanding(customerName);
    if (!outstandingResult.success) {
      return { success: false, error: (outstandingResult as { success: false; error: string }).error };
    }

    const projectedOutstanding = outstandingResult.outstanding + (additionalAmount || 0);
    if (projectedOutstanding > creditLimit) {
      return {
        success: true,
        withinLimit: false,
        creditLimit,
        projectedOutstanding: Math.round(projectedOutstanding * 100) / 100,
        error: `Credit limit has been crossed for customer ${customerName} (${projectedOutstanding.toFixed(2)}/${creditLimit.toFixed(2)})`,
      };
    }

    return {
      success: true,
      withinLimit: true,
      creditLimit,
      projectedOutstanding: Math.round(projectedOutstanding * 100) / 100,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[customers] checkCreditLimit failed:', msg);
    return { success: false, error: msg || 'Credit limit check failed' };
  }
}
