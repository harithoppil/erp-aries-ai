'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import type { StockEntryDetailRow } from '@/lib/erpnext/types';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeStockEntry {
  name: string;
  stock_entry_type: string;
  purpose: string | null;
  posting_date: Date | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  total_incoming_value: number;
  total_outgoing_value: number;
  value_difference: number;
  docstatus: number;
  company: string;
  work_order: string | null;
  remarks: string | null;
  creation: Date | null;
}

export interface ClientSafeStockEntryDetailItem {
  name: string;
  item_code: string;
  item_name: string | null;
  qty: number;
  uom: string;
  basic_rate: number;
  basic_amount: number;
  s_warehouse: string | null;
  t_warehouse: string | null;
  serial_no: string | null;
  batch_no: string | null;
}

export interface ClientSafeStockEntryDetail extends ClientSafeStockEntry {
  items: ClientSafeStockEntryDetailItem[];
}

export interface CreateStockEntryInput {
  stock_entry_type: string;
  from_warehouse?: string;
  to_warehouse?: string;
  items: { item_code: string; qty: number; s_warehouse?: string; t_warehouse?: string }[];
  work_order?: string;
  remarks?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listStockEntries(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; entries: ClientSafeStockEntry[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Stock Entry", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { stock_entry_type: { contains: search, mode: 'insensitive' as const } },
            { from_warehouse: { contains: search, mode: 'insensitive' as const } },
            { to_warehouse: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return {
      success: true,
      total,
      entries: entries.map((e) => ({
        name: e.name,
        stock_entry_type: e.stock_entry_type,
        purpose: e.purpose,
        posting_date: e.posting_date,
        from_warehouse: e.from_warehouse,
        to_warehouse: e.to_warehouse,
        total_incoming_value: Number(e.total_incoming_value || 0),
        total_outgoing_value: Number(e.total_outgoing_value || 0),
        value_difference: Number(e.value_difference || 0),
        docstatus: e.docstatus || 0,
        company: e.company,
        work_order: e.work_order,
        remarks: e.remarks,
        creation: e.creation,
      })),
    };
  } catch (error: any) {
    console.error('[stock-entries] listStockEntries failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock entries' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getStockEntry(
  id: string
): Promise<{ success: true; entry: ClientSafeStockEntryDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Stock Entry", "read");
    const entry = await prisma.stockEntry.findUnique({
      where: { name: id },
      
    });

    if (!entry) return { success: false, error: 'Stock Entry not found' };

    return {
      success: true,
      entry: {
        name: entry.name,
        stock_entry_type: entry.stock_entry_type,
        purpose: entry.purpose,
        posting_date: entry.posting_date,
        from_warehouse: entry.from_warehouse,
        to_warehouse: entry.to_warehouse,
        total_incoming_value: Number(entry.total_incoming_value || 0),
        total_outgoing_value: Number(entry.total_outgoing_value || 0),
        value_difference: Number(entry.value_difference || 0),
        docstatus: entry.docstatus || 0,
        company: entry.company,
        work_order: entry.work_order,
        remarks: entry.remarks,
        creation: entry.creation,
        items: ((entry as Record<string, unknown>)?.stockEntryDetails as StockEntryDetailRow[] || []).map((d) => ({
          name: d.name,
          item_code: d.item_code,
          item_name: d.item_name,
          qty: d.qty,
          uom: d.uom,
          basic_rate: Number(d.basic_rate || 0),
          basic_amount: Number(d.basic_amount || 0),
          s_warehouse: d.s_warehouse,
          t_warehouse: d.t_warehouse,
          serial_no: d.serial_no,
          batch_no: d.batch_no,
        })),
      },
    };
  } catch (error: any) {
    console.error('[stock-entries] getStockEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock entry' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createStockEntry(
  data: CreateStockEntryInput
): Promise<{ success: true; entry: ClientSafeStockEntry } | { success: false; error: string }> {
  try {
    await requirePermission("Stock Entry", "create");
    if (!data.stock_entry_type) return { success: false, error: 'Stock Entry Type is required' };
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const name = `STE-${Date.now()}`;
    const totalValue = data.items.reduce((sum, i) => sum + i.qty * 0, 0); // rate comes from valuation

    const entry = await prisma.stockEntry.create({
      data: {
        name,
        naming_series: 'STE-',
        stock_entry_type: data.stock_entry_type,
        purpose: data.stock_entry_type,
        company: 'Aries',
        posting_date: new Date(),
        from_warehouse: data.from_warehouse || null,
        to_warehouse: data.to_warehouse || null,
        total_amount: totalValue,
        total_incoming_value: 0,
        total_outgoing_value: 0,
        value_difference: 0,
        work_order: data.work_order || null,
        remarks: data.remarks || null,
        // @ts-expect-error Prisma schema no relation
        stockEntryDetails: {
          create: data.items.map((item, idx) => ({
            name: `STED-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Stock Entry',
            item_code: item.item_code,
            item_name: item.item_code,
            qty: item.qty,
            uom: 'Nos',
            stock_uom: 'Nos',
            conversion_factor: 1,
            s_warehouse: item.s_warehouse || null,
            t_warehouse: item.t_warehouse || null,
          })),
        },
      },
      
    });

    revalidatePath('/dashboard/erp/stock/entries');
    return {
      success: true,
      entry: {
        name: entry.name,
        stock_entry_type: entry.stock_entry_type,
        purpose: entry.purpose,
        posting_date: entry.posting_date,
        from_warehouse: entry.from_warehouse,
        to_warehouse: entry.to_warehouse,
        total_incoming_value: Number(entry.total_incoming_value || 0),
        total_outgoing_value: Number(entry.total_outgoing_value || 0),
        value_difference: Number(entry.value_difference || 0),
        docstatus: entry.docstatus || 0,
        company: entry.company,
        work_order: entry.work_order,
        remarks: entry.remarks,
        creation: entry.creation,
      },
    };
  } catch (error: any) {
    console.error('[stock-entries] createStockEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create stock entry' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitStockEntry(id: string): Promise<SubmitResult> {
  await requirePermission("Stock Entry", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Stock Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/stock/entries');
  return result;
}

export async function cancelStockEntry(id: string): Promise<CancelResult> {
  await requirePermission("Stock Entry", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Stock Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/stock/entries');
  return result;
}
