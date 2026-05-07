'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeSupplier = {
  id: string;
  supplier_name: string;
  supplier_code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  created_at: Date;
};

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    const suppliers = await prisma.suppliers.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, suppliers: suppliers.map((s) => ({ ...s })) };
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return { success: false, error: 'Failed to fetch suppliers' };
  }
}

export async function createSupplier(data: {
  supplier_name: string;
  supplier_code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  rating?: number;
}) {
  try {
    const supplier = await prisma.suppliers.create({
      data: { id: randomUUID(), ...data, rating: data.rating || null }
    });
    revalidatePath('/erp/procurement');
    return { success: true as const, supplier: { ...supplier } as ClientSafeSupplier };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Supplier code already exists' };
    return { success: false as const, error: 'Failed to create supplier' };
  }
}
