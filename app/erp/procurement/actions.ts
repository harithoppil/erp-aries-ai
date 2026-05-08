'use server';

import { prisma } from '@/lib/prisma';
import { postatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { createPurchaseOrderSchema } from '@/lib/validators';

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

export async function listSuppliers(params?: {
  search?: string;
}): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { supplier_name: { contains: params.search, mode: 'insensitive' } },
        { supplier_code: { contains: params.search, mode: 'insensitive' } },
        { contact_person: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const suppliers = await prisma.suppliers.findMany({ where, orderBy: { created_at: 'desc' } });
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

export async function listPurchaseOrders(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; orders: ClientSafePurchaseOrder[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { po_number: { contains: params.search, mode: 'insensitive' } },
        { supplier_id: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.status) {
      where.status = params.status;
    }
    const orders = await prisma.purchase_orders.findMany({
      where,
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

export async function createPurchaseOrder(data: {
  supplier_id: string;
  project_id?: string;
  expected_delivery?: string;
  notes?: string;
  items: { description: string; quantity: number; rate: number; item_code?: string }[];
}) {
  // Validate input
  const parsed = createPurchaseOrderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  const validated = parsed.data;

  try {
    const poNumber = `PO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const subtotal = validated.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxAmount = subtotal * 0.05;
    const total = subtotal + taxAmount;

    const po = await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        po_number: poNumber,
        supplier_id: validated.supplier_id,
        project_id: validated.project_id || null,
        status: postatus.DRAFT,
        currency: 'AED',
        expected_delivery: validated.expected_delivery ? new Date(validated.expected_delivery) : null,
        subtotal,
        tax_amount: taxAmount,
        total,
        notes: validated.notes || null,
        po_items: {
          create: validated.items.map(i => ({
            id: randomUUID(),
            item_code: i.item_code || null,
            description: i.description,
            quantity: i.quantity,
            rate: i.rate,
            amount: i.quantity * i.rate,
          })),
        },
      },
      include: { po_items: true },
    });
    revalidatePath('/erp/procurement');
    return { success: true as const, order: po };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'PO number already exists' };
    return { success: false as const, error: error.message || 'Failed to create purchase order' };
  }
}

// ── Purchase Order Mutations ───────────────────────────────────────────────

export async function updatePurchaseOrderStatus(id: string, status: postatus) {
  try {
    const record = await prisma.purchase_orders.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/procurement');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[procurement] updatePurchaseOrderStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update purchase order status' };
  }
}

export async function updatePurchaseOrder(
  id: string,
  data: Partial<{ supplier_id: string; project_id: string; expected_delivery: Date; notes: string }>
) {
  try {
    const record = await prisma.purchase_orders.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/procurement');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[procurement] updatePurchaseOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update purchase order' };
  }
}

export async function deletePurchaseOrder(id: string) {
  try {
    await prisma.purchase_orders.update({
      where: { id },
      data: { status: postatus.CANCELLED },
    });
    revalidatePath('/erp/procurement');
    return { success: true };
  } catch (error: any) {
    console.error('[procurement] deletePurchaseOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete purchase order' };
  }
}

// ── Supplier Mutations ─────────────────────────────────────────────────────

export async function updateSupplier(
  id: string,
  data: Partial<{ supplier_name: string; contact_person: string; email: string; phone: string; address: string; category: string; rating: number }>
) {
  try {
    const record = await prisma.suppliers.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/procurement');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[procurement] updateSupplier failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update supplier' };
  }
}

export async function deleteSupplier(id: string) {
  try {
    await prisma.suppliers.delete({ where: { id } });
    revalidatePath('/erp/procurement');
    return { success: true };
  } catch (error: any) {
    console.error('[procurement] deleteSupplier failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete supplier' };
  }
}
