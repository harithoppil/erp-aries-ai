'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

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

export type CustomerListResponse =
  | { success: true; customers: ClientSafeCustomer[] }
  | { success: false; error: string };

export async function listCustomers(): Promise<CustomerListResponse> {
  try {
    const customers = await prisma.customers.findMany({
      orderBy: { created_at: 'desc' }
    });

    const clientSafe: ClientSafeCustomer[] = customers.map((c) => ({
      id: c.id,
      customer_name: c.customer_name,
      customer_code: c.customer_code,
      contact_person: c.contact_person,
      email: c.email,
      phone: c.phone,
      address: c.address,
      industry: c.industry,
      tax_id: c.tax_id,
      credit_limit: c.credit_limit,
      status: c.status,
      created_at: c.created_at
    }));

    return { success: true, customers: clientSafe };
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { success: false, error: 'Failed to fetch customers' };
  }
}

export type CreateCustomerInput = {
  customer_name: string;
  customer_code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  tax_id?: string;
  credit_limit?: number;
};

export type CreateCustomerResponse =
  | { success: true; customer: ClientSafeCustomer }
  | { success: false; error: string };

export async function createCustomer(
  data: CreateCustomerInput
): Promise<CreateCustomerResponse> {
  try {
    const customer = await prisma.customers.create({
      data: {
        id: randomUUID(),
        customer_name: data.customer_name,
        customer_code: data.customer_code,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        industry: data.industry || null,
        tax_id: data.tax_id || null,
        credit_limit: data.credit_limit || null,
        status: 'active'
      }
    });

    revalidatePath('/erp/customers');

    return {
      success: true,
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
        created_at: customer.created_at
      }
    };
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.code === 'P2002') {
      return { success: false, error: 'Customer code already exists' };
    }
    return { success: false, error: 'Failed to create customer' };
  }
}

// ── Customer Mutations ─────────────────────────────────────────────────────

export async function updateCustomer(
  id: string,
  data: Partial<{
    customer_name: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    industry: string;
    tax_id: string;
    credit_limit: number;
  }>
) {
  try {
    const record = await prisma.customers.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/customers');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[customers] updateCustomer failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update customer' };
  }
}

export async function updateCustomerStatus(id: string, status: 'active' | 'inactive' | 'suspended') {
  try {
    const record = await prisma.customers.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/customers');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[customers] updateCustomerStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update customer status' };
  }
}

export async function deleteCustomer(id: string) {
  try {
    await prisma.customers.update({
      where: { id },
      data: { status: 'inactive' },
    });
    revalidatePath('/erp/customers');
    return { success: true };
  } catch (error: any) {
    console.error('[customers] deleteCustomer failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete customer' };
  }
}
