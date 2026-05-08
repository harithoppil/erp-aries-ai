'use server';

import { prisma } from '@/lib/prisma';
import { quotationstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';
import { createQuotationSchema } from '@/lib/validators';

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

export async function listQuotations(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; quotations: ClientSafeQuotation[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { quotation_number: { contains: params.search, mode: 'insensitive' } },
        { customer_name: { contains: params.search, mode: 'insensitive' } },
        { project_type: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.status) {
      where.status = params.status;
    }
    const quotations = await prisma.quotations.findMany({ where, orderBy: { created_at: 'desc' } });
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
  // Validate input
  const parsed = createQuotationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  const validated = parsed.data;

  try {
    const subtotal = validated.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const quotationNumber = `QT-${Date.now().toString().slice(-6)}`;

    const quotation = await prisma.$transaction(async (tx) => {
      const qt = await tx.quotations.create({
        data: {
          id: generateId(),
          quotation_number: quotationNumber,
          customer_id: data.customer_id || null,
          customer_name: validated.customer_name,
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

      for (const item of validated.items) {
        await tx.quotation_items.create({
          data: {
            id: generateId(),
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
