'use server';

import { prisma } from '@/lib/prisma';
import { quotationstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeQuotation = {
  id: string;
  quotation_number: string;
  customer_name: string;
  project_type: string | null;
  valid_until: Date | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: Date;
};

export async function listQuotations(): Promise<
  { success: true; quotations: ClientSafeQuotation[] } | { success: false; error: string }
> {
  try {
    const quotations = await prisma.quotations.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, quotations: quotations.map((q) => ({ ...q, status: String(q.status) })) };
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return { success: false, error: 'Failed to fetch quotations' };
  }
}

export async function createQuotation(data: {
  customer_id?: string;
  customer_name: string;
  project_type?: string;
  valid_until?: Date;
  tax_rate?: number;
  notes?: string;
  items: { description: string; quantity: number; rate: number; item_code?: string }[];
}) {
  try {
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const quotationNumber = `QT-${Date.now().toString().slice(-6)}`;

    const quotation = await prisma.$transaction(async (tx) => {
      const qt = await tx.quotations.create({
        data: {
          id: randomUUID(),
          quotation_number: quotationNumber,
          customer_id: data.customer_id || null,
          customer_name: data.customer_name,
          project_type: data.project_type || null,
          valid_until: data.valid_until || null,
          status: quotationstatus.DRAFT,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          currency: 'AED',
          notes: data.notes || null,
        }
      });

      for (const item of data.items) {
        await tx.quotation_items.create({
          data: {
            id: randomUUID(),
            quotation_id: qt.id,
            item_code: item.item_code || null,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
          }
        });
      }

      return qt;
    });

    revalidatePath('/erp/quotations');
    return { success: true as const, quotation: { ...quotation, status: String(quotation.status) } as ClientSafeQuotation };
  } catch (error: any) {
    console.error('Error creating quotation:', error);
    if (error.code === 'P2002') return { success: false as const, error: 'Quotation number already exists' };
    return { success: false as const, error: 'Failed to create quotation' };
  }
}

// ── Quotation Mutations ────────────────────────────────────────────────────

export async function updateQuotationStatus(id: string, status: quotationstatus) {
  try {
    const record = await prisma.quotations.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/quotations');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[quotations] updateQuotationStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update quotation status' };
  }
}

export async function updateQuotation(
  id: string,
  data: Partial<{ customer_name: string; project_type: string; valid_until: Date; tax_rate: number; notes: string }>
) {
  try {
    const record = await prisma.quotations.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/quotations');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[quotations] updateQuotation failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update quotation' };
  }
}

export async function deleteQuotation(id: string) {
  try {
    await prisma.quotations.update({
      where: { id },
      data: { status: quotationstatus.REJECTED },
    });
    revalidatePath('/erp/quotations');
    return { success: true };
  } catch (error: any) {
    console.error('[quotations] deleteQuotation failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete quotation' };
  }
}
