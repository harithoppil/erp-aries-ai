'use server';

import { revalidatePath } from 'next/cache';
import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
  frappeCallMethod,
  frappeSubmitDoc,
} from '@/lib/frappe-client';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSalesOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  project_type: string | null;
  delivery_date: Date | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: Date;
};

export interface SalesOrderItemInput {
  description: string;
  quantity: number;
  rate: number;
  item_code?: string;
}

export interface SalesOrderValidateInput {
  customer: string;
  delivery_date?: string;
  items: SalesOrderItemInput[];
  grand_total?: number;
}

export interface FrappeSalesOrder {
  name: string;
  customer: string;
  project?: string;
  delivery_date?: string;
  status?: string;
  docstatus: number;
  base_net_total?: number;
  total_taxes_and_charges?: number;
  base_grand_total?: number;
  currency?: string;
  terms?: string;
  creation?: string;
  per_delivered?: number;
  per_billed?: number;
  delivery_status?: string;
  billing_status?: string;
}

export interface FrappeSalesOrderItem {
  item_code: string;
  description?: string;
  qty: number;
  rate: number;
  amount?: number;
  delivered_qty?: number;
}

export interface FrappeCustomer {
  name: string;
  customer_name: string;
  credit_limit?: number;
}

export interface FrappeDeliveryNote {
  name: string;
}

export interface FrappeSalesInvoice {
  name: string;
  outstanding_amount?: number;
  customer?: string;
}

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listSalesOrders(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; orders: ClientSafeSalesOrder[] } | { success: false; error: string }
> {
  try {
    const filters: Record<string, unknown> = {};
    if (params?.status) {
      filters.status = params.status;
    }
    const orders = await frappeGetList<FrappeSalesOrder>('Sales Order', {
      fields: ['name', 'customer', 'project', 'delivery_date', 'status', 'docstatus', 'base_net_total', 'total_taxes_and_charges', 'base_grand_total', 'currency', 'terms', 'creation'],
      filters,
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.name,
        order_number: o.name,
        customer_name: o.customer || 'Unknown',
        project_type: o.project || null,
        delivery_date: o.delivery_date ? new Date(o.delivery_date) : null,
        status: o.docstatus === 1 ? 'SUBMITTED' : o.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        subtotal: o.base_net_total || 0,
        tax_rate: 5,
        tax_amount: o.total_taxes_and_charges || 0,
        total: o.base_grand_total || 0,
        currency: o.currency || 'AED',
        notes: o.terms || null,
        created_at: o.creation ? new Date(o.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching sales orders:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch sales orders' };
  }
}

export async function createSalesOrder(data: {
  customer_id?: string;
  customer_name: string;
  project_type?: string;
  quotation_id?: string;
  delivery_date?: Date;
  tax_rate?: number;
  notes?: string;
  items: SalesOrderItemInput[];
}) {
  try {
    const items = data.items.map((item) => ({
      item_code: item.item_code || 'Services',
      description: item.description,
      qty: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;

    const order = await frappeInsertDoc<FrappeSalesOrder>('Sales Order', {
      customer: data.customer_name,
      project: data.project_type || undefined,
      delivery_date: data.delivery_date ? data.delivery_date.toISOString().slice(0, 10) : undefined,
      items,
      taxes: [{
        charge_type: 'On Net Total',
        account_head: 'VAT 5% - AM',
        description: 'VAT 5%',
        rate: taxRate,
        tax_amount: taxAmount,
        total,
      }],
      terms: data.notes || undefined,
    });

    revalidatePath('/erp/sales-orders');
    return {
      success: true as const,
      order: {
        id: order.name,
        order_number: order.name,
        customer_name: data.customer_name,
        project_type: data.project_type || null,
        delivery_date: data.delivery_date || null,
        status: 'DRAFT',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: 'AED',
        notes: data.notes || null,
        created_at: new Date(),
      } as ClientSafeSalesOrder,
    };
  } catch (error: any) {
    console.error('Error creating sales order:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create sales order' };
  }
}

export async function updateSalesOrderStatus(id: string, status: string) {
  try {
    if (status === 'CANCELLED') {
      await frappeCallMethod('frappe.client.cancel', { doctype: 'Sales Order', name: id });
    } else {
      await frappeUpdateDoc('Sales Order', id, { status });
    }
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] updateSalesOrderStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update sales order status' };
  }
}

export async function updateSalesOrder(
  id: string,
  data: Partial<{ customer_name: string; project_type: string; delivery_date: Date; tax_rate: number; notes: string }>
) {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.customer_name !== undefined) updateData.customer = data.customer_name;
    if (data.project_type !== undefined) updateData.project = data.project_type;
    if (data.delivery_date !== undefined) updateData.delivery_date = data.delivery_date.toISOString().slice(0, 10);
    if (data.notes !== undefined) updateData.terms = data.notes;
    await frappeUpdateDoc('Sales Order', id, updateData);
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] updateSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update sales order' };
  }
}

export async function deleteSalesOrder(id: string) {
  try {
    await frappeCallMethod('frappe.client.cancel', { doctype: 'Sales Order', name: id });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] deleteSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete sales order' };
  }
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate a Sales Order before submission.
 * Checks: customer exists, items present, delivery_date after transaction_date,
 * credit limit against outstanding + order total.
 */
export async function validateSalesOrder(
  data: SalesOrderValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    // 1. Customer must exist
    if (!data.customer || data.customer.trim().length === 0) {
      return { success: false, error: 'Customer is required' };
    }
    const customers = await frappeGetList<FrappeCustomer>('Customer', {
      filters: { customer_name: data.customer },
      fields: ['name', 'customer_name', 'credit_limit'],
      limit_page_length: 1,
    });
    if (customers.length === 0) {
      return { success: false, error: `Customer "${data.customer}" not found` };
    }

    // 2. Items must not be empty
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }
    for (const item of data.items) {
      if (!item.description || item.description.trim().length === 0) {
        return { success: false, error: 'Item description is required for all items' };
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return { success: false, error: `Item "${item.description}" must have quantity > 0` };
      }
      if (typeof item.rate !== 'number' || item.rate < 0) {
        return { success: false, error: `Item "${item.description}" must have a valid rate` };
      }
    }

    // 3. Delivery date must be present and in the future
    if (!data.delivery_date) {
      return { success: false, error: 'Delivery Date is required' };
    }
    const deliveryDate = new Date(data.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      return { success: false, error: 'Expected Delivery Date should be after Sales Order Date' };
    }

    // 4. Credit limit check
    const customer = customers[0];
    const creditLimit = customer.credit_limit || 0;
    if (creditLimit > 0 && data.grand_total !== undefined) {
      const outstandingInvoices = await frappeGetList<FrappeSalesInvoice>('Sales Invoice', {
        filters: { customer: data.customer, outstanding_amount: ['>', 0], docstatus: 1 },
        fields: ['outstanding_amount'],
      });
      const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
      const projectedOutstanding = totalOutstanding + data.grand_total;
      if (projectedOutstanding > creditLimit) {
        return {
          success: false,
          error: `Credit limit has been crossed for customer ${data.customer} (${projectedOutstanding.toFixed(2)}/${creditLimit.toFixed(2)})`,
        };
      }
    }

    return { success: true, valid: true };
  } catch (error: any) {
    console.error('[sales-orders] validateSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Validation failed' };
  }
}

/**
 * Create a Delivery Note from a submitted Sales Order.
 */
export async function makeDeliveryNote(
  salesOrderId: string
): Promise<{ success: true; deliveryNote: FrappeDeliveryNote } | { success: false; error: string }> {
  try {
    const so = await frappeGetDoc<FrappeSalesOrder & { items?: FrappeSalesOrderItem[] }>('Sales Order', salesOrderId);
    if (so.docstatus !== 1) {
      return { success: false, error: 'Sales Order must be submitted before creating a Delivery Note' };
    }

    const items = (so.items || []).map((item) => ({
      item_code: item.item_code,
      description: item.description || '',
      qty: item.qty - (item.delivered_qty || 0),
      rate: item.rate,
      against_sales_order: salesOrderId,
      so_detail: item.item_code,
    })).filter((item) => item.qty > 0);

    if (items.length === 0) {
      return { success: false, error: 'All items have already been delivered' };
    }

    const dn = await frappeInsertDoc<FrappeDeliveryNote>('Delivery Note', {
      customer: so.customer,
      items,
    });

    revalidatePath('/erp/sales-orders');
    return { success: true, deliveryNote: dn };
  } catch (error: any) {
    console.error('[sales-orders] makeDeliveryNote failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create Delivery Note' };
  }
}

/**
 * Compute the effective status of a Sales Order from delivered/billed percentages.
 */
export async function getSalesOrderStatus(
  soId: string
): Promise<
  | { success: true; status: string; deliveryStatus: string; billingStatus: string; perDelivered: number; perBilled: number }
  | { success: false; error: string }
> {
  try {
    const so = await frappeGetDoc<FrappeSalesOrder>('Sales Order', soId);
    const perDelivered = so.per_delivered || 0;
    const perBilled = so.per_billed || 0;
    const deliveryStatus = so.delivery_status || 'Not Delivered';
    const billingStatus = so.billing_status || 'Not Billed';

    let computedStatus = so.status || 'Draft';
    if (so.docstatus === 1) {
      if (deliveryStatus === 'Closed' || so.status === 'Closed') {
        computedStatus = 'Closed';
      } else if (perDelivered >= 100 && perBilled >= 100) {
        computedStatus = 'Completed';
      } else if (perDelivered < 100 && perBilled < 100) {
        computedStatus = 'To Deliver and Bill';
      } else if (perDelivered < 100 && perBilled >= 100) {
        computedStatus = 'To Deliver';
      } else if (perDelivered >= 100 && perBilled < 100) {
        computedStatus = 'To Bill';
      }
    } else if (so.docstatus === 2) {
      computedStatus = 'Cancelled';
    }

    return {
      success: true,
      status: computedStatus,
      deliveryStatus,
      billingStatus,
      perDelivered,
      perBilled,
    };
  } catch (error: any) {
    console.error('[sales-orders] getSalesOrderStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get sales order status' };
  }
}
