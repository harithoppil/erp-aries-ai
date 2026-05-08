'use server';

import { revalidatePath } from 'next/cache';
import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
  frappeCallMethod,
} from '@/lib/frappe-client';

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

export interface FrappeSupplier {
  name: string;
  supplier_name: string;
  supplier_type?: string;
  supplier_group?: string;
  email_id?: string;
  disabled?: number;
  creation?: string;
  prevent_pos?: number;
  warn_pos?: number;
}

export interface FrappePurchaseOrder {
  name: string;
  supplier: string;
  status?: string;
  docstatus: number;
  base_grand_total?: number;
  currency?: string;
  creation?: string;
  schedule_date?: string;
  transaction_date?: string;
  items?: FrappePurchaseOrderItem[];
  per_received?: number;
}

export interface FrappePurchaseOrderItem {
  name?: string;
  item_code: string;
  qty: number;
  rate: number;
  amount?: number;
  received_qty?: number;
  schedule_date?: string;
}

export interface FrappePurchaseReceipt {
  name: string;
}

export interface FrappeSupplierScorecard {
  name: string;
  status?: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    const suppliers = await frappeGetList<FrappeSupplier>('Supplier', {
      fields: ['name', 'supplier_name', 'supplier_type', 'supplier_group', 'email_id', 'disabled', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 500,
    });

    return {
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.name,
        supplier_name: s.supplier_name || s.name,
        supplier_code: s.name,
        email: s.email_id || null,
        category: s.supplier_group || null,
        status: s.disabled ? 'Inactive' : 'Active',
        created_at: s.creation ? new Date(s.creation) : new Date(),
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
    const orders = await frappeGetList<FrappePurchaseOrder>('Purchase Order', {
      fields: ['name', 'supplier', 'status', 'docstatus', 'base_grand_total', 'currency', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.name,
        po_number: o.name,
        supplier_name: o.supplier || 'Unknown',
        status: o.docstatus === 1 ? 'SUBMITTED' : o.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        total: o.base_grand_total || 0,
        currency: o.currency || 'AED',
        created_at: o.creation ? new Date(o.creation) : new Date(),
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
    const doc = await frappeInsertDoc<FrappePurchaseOrder>('Purchase Order', {
      supplier: data.supplier,
      items: data.items.map((i) => ({
        item_code: i.item_code,
        qty: i.qty,
        rate: i.rate,
        amount: i.qty * i.rate,
      })),
    });
    revalidatePath('/erp/procurement');
    return { success: true as const, order: { id: doc.name, po_number: doc.name, supplier_name: data.supplier, status: 'DRAFT', total: 0, currency: 'AED', created_at: new Date() } as ClientSafePurchaseOrder };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create purchase order' };
  }
}

export async function createSupplier(data: {
  supplier_name: string;
  supplier_code?: string;
}) {
  try {
    const doc = await frappeInsertDoc<FrappeSupplier>('Supplier', {
      supplier_name: data.supplier_name,
      name: data.supplier_code || undefined,
    });
    revalidatePath('/erp/procurement');
    return { success: true as const, supplier: { id: doc.name, supplier_name: data.supplier_name, supplier_code: doc.name, email: null, category: null, status: 'Active', created_at: new Date() } as ClientSafeSupplier };
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
    const suppliers = await frappeGetList<FrappeSupplier>('Supplier', {
      filters: { name: data.supplier },
      fields: ['name', 'supplier_name', 'prevent_pos', 'warn_pos', 'disabled'],
      limit_page_length: 1,
    });
    if (suppliers.length === 0) {
      return { success: false, error: `Supplier "${data.supplier}" not found` };
    }
    const supplier = suppliers[0];
    if (supplier.disabled) {
      return { success: false, error: `Supplier "${data.supplier}" is disabled` };
    }
    if (supplier.prevent_pos) {
      return { success: false, error: `Purchase Orders are not allowed for supplier "${data.supplier}"` };
    }
    if (supplier.warn_pos) {
      // Warn but do not block — return as a warning message in error for now
      // In a real UI this would be a warning, here we allow through but log
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
 */
export async function makePurchaseReceipt(
  poId: string
): Promise<{ success: true; purchaseReceipt: FrappePurchaseReceipt } | { success: false; error: string }> {
  try {
    const po = await frappeGetDoc<FrappePurchaseOrder & { items?: FrappePurchaseOrderItem[] }>('Purchase Order', poId);
    if (po.docstatus !== 1) {
      return { success: false, error: 'Purchase Order must be submitted before creating a Purchase Receipt' };
    }

    const items = (po.items || [])
      .map((item) => {
        const pendingQty = item.qty - (item.received_qty || 0);
        return {
          item_code: item.item_code,
          qty: pendingQty,
          rate: item.rate,
          amount: pendingQty * item.rate,
          against_purchase_order: poId,
          purchase_order_item: item.name,
        };
      })
      .filter((item) => item.qty > 0);

    if (items.length === 0) {
      return { success: false, error: 'All items have already been received' };
    }

    const pr = await frappeInsertDoc<FrappePurchaseReceipt>('Purchase Receipt', {
      supplier: po.supplier,
      items,
    });

    revalidatePath('/erp/procurement');
    return { success: true, purchaseReceipt: pr };
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

    const orders = await frappeGetList<FrappePurchaseOrder>('Purchase Order', {
      filters: { supplier, docstatus: 1 },
      fields: ['name', 'base_grand_total'],
      limit_page_length: 500,
    });

    const totalPurchases = orders.reduce((sum, o) => sum + (o.base_grand_total || 0), 0);

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
