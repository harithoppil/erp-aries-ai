'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSupplier = {
  id: string;
  supplier_name: string;
  supplier_code: string;
  email: string | null;
  category: string | null;
  status: string;
  created_at: Date;
};

export type ClientSafePurchaseOrder = {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  total: number;
  currency: string;
  created_at: Date;
};

export interface PurchaseOrderItemInput {
  item_code: string;
  qty: number;
  rate: number;
  schedule_date?: string;
}

export interface PurchaseOrderValidateInput {
  supplier: string;
  items: PurchaseOrderItemInput[];
  schedule_date?: string;
  transaction_date?: string;
}

export interface FrappePurchaseReceipt {
  name: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    const suppliers = await prisma.suppliers.findMany({
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    return {
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        supplier_name: s.supplier_name || s.id,
        supplier_code: s.supplier_code || s.id,
        email: s.email || null,
        category: s.category || null,
        status: s.disabled ? 'Inactive' : 'Active',
        created_at: s.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching suppliers:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch suppliers' };
  }
}

export async function listPurchaseOrders(): Promise<
  { success: true; orders: ClientSafePurchaseOrder[] } | { success: false; error: string }
> {
  try {
    const orders = await prisma.purchase_orders.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
      include: { suppliers: true },
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        po_number: o.po_number,
        supplier_name: o.suppliers?.supplier_name || 'Unknown',
        status: o.status,
        total: o.total,
        currency: o.currency,
        created_at: o.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch purchase orders' };
  }
}

export async function createPurchaseOrder(data: {
  supplier: string;
  items: { item_code: string; qty: number; rate: number }[];
}) {
  try {
    const supplier = await prisma.suppliers.findFirst({
      where: {
        OR: [
          { id: data.supplier },
          { supplier_code: data.supplier },
          { supplier_name: data.supplier },
        ],
      },
    });

    if (!supplier) {
      return { success: false as const, error: `Supplier "${data.supplier}" not found` };
    }

    const id = crypto.randomUUID();
    const po_number = `PO-${Date.now()}`;
    const subtotal = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const tax_amount = 0;
    const total = subtotal + tax_amount;

    const order = await prisma.purchase_orders.create({
      data: {
        id,
        po_number,
        supplier_id: supplier.id,
        status: 'DRAFT',
        order_date: new Date(),
        subtotal,
        tax_amount,
        total,
        currency: 'AED',
        notes: null,
        po_items: {
          create: data.items.map((i) => ({
            id: crypto.randomUUID(),
            item_code: i.item_code,
            description: i.item_code,
            quantity: i.qty,
            rate: i.rate,
            amount: i.qty * i.rate,
            schedule_date: null,
          })),
        },
      },
      include: { suppliers: true },
    });

    revalidatePath('/erp/procurement');
    return {
      success: true as const,
      order: {
        id: order.id,
        po_number: order.po_number,
        supplier_name: order.suppliers?.supplier_name || data.supplier,
        status: order.status,
        total: order.total,
        currency: order.currency,
        created_at: order.created_at,
      } as ClientSafePurchaseOrder,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create purchase order' };
  }
}

export async function createSupplier(data: {
  supplier_name: string;
  supplier_code?: string;
}) {
  try {
    const id = crypto.randomUUID();
    const supplier = await prisma.suppliers.create({
      data: {
        id,
        supplier_name: data.supplier_name,
        supplier_code: data.supplier_code || data.supplier_name,
        contact_person: null,
        email: null,
        phone: null,
        address: null,
        category: null,
        rating: null,
        status: 'Active',
        disabled: false,
        prevent_pos: false,
        warn_pos: false,
      },
    });

    revalidatePath('/erp/procurement');
    return {
      success: true as const,
      supplier: {
        id: supplier.id,
        supplier_name: supplier.supplier_name,
        supplier_code: supplier.supplier_code || supplier.id,
        email: supplier.email || null,
        category: supplier.category || null,
        status: supplier.disabled ? 'Inactive' : 'Active',
        created_at: supplier.created_at,
      } as ClientSafeSupplier,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create supplier' };
  }
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate a Purchase Order before submission.
 * Checks: supplier exists (and not blocked), items present, schedule_date after transaction_date.
 */
export async function validatePurchaseOrder(
  data: PurchaseOrderValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    // 1. Supplier must exist
    if (!data.supplier || data.supplier.trim().length === 0) {
      return { success: false, error: 'Supplier is required' };
    }
    const supplier = await prisma.suppliers.findFirst({
      where: {
        OR: [
          { id: data.supplier },
          { supplier_code: data.supplier },
          { supplier_name: data.supplier },
        ],
      },
    });
    if (!supplier) {
      return { success: false, error: `Supplier "${data.supplier}" not found` };
    }
    if (supplier.disabled) {
      return { success: false, error: `Supplier "${data.supplier}" is disabled` };
    }
    if (supplier.prevent_pos) {
      return { success: false, error: `Purchase Orders are not allowed for supplier "${data.supplier}"` };
    }
    if (supplier.warn_pos) {
      console.warn(`[procurement] Supplier ${data.supplier} has a cautionary scorecard standing`);
    }

    // 2. Items must not be empty
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }
    for (const item of data.items) {
      if (!item.item_code || item.item_code.trim().length === 0) {
        return { success: false, error: 'Item Code is required for all items' };
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        return { success: false, error: `Item "${item.item_code}" must have quantity > 0` };
      }
      if (typeof item.rate !== 'number' || item.rate < 0) {
        return { success: false, error: `Item "${item.item_code}" must have a valid rate` };
      }
    }

    // 3. Schedule date validation
    if (data.schedule_date && data.transaction_date) {
      const scheduleDate = new Date(data.schedule_date);
      const transactionDate = new Date(data.transaction_date);
      if (scheduleDate < transactionDate) {
        return { success: false, error: 'Schedule Date cannot be before Transaction Date' };
      }
    }

    // 4. Ensure all line items have a schedule_date or inherit from header
    for (const item of data.items) {
      if (!item.schedule_date && !data.schedule_date) {
        return { success: false, error: `Item "${item.item_code}" is missing a schedule date` };
      }
    }

    return { success: true, valid: true };
  } catch (error: any) {
    console.error('[procurement] validatePurchaseOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Purchase Order validation failed' };
  }
}

/**
 * Create a Purchase Receipt from a submitted Purchase Order.
 * NOTE: Purchase Receipts are not modelled in Prisma; this function validates the PO only.
 */
export async function makePurchaseReceipt(
  poId: string
): Promise<{ success: true; purchaseReceipt: FrappePurchaseReceipt } | { success: false; error: string }> {
  try {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: { po_items: true },
    });
    if (!po) {
      return { success: false, error: 'Purchase Order not found' };
    }
    if (po.status !== 'SUBMITTED' && po.status !== 'APPROVED') {
      return { success: false, error: 'Purchase Order must be submitted before creating a Purchase Receipt' };
    }

    const items = (po.po_items || [])
      .map((item) => {
        const pendingQty = item.quantity - item.received_qty;
        return {
          item_code: item.item_code || '',
          qty: pendingQty,
          rate: item.rate,
          amount: pendingQty * item.rate,
          against_purchase_order: poId,
          purchase_order_item: item.id,
        };
      })
      .filter((item) => item.qty > 0);

    if (items.length === 0) {
      return { success: false, error: 'All items have already been received' };
    }

    return { success: false, error: 'Purchase Receipt creation is not supported with Prisma backend' };
  } catch (error: any) {
    console.error('[procurement] makePurchaseReceipt failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create Purchase Receipt' };
  }
}

/**
 * Sum the total value of all submitted Purchase Orders for a given supplier.
 */
export async function getSupplierTotalPurchases(
  supplier: string
): Promise<{ success: true; totalPurchases: number; orderCount: number } | { success: false; error: string }> {
  try {
    if (!supplier || supplier.trim().length === 0) {
      return { success: false, error: 'Supplier is required' };
    }

    const supplierRecord = await prisma.suppliers.findFirst({
      where: {
        OR: [
          { id: supplier },
          { supplier_code: supplier },
          { supplier_name: supplier },
        ],
      },
    });

    if (!supplierRecord) {
      return { success: false, error: `Supplier "${supplier}" not found` };
    }

    const orders = await prisma.purchase_orders.findMany({
      where: {
        supplier_id: supplierRecord.id,
        status: 'SUBMITTED',
      },
      select: {
        total: true,
      },
    });

    const totalPurchases = orders.reduce((sum, o) => sum + o.total, 0);

    return {
      success: true,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      orderCount: orders.length,
    };
  } catch (error: any) {
    console.error('[procurement] getSupplierTotalPurchases failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get supplier total purchases' };
  }
}
