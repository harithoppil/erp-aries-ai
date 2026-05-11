'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeDeliveryNote {
  name: string;
  customer: string;
  customer_name: string | null;
  posting_date: Date;
  status: string;
  grand_total: number;
  currency: string;
  is_return: boolean;
  docstatus: number;
  company: string | null;
  creation: Date | null;
}

export interface ClientSafeDeliveryNoteItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  warehouse: string | null;
}

export interface ClientSafeDeliveryNoteDetail extends ClientSafeDeliveryNote {
  items: ClientSafeDeliveryNoteItem[];
  po_no: string | null;
  project: string | null;
  transporter_name: string | null;
  lr_no: string | null;
  shipping_address: string | null;
  instructions: string | null;
  net_total: number;
  total_taxes_and_charges: number;
}

// ── Input types ────────────────────────────────────────────────────────────────

export interface CreateDeliveryNoteInput {
  customer: string;
  posting_date?: string;
  items: { item_code: string; qty: number; rate: number; warehouse?: string }[];
  po_no?: string;
  project?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listDeliveryNotes(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; notes: ClientSafeDeliveryNote[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Delivery Note", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { customer: { contains: search, mode: 'insensitive' as const } },
            { customer_name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [notes, total] = await Promise.all([
      prisma.deliveryNote.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.deliveryNote.count({ where }),
    ]);

    return {
      success: true,
      total,
      notes: notes.map((n) => ({
        name: n.name,
        customer: n.customer,
        customer_name: n.customer_name,
        posting_date: n.posting_date,
        status: n.status || 'Draft',
        grand_total: Number(n.grand_total || 0),
        currency: n.currency || 'AED',
        is_return: !!n.is_return,
        docstatus: n.docstatus || 0,
        company: n.company,
        creation: n.creation,
      })),
    };
  } catch (error) {
    console.error('[delivery-notes] listDeliveryNotes failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch delivery notes') };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getDeliveryNote(
  id: string
): Promise<{ success: true; note: ClientSafeDeliveryNoteDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Delivery Note", "read");
    const [note, noteItems] = await Promise.all([
      prisma.deliveryNote.findUnique({ where: { name: id } }),
      prisma.deliveryNoteItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!note) return { success: false, error: 'Delivery Note not found' };

    return {
      success: true,
      note: {
        name: note.name,
        customer: note.customer,
        customer_name: note.customer_name,
        posting_date: note.posting_date,
        status: note.status || 'Draft',
        grand_total: Number(note.grand_total || 0),
        currency: note.currency || 'AED',
        is_return: !!note.is_return,
        docstatus: note.docstatus || 0,
        company: note.company,
        creation: note.creation,
        po_no: note.po_no,
        project: note.project,
        transporter_name: note.transporter_name,
        lr_no: note.lr_no,
        shipping_address: note.shipping_address,
        instructions: note.instructions,
        net_total: Number(note.net_total || 0),
        total_taxes_and_charges: Number(note.total_taxes_and_charges || 0),
        items: noteItems.map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          qty: i.qty,
          uom: i.uom,
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          warehouse: i.warehouse,
        })),
      },
    };
  } catch (error) {
    console.error('[delivery-notes] getDeliveryNote failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch delivery note') };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createDeliveryNote(
  data: CreateDeliveryNoteInput
): Promise<{ success: true; note: ClientSafeDeliveryNote } | { success: false; error: string }> {
  try {
    await requirePermission("Delivery Note", "create");
    if (!data.customer) return { success: false, error: 'Customer is required' };
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const total = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const namingSeries = 'DN-';

    const dnName = `${namingSeries}${Date.now()}`;
    await prisma.deliveryNote.create({
      data: {
        name: dnName,
        naming_series: namingSeries,
        customer: data.customer,
        customer_name: data.customer,
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        company: 'Aries',
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        status: 'Draft',
        total_qty: data.items.reduce((s, i) => s + i.qty, 0),
        total: total,
        net_total: total,
        grand_total: total,
        base_total: total,
        base_net_total: total,
        base_grand_total: total,
        total_net_weight: 0,
        base_total_taxes_and_charges: 0,
        total_taxes_and_charges: 0,
        base_discount_amount: 0,
        additional_discount_percentage: 0,
        discount_amount: 0,
        base_rounding_adjustment: 0,
        base_rounded_total: total,
        rounding_adjustment: 0,
        rounded_total: total,
        per_billed: 0,
        per_installed: 0,
        commission_rate: 0,
        total_commission: 0,
        per_returned: 0,
        amount_eligible_for_commission: 0,
        po_no: data.po_no || null,
        project: data.project || null,
      },
    });
    // Create child items separately
    await prisma.deliveryNoteItem.createMany({
      data: data.items.map((item, idx) => ({
        name: `DNITEM-${Date.now()}-${idx}`,
        idx,
        parent: dnName,
        parentfield: 'items',
        parenttype: 'Delivery Note',
        item_code: item.item_code,
        item_name: item.item_code,
        qty: item.qty,
        uom: 'Nos',
        stock_uom: 'Nos',
        conversion_factor: 1,
        stock_qty: item.qty,
        price_list_rate: item.rate,
        base_price_list_rate: item.rate,
        margin_rate_or_amount: 0,
        rate_with_margin: item.rate,
        discount_percentage: 0,
        discount_amount: 0,
        base_rate_with_margin: item.rate,
        rate: item.rate,
        amount: item.qty * item.rate,
        base_rate: item.rate,
        base_amount: item.qty * item.rate,
        net_rate: item.rate,
        net_amount: item.qty * item.rate,
        base_net_rate: item.rate,
        base_net_amount: item.qty * item.rate,
        weight_per_unit: 0,
        total_weight: 0,
        actual_qty: 0,
        actual_batch_qty: 0,
        installed_qty: 0,
        billed_amt: 0,
        returned_qty: 0,
        incoming_rate: 0,
        stock_uom_rate: item.rate,
        received_qty: 0,
        distributed_discount_amount: 0,
        company_total_stock: 0,
        warehouse: item.warehouse || null,
      })),
    });
    const note = await prisma.deliveryNote.findUnique({ where: { name: dnName } });
    if (!note) return { success: false, error: 'Failed to create delivery note' };

    revalidatePath('/dashboard/erp/stock/delivery-notes');
    return {
      success: true,
      note: {
        name: note.name,
        customer: note.customer,
        customer_name: note.customer_name,
        posting_date: note.posting_date,
        status: note.status || 'Draft',
        grand_total: Number(note.grand_total || 0),
        currency: note.currency || 'AED',
        is_return: !!note.is_return,
        docstatus: note.docstatus || 0,
        company: note.company,
        creation: note.creation,
      },
    };
  } catch (error) {
    console.error('[delivery-notes] createDeliveryNote failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create delivery note') };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitDeliveryNote(
  id: string
): Promise<SubmitResult> {
  await requirePermission("Delivery Note", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Delivery Note", id, { token });
  if (result.success) {
    revalidatePath('/dashboard/erp/stock/delivery-notes');
    revalidatePath(`/dashboard/erp/stock/delivery-notes/${id}`);
  }
  return result;
}

export async function cancelDeliveryNote(
  id: string
): Promise<CancelResult> {
  await requirePermission("Delivery Note", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Delivery Note", id, { token });
  if (result.success) {
    revalidatePath('/dashboard/erp/stock/delivery-notes');
    revalidatePath(`/dashboard/erp/stock/delivery-notes/${id}`);
  }
  return result;
}
