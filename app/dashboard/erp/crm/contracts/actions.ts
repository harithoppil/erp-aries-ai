'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeContract {
  name: string;
  party_type: string;
  party_name: string;
  status: string;
  contract_template: string | null;
  start_date: Date | null;
  end_date: Date | null;
  is_signed: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeContractDetail extends ClientSafeContract {
  party_user: string | null;
  fulfilment_status: string | null;
  signee: string | null;
  signed_on: Date | null;
  contract_terms: string;
  requires_fulfilment: boolean;
  fulfilment_deadline: Date | null;
  document_type: string | null;
  document_name: string | null;
  party_full_name: string | null;
  signed_by_company: string | null;
}

export interface CreateContractInput {
  party_type?: string;
  party_name: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  contract_terms?: string;
  contract_template?: string;
  is_signed?: boolean;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listContracts(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; contracts: ClientSafeContract[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { party_name: { contains: search, mode: 'insensitive' as const } },
            { status: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      success: true,
      total,
      contracts: contracts.map((c) => ({
        name: c.name,
        party_type: c.party_type,
        party_name: c.party_name,
        status: c.status || 'Draft',
        contract_template: c.contract_template,
        start_date: c.start_date,
        end_date: c.end_date,
        is_signed: c.is_signed || false,
        docstatus: c.docstatus || 0,
        creation: c.creation,
      })),
    };
  } catch (error: any) {
    console.error('[contracts] listContracts failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch contracts' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getContract(
  id: string
): Promise<{ success: true; contract: ClientSafeContractDetail } | { success: false; error: string }> {
  try {
    const c = await prisma.contract.findUnique({ where: { name: id } });
    if (!c) return { success: false, error: 'Contract not found' };

    return {
      success: true,
      contract: {
        name: c.name,
        party_type: c.party_type,
        party_name: c.party_name,
        status: c.status || 'Draft',
        contract_template: c.contract_template,
        start_date: c.start_date,
        end_date: c.end_date,
        is_signed: c.is_signed || false,
        docstatus: c.docstatus || 0,
        creation: c.creation,
        party_user: c.party_user,
        fulfilment_status: c.fulfilment_status,
        signee: c.signee,
        signed_on: c.signed_on,
        contract_terms: c.contract_terms,
        requires_fulfilment: c.requires_fulfilment || false,
        fulfilment_deadline: c.fulfilment_deadline,
        document_type: c.document_type,
        document_name: c.document_name,
        party_full_name: c.party_full_name,
        signed_by_company: c.signed_by_company,
      },
    };
  } catch (error: any) {
    console.error('[contracts] getContract failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch contract' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createContract(
  data: CreateContractInput
): Promise<{ success: true; contract: ClientSafeContract } | { success: false; error: string }> {
  try {
    if (!data.party_name) return { success: false, error: 'Party name is required' };

    const name = `CONTRACT-${Date.now()}`;
    const c = await prisma.contract.create({
      data: {
        name,
        party_type: data.party_type || 'Customer',
        party_name: data.party_name,
        status: data.status || 'Draft',
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        contract_terms: data.contract_terms || '',
        contract_template: data.contract_template || null,
        is_signed: data.is_signed || false,
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/crm/contracts');
    return {
      success: true,
      contract: {
        name: c.name,
        party_type: c.party_type,
        party_name: c.party_name,
        status: c.status || 'Draft',
        contract_template: c.contract_template,
        start_date: c.start_date,
        end_date: c.end_date,
        is_signed: c.is_signed || false,
        docstatus: c.docstatus || 0,
        creation: c.creation,
      },
    };
  } catch (error: any) {
    console.error('[contracts] createContract failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create contract' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitContract(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const c = await prisma.contract.findUnique({ where: { name: id } });
    if (!c) return { success: false, error: 'Not found' };
    if (c.docstatus !== 0) return { success: false, error: 'Only draft contracts can be submitted' };
    await prisma.contract.update({ where: { name: id }, data: { docstatus: 1, status: 'Active' } });
    revalidatePath('/dashboard/erp/crm/contracts');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to submit contract' };
  }
}

export async function cancelContract(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const c = await prisma.contract.findUnique({ where: { name: id } });
    if (!c) return { success: false, error: 'Not found' };
    if (c.docstatus !== 1) return { success: false, error: 'Only submitted contracts can be cancelled' };
    await prisma.contract.update({ where: { name: id }, data: { docstatus: 2, status: 'Cancelled' } });
    revalidatePath('/dashboard/erp/crm/contracts');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to cancel contract' };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteContract(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await prisma.contract.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Contract not found' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only draft contracts can be deleted' };

    await prisma.contract.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/crm/contracts');
    return { success: true };
  } catch (error: any) {
    console.error('[contracts] deleteContract failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete contract' };
  }
}
