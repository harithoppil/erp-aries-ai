'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeSupplier = {
  id: string;
  supplier_name: string;
  supplier_code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  created_at: Date;
};

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    const suppliers = await prisma.suppliers.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, suppliers: suppliers.map((s) => ({ ...s })) };
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return { success: false, error: 'Failed to fetch suppliers' };
  }
}

export type ClientSafePurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  project_id: string | null;
  status: string;
  order_date: Date;
  expected_delivery: Date | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: Date;
};

export async function listPurchaseOrders(): Promise<
  { success: true; orders: ClientSafePurchaseOrder[] } | { success: false; error: string }
> {
  try {
    const orders = await prisma.purchase_orders.findMany({
      orderBy: { created_at: 'desc' },
      include: { suppliers: true },
    });
    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        po_number: o.po_number,
        supplier_id: o.supplier_id,
        supplier_name: o.suppliers?.supplier_name || "Unknown",
        project_id: o.project_id,
        status: String(o.status),
        order_date: o.order_date,
        expected_delivery: o.expected_delivery,
        subtotal: o.subtotal,
        tax_amount: o.tax_amount,
        total: o.total,
        currency: o.currency,
        notes: o.notes,
        created_at: o.created_at,
      }))
    };
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return { success: false, error: 'Failed to fetch purchase orders' };
  }
}

export async function createSupplier(data: {
  supplier_name: string;
  supplier_code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  rating?: number;
}) {
  try {
    const supplier = await prisma.suppliers.create({
      data: { id: randomUUID(), ...data, rating: data.rating || null }
    });
    revalidatePath('/erp/procurement');
    return { success: true as const, supplier: { ...supplier } as ClientSafeSupplier };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Supplier code already exists' };
    return { success: false as const, error: 'Failed to create supplier' };
  }
}
