'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeWorkOrder {
  name: string;
  production_item: string;
  item_name: string | null;
  bom_no: string;
  status: string;
  qty: number;
  produced_qty: number;
  company: string;
  planned_start_date: Date;
  actual_start_date: Date | null;
  planned_end_date: Date | null;
  fg_warehouse: string | null;
  wip_warehouse: string | null;
  sales_order: string | null;
  project: string | null;
  total_operating_cost: number;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeWorkOrderItem {
  name: string;
  item_code: string | null;
  item_name: string | null;
  source_warehouse: string | null;
  required_qty: number;
  transferred_qty: number;
  consumed_qty: number;
}

export interface ClientSafeWorkOrderOperation {
  name: string;
  operation: string;
  workstation: string | null;
  time_in_mins: number;
  status: string | null;
  completed_qty: number | null;
  planned_start_time: Date | null;
  planned_end_time: Date | null;
}

export interface ClientSafeWorkOrderDetail extends ClientSafeWorkOrder {
  required_items: ClientSafeWorkOrderItem[];
  operations: ClientSafeWorkOrderOperation[];
  description: string | null;
  stock_uom: string | null;
}

export interface CreateWorkOrderInput {
  production_item: string;
  bom_no: string;
  qty: number;
  fg_warehouse?: string;
  wip_warehouse?: string;
  planned_start_date?: string;
  sales_order?: string;
  project?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listWorkOrders(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; orders: ClientSafeWorkOrder[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { production_item: { contains: search, mode: 'insensitive' as const } },
            { item_name: { contains: search, mode: 'insensitive' as const } },
            { bom_no: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [orders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return {
      success: true,
      total,
      orders: orders.map((o) => ({
        name: o.name,
        production_item: o.production_item,
        item_name: o.item_name,
        bom_no: o.bom_no,
        status: o.status || 'Draft',
        qty: o.qty,
        produced_qty: o.produced_qty || 0,
        company: o.company,
        planned_start_date: o.planned_start_date,
        actual_start_date: o.actual_start_date,
        planned_end_date: o.planned_end_date,
        fg_warehouse: o.fg_warehouse,
        wip_warehouse: o.wip_warehouse,
        sales_order: o.sales_order,
        project: o.project,
        total_operating_cost: Number(o.total_operating_cost || 0),
        docstatus: o.docstatus || 0,
        creation: o.creation,
      })),
    };
  } catch (error: any) {
    console.error('[work-orders] listWorkOrders failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch work orders' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getWorkOrder(
  id: string
): Promise<{ success: true; order: ClientSafeWorkOrderDetail } | { success: false; error: string }> {
  try {
    const order = await prisma.workOrder.findUnique({
      where: { name: id },
      // @ts-ignore Prisma schema missing relation definition for workOrderItems/workOrderOperations
      include: {
        workOrderItems: { orderBy: { idx: 'asc' } },
        workOrderOperations: { orderBy: { idx: 'asc' } },
      },
    });

    if (!order) return { success: false, error: 'Work Order not found' };

    return {
      success: true,
      order: {
        name: order.name,
        production_item: order.production_item,
        item_name: order.item_name,
        bom_no: order.bom_no,
        status: order.status || 'Draft',
        qty: order.qty,
        produced_qty: order.produced_qty || 0,
        company: order.company,
        planned_start_date: order.planned_start_date,
        actual_start_date: order.actual_start_date,
        planned_end_date: order.planned_end_date,
        fg_warehouse: order.fg_warehouse,
        wip_warehouse: order.wip_warehouse,
        sales_order: order.sales_order,
        project: order.project,
        total_operating_cost: Number(order.total_operating_cost || 0),
        docstatus: order.docstatus || 0,
        creation: order.creation,
        description: order.description,
        stock_uom: order.stock_uom,
        required_items: ((order as Record<string, unknown>).workOrderItems as { name: string; item_code: string; item_name: string; source_warehouse: string | null; required_qty: number; transferred_qty: number; consumed_qty: number }[] || []).map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          source_warehouse: i.source_warehouse,
          required_qty: i.required_qty || 0,
          transferred_qty: i.transferred_qty || 0,
          consumed_qty: i.consumed_qty || 0,
        })),
        operations: ((order as Record<string, unknown>).workOrderOperations as { name: string; operation: string; workstation: string; time_in_mins: number; status: string; completed_qty: number; planned_start_time: Date | null; planned_end_time: Date | null }[] || []).map((o) => ({
          name: o.name,
          operation: o.operation,
          workstation: o.workstation,
          time_in_mins: o.time_in_mins,
          status: o.status,
          completed_qty: o.completed_qty,
          planned_start_time: o.planned_start_time,
          planned_end_time: o.planned_end_time,
        })),
      },
    };
  } catch (error: any) {
    console.error('[work-orders] getWorkOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch work order' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createWorkOrder(
  data: CreateWorkOrderInput
): Promise<{ success: true; order: ClientSafeWorkOrder } | { success: false; error: string }> {
  try {
    if (!data.production_item) return { success: false, error: 'Production Item is required' };
    if (!data.bom_no) return { success: false, error: 'BOM No is required' };
    if (!data.qty || data.qty <= 0) return { success: false, error: 'Qty must be positive' };

    const name = `WO-${Date.now()}`;
    const order = await prisma.workOrder.create({
      data: {
        name,
        naming_series: 'WO-',
        production_item: data.production_item,
        item_name: data.production_item,
        bom_no: data.bom_no,
        qty: data.qty,
        status: 'Draft',
        company: 'Aries',
        planned_start_date: data.planned_start_date ? new Date(data.planned_start_date) : new Date(),
        fg_warehouse: data.fg_warehouse || null,
        wip_warehouse: data.wip_warehouse || null,
        sales_order: data.sales_order || null,
        project: data.project || null,
        material_transferred_for_manufacturing: 0,
        produced_qty: 0,
      },
    });

    revalidatePath('/dashboard/erp/manufacturing/work-orders');
    return {
      success: true,
      order: {
        name: order.name,
        production_item: order.production_item,
        item_name: order.item_name,
        bom_no: order.bom_no,
        status: order.status || 'Draft',
        qty: order.qty,
        produced_qty: order.produced_qty || 0,
        company: order.company,
        planned_start_date: order.planned_start_date,
        actual_start_date: order.actual_start_date,
        planned_end_date: order.planned_end_date,
        fg_warehouse: order.fg_warehouse,
        wip_warehouse: order.wip_warehouse,
        sales_order: order.sales_order,
        project: order.project,
        total_operating_cost: Number(order.total_operating_cost || 0),
        docstatus: order.docstatus || 0,
        creation: order.creation,
      },
    };
  } catch (error: any) {
    console.error('[work-orders] createWorkOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create work order' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitWorkOrder(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const o = await prisma.workOrder.findUnique({ where: { name: id } });
    if (!o) return { success: false, error: 'Not found' };
    if (o.docstatus !== 0) return { success: false, error: 'Only draft documents can be submitted' };
    await prisma.workOrder.update({ where: { name: id }, data: { docstatus: 1, status: 'Not Started' } });
    revalidatePath('/dashboard/erp/manufacturing/work-orders');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to submit' };
  }
}

export async function cancelWorkOrder(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const o = await prisma.workOrder.findUnique({ where: { name: id } });
    if (!o) return { success: false, error: 'Not found' };
    if (o.docstatus !== 1) return { success: false, error: 'Only submitted documents can be cancelled' };
    await prisma.workOrder.update({ where: { name: id }, data: { docstatus: 2, status: 'Cancelled' } });
    revalidatePath('/dashboard/erp/manufacturing/work-orders');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to cancel' };
  }
}
