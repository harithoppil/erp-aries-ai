'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSupplier = {
  id: string;
  supplier_name: string;
  supplier_code: string;
  email: string | null;
  category: string | null;
  status: string;
  created_at: Date | null;
};

export type ClientSafePurchaseOrder = {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  total: number;
  currency: string;
  created_at: Date | null;
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

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Purchase Order", "read");
    const suppliers = await prisma.supplier.findMany({
      orderBy: { creation: 'desc' },
      take: 500,
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
        created_at: s.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching suppliers:', msg);
    return { success: false, error: msg || 'Failed to fetch suppliers' };
  }
}

export async function listPurchaseOrders(): Promise<
  { success: true; orders: ClientSafePurchaseOrder[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Purchase Order", "read");
    const orders = await prisma.purchaseOrder.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.name,
        po_number: o.name,
        supplier_name: o.supplier_name || 'Unknown',
        status: o.docstatus === 1 ? 'Submitted' : o.docstatus === 2 ? 'Cancelled' : 'Draft',
        total: Number(o.total || 0),
        currency: o.currency || 'AED',
        created_at: o.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching purchase orders:', msg);
    return { success: false, error: msg || 'Failed to fetch purchase orders' };
  }
}

export async function createPurchaseOrder(data: {
  supplier: string;
  items: { item_code: string; qty: number; rate: number }[];
}) {
  try {
    await requirePermission("Purchase Order", "create");
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: data.supplier },
          { supplier_name: data.supplier },
        ],
      },
    });

    if (!supplier) {
      return { success: false as const, error: `Supplier "${data.supplier}" not found` };
    }

    const name = `PO-${Date.now()}`;
    const subtotal = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const total = subtotal;

    const order = await prisma.purchaseOrder.create({
      data: {
        name,
        supplier: supplier.name,
        supplier_name: supplier.supplier_name,
        company: 'Aries',
        transaction_date: new Date(),
        currency: 'AED',
        conversion_rate: 1,
        total: subtotal,
        net_total: subtotal,
        base_total: subtotal,
        base_net_total: subtotal,
        grand_total: total,
        base_grand_total: total,
        status: 'Draft',
        naming_series: 'PO-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // Create child PO items
    for (const item of data.items) {
      await prisma.purchaseOrderItem.create({
        data: {
          name: `POI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: name,
          parentfield: 'items',
          parenttype: 'Purchase Order',
          item_code: item.item_code,
          item_name: item.item_code,
          qty: item.qty,
          uom: 'Nos',
          conversion_factor: 1,
          stock_uom: 'Nos',
          rate: item.rate,
          amount: item.qty * item.rate,
          base_rate: item.rate,
          base_amount: item.qty * item.rate,
          schedule_date: new Date(),
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    }

    revalidatePath('/erp/procurement');
    return {
      success: true as const,
      order: {
        id: order.name,
        po_number: order.name,
        supplier_name: order.supplier_name || data.supplier,
        status: 'Draft',
        total: Number(order.total || 0),
        currency: order.currency || 'AED',
        created_at: order.creation,
      } as ClientSafePurchaseOrder,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create purchase order' };
  }
}

export async function createSupplier(data: {
  supplier_name: string;
  supplier_code?: string;
}) {
  try {
    await requirePermission("Purchase Order", "create");
    const name = data.supplier_code || `SUP-${Date.now()}`;
    const supplier = await prisma.supplier.create({
      data: {
        name,
        supplier_name: data.supplier_name,
        supplier_type: 'Company',
        supplier_group: 'All Suppliers',
        disabled: false,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    revalidatePath('/erp/procurement');
    return {
      success: true as const,
      supplier: {
        id: supplier.name,
        supplier_name: supplier.supplier_name,
        supplier_code: supplier.name,
        email: supplier.email_id || null,
        category: supplier.supplier_group || null,
        status: supplier.disabled ? 'Inactive' : 'Active',
        created_at: supplier.creation,
      } as ClientSafeSupplier,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create supplier' };
  }
}

// ── Submit / Cancel ─────────────────────────────────────────────────────────

export async function submitPurchaseOrder(id: string): Promise<SubmitResult> {
  await requirePermission("Purchase Order", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Purchase Order", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/procurement');
  return result;
}

export async function cancelPurchaseOrder(id: string): Promise<CancelResult> {
  await requirePermission("Purchase Order", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Purchase Order", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/procurement');
  return result;
}

// ── Validation & Business Logic ─────────────────────────────────────────────

export async function validatePurchaseOrder(
  data: PurchaseOrderValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Order", "read");
    if (!data.supplier || data.supplier.trim().length === 0) {
      return { success: false, error: 'Supplier is required' };
    }
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: data.supplier },
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

    if (data.schedule_date && data.transaction_date) {
      const scheduleDate = new Date(data.schedule_date);
      const transactionDate = new Date(data.transaction_date);
      if (scheduleDate < transactionDate) {
        return { success: false, error: 'Schedule Date cannot be before Transaction Date' };
      }
    }

    for (const item of data.items) {
      if (!item.schedule_date && !data.schedule_date) {
        return { success: false, error: `Item "${item.item_code}" is missing a schedule date` };
      }
    }

    return { success: true, valid: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[procurement] validatePurchaseOrder failed:', msg);
    return { success: false, error: msg || 'Purchase Order validation failed' };
  }
}

export async function makePurchaseReceipt(
  poId: string
): Promise<{ success: true; purchaseReceipt: FrappePurchaseReceipt } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Order", "create");
    const po = await prisma.purchaseOrder.findUnique({
      where: { name: poId },
    });
    if (!po) {
      return { success: false, error: 'Purchase Order not found' };
    }
    if (po.docstatus !== 1) {
      return { success: false, error: 'Purchase Order must be submitted before creating a Purchase Receipt' };
    }

    return { success: false, error: 'Purchase Receipt creation is not supported with Prisma backend' };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[procurement] makePurchaseReceipt failed:', msg);
    return { success: false, error: msg || 'Failed to create Purchase Receipt' };
  }
}

export async function getSupplierTotalPurchases(
  supplier: string
): Promise<{ success: true; totalPurchases: number; orderCount: number } | { success: false; error: string }> {
  try {
    await requirePermission("Purchase Order", "read");
    if (!supplier || supplier.trim().length === 0) {
      return { success: false, error: 'Supplier is required' };
    }

    const supplierRecord = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: supplier },
          { supplier_name: supplier },
        ],
      },
    });

    if (!supplierRecord) {
      return { success: false, error: `Supplier "${supplier}" not found` };
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        supplier: supplierRecord.name,
        docstatus: 1,
      },
      select: {
        grand_total: true,
      },
    });

    const totalPurchases = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

    return {
      success: true,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      orderCount: orders.length,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[procurement] getSupplierTotalPurchases failed:', msg);
    return { success: false, error: msg || 'Failed to get supplier total purchases' };
  }
}
