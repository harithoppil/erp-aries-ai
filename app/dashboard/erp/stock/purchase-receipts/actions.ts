'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import type { PurchaseReceiptItemRow } from '@/lib/erpnext/types';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafePurchaseReceipt {
  name: string;
  supplier: string;
  supplier_name: string | null;
  posting_date: Date;
  status: string;
  grand_total: number;
  currency: string;
  is_return: boolean;
  docstatus: number;
  company: string;
  creation: Date | null;
}

export interface ClientSafePurchaseReceiptItem {
  name: string;
  item_code: string;
  item_name: string;
  received_qty: number;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  warehouse: string | null;
}

export interface ClientSafePurchaseReceiptDetail extends ClientSafePurchaseReceipt {
  items: ClientSafePurchaseReceiptItem[];
  project: string | null;
  remarks: string | null;
  net_total: number;
  total_taxes_and_charges: number;
}

export interface CreatePurchaseReceiptInput {
  supplier: string;
  posting_date?: string;
  items: { item_code: string; qty: number; rate: number; warehouse?: string }[];
  project?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listPurchaseReceipts(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; receipts: ClientSafePurchaseReceipt[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { supplier: { contains: search, mode: 'insensitive' as const } },
            { supplier_name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [receipts, total] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseReceipt.count({ where }),
    ]);

    return {
      success: true,
      total,
      receipts: receipts.map((r) => ({
        name: r.name,
        supplier: r.supplier,
        supplier_name: r.supplier_name,
        posting_date: r.posting_date,
        status: r.status || 'Draft',
        grand_total: Number(r.grand_total || 0),
        currency: r.currency || 'AED',
        is_return: !!r.is_return,
        docstatus: r.docstatus || 0,
        company: r.company,
        creation: r.creation,
      })),
    };
  } catch (error: any) {
    console.error('[purchase-receipts] listPurchaseReceipts failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch purchase receipts' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getPurchaseReceipt(
  id: string
): Promise<{ success: true; receipt: ClientSafePurchaseReceiptDetail } | { success: false; error: string }> {
  try {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { name: id },
      
    });

    if (!receipt) return { success: false, error: 'Purchase Receipt not found' };

    return {
      success: true,
      receipt: {
        name: receipt.name,
        supplier: receipt.supplier,
        supplier_name: receipt.supplier_name,
        posting_date: receipt.posting_date,
        status: receipt.status || 'Draft',
        grand_total: Number(receipt.grand_total || 0),
        currency: receipt.currency || 'AED',
        is_return: !!receipt.is_return,
        docstatus: receipt.docstatus || 0,
        company: receipt.company,
        creation: receipt.creation,
        project: receipt.project,
        remarks: receipt.remarks,
        net_total: Number(receipt.net_total || 0),
        total_taxes_and_charges: Number(receipt.total_taxes_and_charges || 0),
        items: ((receipt as Record<string, unknown>)?.purchaseReceiptItems as PurchaseReceiptItemRow[] || []).map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          received_qty: i.received_qty,
          qty: i.qty || 0,
          uom: i.uom,
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          warehouse: i.warehouse,
        })),
      },
    };
  } catch (error: any) {
    console.error('[purchase-receipts] getPurchaseReceipt failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch purchase receipt' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createPurchaseReceipt(
  data: CreatePurchaseReceiptInput
): Promise<{ success: true; receipt: ClientSafePurchaseReceipt } | { success: false; error: string }> {
  try {
    if (!data.supplier) return { success: false, error: 'Supplier is required' };
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const total = data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const name = `PR-${Date.now()}`;

    const receipt = await prisma.purchaseReceipt.create({
      data: {
        name,
        naming_series: 'PR-',
        supplier: data.supplier,
        supplier_name: data.supplier,
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        company: 'Aries',
        currency: 'AED',
        conversion_rate: 1,
        status: 'Draft',
        total_qty: data.items.reduce((s, i) => s + i.qty, 0),
        total,
        net_total: total,
        grand_total: total,
        base_total: total,
        base_net_total: total,
        base_grand_total: total,
        project: data.project || null,
        // @ts-expect-error Prisma schema no relation
        purchaseReceiptItems: {
          create: data.items.map((item, idx) => ({
            name: `PRITEM-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Purchase Receipt',
            item_code: item.item_code,
            item_name: item.item_code,
            received_qty: item.qty,
            qty: item.qty,
            uom: 'Nos',
            stock_uom: 'Nos',
            conversion_factor: 1,
            rate: item.rate,
            amount: item.qty * item.rate,
            base_rate: item.rate,
            base_amount: item.qty * item.rate,
            warehouse: item.warehouse || null,
          })),
        },
      },
      
    });

    revalidatePath('/dashboard/erp/stock/purchase-receipts');
    return {
      success: true,
      receipt: {
        name: receipt.name,
        supplier: receipt.supplier,
        supplier_name: receipt.supplier_name,
        posting_date: receipt.posting_date,
        status: receipt.status || 'Draft',
        grand_total: Number(receipt.grand_total || 0),
        currency: receipt.currency || 'AED',
        is_return: !!receipt.is_return,
        docstatus: receipt.docstatus || 0,
        company: receipt.company,
        creation: receipt.creation,
      },
    };
  } catch (error: any) {
    console.error('[purchase-receipts] createPurchaseReceipt failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create purchase receipt' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitPurchaseReceipt(id: string): Promise<SubmitResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Purchase Receipt", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/stock/purchase-receipts');
  return result;
}

export async function cancelPurchaseReceipt(id: string): Promise<CancelResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Purchase Receipt", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/stock/purchase-receipts');
  return result;
}
