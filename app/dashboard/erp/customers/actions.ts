'use server';

import { revalidatePath } from 'next/cache';
import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
} from '@/lib/frappe-client';

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

export interface FrappeCustomer {
  name: string;
  customer_name: string;
  customer_primary_contact?: string;
  email_id?: string;
  mobile_no?: string;
  primary_address?: string;
  industry?: string;
  tax_id?: string;
  credit_limit?: number;
  disabled?: number;
  creation?: string;
  territory?: string;
  customer_group?: string;
}

export interface FrappeSalesInvoice {
  name: string;
  outstanding_amount?: number;
  customer?: string;
  base_grand_total?: number;
}

export interface FrappeSalesOrder {
  name: string;
  customer?: string;
  base_grand_total?: number;
  per_billed?: number;
  docstatus?: number;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listCustomers(): Promise<
  { success: true; customers: ClientSafeCustomer[] } | { success: false; error: string }
> {
  try {
    const customers = await frappeGetList<FrappeCustomer>('Customer', {
      fields: ['name', 'customer_name', 'customer_primary_contact', 'email_id', 'mobile_no', 'primary_address', 'industry', 'tax_id', 'credit_limit', 'disabled', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 500,
    });

    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.name,
        customer_name: c.customer_name || c.name,
        customer_code: c.name,
        contact_person: c.customer_primary_contact || null,
        email: c.email_id || null,
        phone: c.mobile_no || null,
        address: c.primary_address || null,
        industry: c.industry || null,
        tax_id: c.tax_id || null,
        credit_limit: c.credit_limit || null,
        status: c.disabled ? 'Inactive' : 'Active',
        created_at: c.creation ? new Date(c.creation) : new Date(),
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
    const customer = await frappeInsertDoc<FrappeCustomer>('Customer', {
      customer_name: data.customer_name,
      customer_type: 'Company',
      customer_group: 'Commercial',
      territory: 'All Territories',
      email_id: data.email || undefined,
      mobile_no: data.phone || undefined,
      primary_address: data.address || undefined,
      industry: data.industry || undefined,
      tax_id: data.tax_id || undefined,
      credit_limit: data.credit_limit || 0,
    });
    revalidatePath('/erp/customers');
    return {
      success: true as const,
      customer: {
        id: customer.name,
        customer_name: customer.customer_name,
        customer_code: customer.name,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        industry: data.industry || null,
        tax_id: data.tax_id || null,
        credit_limit: data.credit_limit || null,
        status: 'Active',
        created_at: new Date(),
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
    const customers = await frappeGetList<FrappeCustomer>('Customer', {
      fields: ['name', 'customer_name', 'email_id', 'mobile_no', 'creation'],
      filters: { customer_name: ['like', `%${query}%`] },
      order_by: 'creation desc',
      limit_page_length: 50,
    });
    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.name,
        customer_name: c.customer_name,
        customer_code: c.name,
        contact_person: null,
        email: c.email_id || null,
        phone: c.mobile_no || null,
        address: null,
        industry: null,
        tax_id: null,
        credit_limit: null,
        status: 'Active',
        created_at: c.creation ? new Date(c.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate customer data before creation/update.
 * Checks: unique customer_name (within scope), valid territory.
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
    const existing = await frappeGetList<FrappeCustomer>('Customer', {
      filters: { customer_name: data.customer_name.trim() },
      fields: ['name'],
      limit_page_length: 1,
    });
    if (existing.length > 0) {
      return { success: false, error: `Customer "${data.customer_name}" already exists` };
    }

    // 3. Validate territory if provided
    if (data.territory && data.territory.trim().length > 0) {
      const territories = await frappeGetList<{ name: string }>('Territory', {
        filters: { name: data.territory },
        fields: ['name'],
        limit_page_length: 1,
      });
      if (territories.length === 0) {
        return { success: false, error: `Territory "${data.territory}" is not valid` };
      }
    }

    // 4. Validate customer_group if provided
    if (data.customer_group && data.customer_group.trim().length > 0) {
      const groups = await frappeGetList<{ name: string }>('Customer Group', {
        filters: { name: data.customer_group },
        fields: ['name'],
        limit_page_length: 1,
      });
      if (groups.length === 0) {
        return { success: false, error: `Customer Group "${data.customer_group}" is not valid` };
      }
    }

    return { success: true, valid: true };
  } catch (error: any) {
    console.error('[customers] validateCustomer failed:', error?.message);
    return { success: false, error: error?.message || 'Customer validation failed' };
  }
}

/**
 * Get total outstanding amount for a customer from GL-based Sales Invoices
 * plus unbilled Sales Orders.
 */
export async function getCustomerOutstanding(
  customerName: string
): Promise<{ success: true; outstanding: number } | { success: false; error: string }> {
  try {
    if (!customerName || customerName.trim().length === 0) {
      return { success: false, error: 'Customer name is required' };
    }

    // Outstanding from Sales Invoices (GL proxy)
    const invoices = await frappeGetList<FrappeSalesInvoice>('Sales Invoice', {
      filters: { customer: customerName, outstanding_amount: ['>', 0], docstatus: 1 },
      fields: ['outstanding_amount'],
    });
    const invoiceOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);

    // Outstanding from submitted but not fully billed Sales Orders
    const orders = await frappeGetList<FrappeSalesOrder>('Sales Order', {
      filters: { customer: customerName, docstatus: 1, per_billed: ['<', 100] },
      fields: ['base_grand_total', 'per_billed'],
    });
    const orderOutstanding = orders.reduce((sum, so) => {
      const unbilled = (so.base_grand_total || 0) * (100 - (so.per_billed || 0)) / 100;
      return sum + unbilled;
    }, 0);

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

    const customers = await frappeGetList<FrappeCustomer>('Customer', {
      filters: { customer_name: customerName },
      fields: ['name', 'credit_limit'],
      limit_page_length: 1,
    });
    if (customers.length === 0) {
      return { success: false, error: `Customer "${customerName}" not found` };
    }

    const creditLimit = customers[0].credit_limit || 0;
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
