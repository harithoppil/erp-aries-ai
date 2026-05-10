'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeRFQ {
  name: string;
  company: string;
  transaction_date: Date;
  status: string;
  schedule_date: Date | null;
  message_for_supplier: string | null;
  opportunity: string | null;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeRFQItem {
  name: string;
  item_code: string;
  item_name: string | null;
  qty: number;
  uom: string;
  schedule_date: Date;
  warehouse: string | null;
}

export interface ClientSafeRFQSupplier {
  name: string;
  supplier: string;
  supplier_name: string | null;
  quote_status: string | null;
  email_id: string | null;
}

export interface ClientSafeRFQDetail extends ClientSafeRFQ {
  items: ClientSafeRFQItem[];
  suppliers: ClientSafeRFQSupplier[];
}

export interface CreateRFQInput {
  items: { item_code: string; qty: number; uom?: string; schedule_date?: string }[];
  suppliers?: { supplier: string }[];
  schedule_date?: string;
  opportunity?: string;
  message_for_supplier?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listRFQs(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; rfqs: ClientSafeRFQ[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Supplier", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
            { opportunity: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rfqs, total] = await Promise.all([
      prisma.requestForQuotation.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.requestForQuotation.count({ where }),
    ]);

    return {
      success: true,
      total,
      rfqs: rfqs.map((r) => ({
        name: r.name,
        company: r.company,
        transaction_date: r.transaction_date,
        status: r.status || 'Draft',
        schedule_date: r.schedule_date,
        message_for_supplier: r.message_for_supplier,
        opportunity: r.opportunity,
        docstatus: r.docstatus || 0,
        creation: r.creation,
      })),
    };
  } catch (error) {
    console.error('[rfq] listRFQs failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch RFQs') };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getRFQ(
  id: string
): Promise<{ success: true; rfq: ClientSafeRFQDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Supplier", "read");
    const [rfq, rfqItems, rfqSuppliers] = await Promise.all([
      prisma.requestForQuotation.findUnique({ where: { name: id } }),
      prisma.requestForQuotationItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
      prisma.requestForQuotationSupplier.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!rfq) return { success: false, error: 'RFQ not found' };

    return {
      success: true,
      rfq: {
        name: rfq.name,
        company: rfq.company,
        transaction_date: rfq.transaction_date,
        status: rfq.status || 'Draft',
        schedule_date: rfq.schedule_date,
        message_for_supplier: rfq.message_for_supplier,
        opportunity: rfq.opportunity,
        docstatus: rfq.docstatus || 0,
        creation: rfq.creation,
        items: rfqItems.map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          qty: i.qty,
          uom: i.uom,
          schedule_date: i.schedule_date,
          warehouse: i.warehouse,
        })),
        suppliers: rfqSuppliers.map((s) => ({
          name: s.name,
          supplier: s.supplier,
          supplier_name: s.supplier_name,
          quote_status: s.quote_status,
          email_id: s.email_id,
        })),
      },
    };
  } catch (error) {
    console.error('[rfq] getRFQ failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch RFQ') };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createRFQ(
  data: CreateRFQInput
): Promise<{ success: true; rfq: ClientSafeRFQ } | { success: false; error: string }> {
  try {
    await requirePermission("Supplier", "create");
    if (!data.items || data.items.length === 0) return { success: false, error: 'At least one item is required' };

    const name = `RFQ-${Date.now()}`;
    const scheduleDate = data.schedule_date ? new Date(data.schedule_date) : new Date();

    const rfq = await prisma.requestForQuotation.create({
      data: {
        name,
        naming_series: 'RFQ-',
        company: 'Aries',
        transaction_date: new Date(),
        status: 'Draft',
        schedule_date: scheduleDate,
        message_for_supplier: data.message_for_supplier || 'Please supply the specified items at the best possible rates',
        subject: 'Request for Quotation',
        opportunity: data.opportunity || null,
        // @ts-expect-error
        requestForQuotationItems: {
          create: data.items.map((item, idx) => ({
            name: `RFQITEM-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Request for Quotation',
            item_code: item.item_code,
            qty: item.qty,
            uom: item.uom || 'Nos',
            stock_uom: item.uom || 'Nos',
            conversion_factor: 1,
            schedule_date: item.schedule_date ? new Date(item.schedule_date) : scheduleDate,
          })),
        },
        requestForQuotationSuppliers: data.suppliers ? {
          create: data.suppliers.map((s, idx) => ({
            name: `RFQSUP-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'suppliers',
            parenttype: 'Request for Quotation',
            supplier: s.supplier,
          })),
        } : undefined,
      },
    });

    revalidatePath('/dashboard/erp/buying/rfq');
    return {
      success: true,
      rfq: {
        name: rfq.name,
        company: rfq.company,
        transaction_date: rfq.transaction_date,
        status: rfq.status || 'Draft',
        schedule_date: rfq.schedule_date,
        message_for_supplier: rfq.message_for_supplier,
        opportunity: rfq.opportunity,
        docstatus: rfq.docstatus || 0,
        creation: rfq.creation,
      },
    };
  } catch (error) {
    console.error('[rfq] createRFQ failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create RFQ') };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitRFQ(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Supplier", "submit");
    const r = await prisma.requestForQuotation.findUnique({ where: { name: id } });
    if (!r) return { success: false, error: 'Not found' };
    if (r.docstatus !== 0) return { success: false, error: 'Only draft documents can be submitted' };
    await prisma.requestForQuotation.update({ where: { name: id }, data: { docstatus: 1 } });
    revalidatePath('/dashboard/erp/buying/rfq');
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Failed to submit') };
  }
}

export async function cancelRFQ(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Supplier", "cancel");
    const r = await prisma.requestForQuotation.findUnique({ where: { name: id } });
    if (!r) return { success: false, error: 'Not found' };
    if (r.docstatus !== 1) return { success: false, error: 'Only submitted documents can be cancelled' };
    await prisma.requestForQuotation.update({ where: { name: id }, data: { docstatus: 2 } });
    revalidatePath('/dashboard/erp/buying/rfq');
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Failed to cancel') };
  }
}
