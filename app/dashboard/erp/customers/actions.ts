'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

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
  created_at: Date;
};

export interface CustomerValidateInput {
  customer_name: string;
  territory?: string;
  customer_group?: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listCustomers(): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  try {
    const customers = await prisma.customers.findMany({
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.id,
        customer_name: c.customer_name,
        customer_code: c.customer_code,
        contact_person: c.contact_person || null,
        email: c.email || null,
        phone: c.phone || null,
        address: c.address || null,
        industry: c.industry || null,
        tax_id: c.tax_id || null,
        credit_limit: c.credit_limit || null,
        status: c.status,
        created_at: c.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching customers:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch customers' };
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
    const id = randomUUID();
    const customer = await prisma.customers.create({
      data: {
        id,
        customer_name: data.customer_name,
        customer_code: data.customer_code || `CUST-${id.slice(0, 8).toUpperCase()}`,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        industry: data.industry || null,
        tax_id: data.tax_id || null,
        credit_limit: data.credit_limit || null,
        status: 'Active',
      },
    });
    revalidatePath('/erp/customers');
    return {
      success: true as const,
      customer: {
        id: customer.id,
        customer_name: customer.customer_name,
        customer_code: customer.customer_code,
        contact_person: customer.contact_person,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        industry: customer.industry,
        tax_id: customer.tax_id,
        credit_limit: customer.credit_limit,
        status: customer.status,
        created_at: customer.created_at,
      } as ClientSafeCustomer,
    };
  } catch (error: any) {
    console.error('Error creating customer:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create customer' };
  }
}

export async function searchCustomers(query: string): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  try {
    const customers = await prisma.customers.findMany({
      where: {
        customer_name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.id,
        customer_name: c.customer_name,
        customer_code: c.customer_code,
        contact_person: c.contact_person || null,
        email: c.email || null,
        phone: c.phone || null,
        address: c.address || null,
        industry: c.industry || null,
        tax_id: c.tax_id || null,
        credit_limit: c.credit_limit || null,
        status: c.status,
        created_at: c.created_at,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate customer data before creation/update.
 * Checks: unique customer_name (within scope).
 */
export async function validateCustomer(
  data: CustomerValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    // 1. customer_name is required
    if (!data.customer_name || data.customer_name.trim().length === 0) {
      return { success: false, error: 'Customer Name is required' };
    }

    // 2. Check uniqueness of customer_name
    const existing = await prisma.customers.findFirst({
      where: { customer_name: data.customer_name.trim() },
    });
    if (existing) {
      return { success: false, error: `Customer "${data.customer_name}" already exists` };
    }

    // Territory and customer_group validations removed — no corresponding Prisma models
    return { success: true, valid: true };
  } catch (error: any) {
    console.error('[customers] validateCustomer failed:', error?.message);
    return { success: false, error: error?.message || 'Customer validation failed' };
  }
}

/**
 * Get total outstanding amount for a customer from Sales Invoices
 * plus unbilled Sales Orders.
 */
export async function getCustomerOutstanding(
  customerName: string
): Promise<{ success: true; outstanding: number } | { success: false; error: string }> {
  try {
    if (!customerName || customerName.trim().length === 0) {
      return { success: false, error: 'Customer name is required' };
    }

    // Outstanding from Sales Invoices
    const invoices = await prisma.sales_invoices.findMany({
      where: {
        customer_name: customerName,
        outstanding_amount: { gt: 0 },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      select: { outstanding_amount: true },
    });
    const invoiceOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);

    // Outstanding from Sales Orders that are not completed/cancelled/draft
    const orders = await prisma.sales_orders.findMany({
      where: {
        customer_name: customerName,
        status: { notIn: ['DRAFT', 'CANCELLED', 'COMPLETED'] },
      },
      select: { total: true },
    });
    const orderOutstanding = orders.reduce((sum, so) => sum + (so.total || 0), 0);

    const totalOutstanding = invoiceOutstanding + orderOutstanding;

    return { success: true, outstanding: Math.round(totalOutstanding * 100) / 100 };
  } catch (error: any) {
    console.error('[customers] getCustomerOutstanding failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get customer outstanding' };
  }
}

/**
 * Check whether adding `additionalAmount` would breach the customer's credit limit.
 */
export async function checkCreditLimit(
  customerName: string,
  additionalAmount: number
): Promise<
  | { success: true; withinLimit: true; creditLimit: number; projectedOutstanding: number }
  | { success: true; withinLimit: false; creditLimit: number; projectedOutstanding: number; error: string }
  | { success: false; error: string }
> {
  try {
    if (!customerName || customerName.trim().length === 0) {
      return { success: false, error: 'Customer name is required' };
    }

    const customer = await prisma.customers.findFirst({
      where: { customer_name: customerName },
      select: { credit_limit: true },
    });
    if (!customer) {
      return { success: false, error: `Customer "${customerName}" not found` };
    }

    const creditLimit = customer.credit_limit || 0;
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
  } catch (error: any) {
    console.error('[customers] checkCreditLimit failed:', error?.message);
    return { success: false, error: error?.message || 'Credit limit check failed' };
  }
}
