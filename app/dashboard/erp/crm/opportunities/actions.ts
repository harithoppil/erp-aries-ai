'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { OpportunityItemRow } from '@/lib/erpnext/types';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeOpportunity {
  name: string;
  opportunity_from: string;
  party_name: string;
  customer_name: string | null;
  opportunity_type: string | null;
  status: string;
  sales_stage: string | null;
  opportunity_amount: number;
  probability: number | null;
  currency: string | null;
  transaction_date: Date;
  company: string;
  creation: Date | null;
}

export interface ClientSafeOpportunityItem {
  name: string;
  item_code: string | null;
  item_name: string | null;
  qty: number;
  rate: number;
  amount: number;
  uom: string | null;
}

export interface ClientSafeOpportunityDetail extends ClientSafeOpportunity {
  items: ClientSafeOpportunityItem[];
  expected_closing: Date | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  territory: string | null;
  customer_group: string | null;
  industry: string | null;
  market_segment: string | null;
  no_of_employees: string | null;
  annual_revenue: number | null;
  order_lost_reason: string | null;
  notes_html: string | null;
  opportunity_owner: string | null;
}

export interface CreateOpportunityInput {
  opportunity_from: string;
  party_name: string;
  opportunity_type?: string;
  items?: { item_code: string; qty: number; rate: number }[];
  expected_closing?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listOpportunities(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; opportunities: ClientSafeOpportunity[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { party_name: { contains: search, mode: 'insensitive' as const } },
            { customer_name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.opportunity.count({ where }),
    ]);

    return {
      success: true,
      total,
      opportunities: opportunities.map((o) => ({
        name: o.name,
        opportunity_from: o.opportunity_from,
        party_name: o.party_name,
        customer_name: o.customer_name,
        opportunity_type: o.opportunity_type,
        status: o.status || 'Open',
        sales_stage: o.sales_stage,
        opportunity_amount: Number(o.opportunity_amount || 0),
        probability: o.probability,
        currency: o.currency,
        transaction_date: o.transaction_date,
        company: o.company,
        creation: o.creation,
      })),
    };
  } catch (error: any) {
    console.error('[opportunities] listOpportunities failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch opportunities' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getOpportunity(
  id: string
): Promise<{ success: true; opportunity: ClientSafeOpportunityDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "read");
    const opp = await prisma.opportunity.findUnique({
      where: { name: id },
      
    });

    if (!opp) return { success: false, error: 'Opportunity not found' };

    return {
      success: true,
      opportunity: {
        name: opp.name,
        opportunity_from: opp.opportunity_from,
        party_name: opp.party_name,
        customer_name: opp.customer_name,
        opportunity_type: opp.opportunity_type,
        status: opp.status || 'Open',
        sales_stage: opp.sales_stage,
        opportunity_amount: Number(opp.opportunity_amount || 0),
        probability: opp.probability,
        currency: opp.currency,
        transaction_date: opp.transaction_date,
        company: opp.company,
        creation: opp.creation,
        items: ((opp as Record<string, unknown>)?.opportunityItems as OpportunityItemRow[] || []).map((i) => ({
          name: i.name,
          item_code: i.item_code,
          item_name: i.item_name,
          qty: i.qty || 1,
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          uom: i.uom,
        })),
        expected_closing: opp.expected_closing,
        contact_person: opp.contact_person,
        contact_email: opp.contact_email,
        contact_mobile: opp.contact_mobile,
        territory: opp.territory,
        customer_group: opp.customer_group,
        industry: opp.industry,
        market_segment: opp.market_segment,
        no_of_employees: opp.no_of_employees,
        annual_revenue: opp.annual_revenue ? Number(opp.annual_revenue) : null,
        order_lost_reason: opp.order_lost_reason,
        notes_html: opp.notes_html,
        opportunity_owner: opp.opportunity_owner,
      },
    };
  } catch (error: any) {
    console.error('[opportunities] getOpportunity failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch opportunity' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createOpportunity(
  data: CreateOpportunityInput
): Promise<{ success: true; opportunity: ClientSafeOpportunity } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "create");
    if (!data.party_name) return { success: false, error: 'Party name is required' };

    const totalAmount = (data.items || []).reduce((sum, i) => sum + i.qty * i.rate, 0);
    const name = `OPP-${Date.now()}`;

    const opp = await prisma.opportunity.create({
      data: {
        name,
        naming_series: 'OPP-',
        opportunity_from: data.opportunity_from || 'Lead',
        party_name: data.party_name,
        customer_name: data.party_name,
        opportunity_type: data.opportunity_type || null,
        status: 'Open',
        sales_stage: 'Prospecting',
        probability: 100,
        opportunity_amount: totalAmount,
        currency: 'AED',
        transaction_date: new Date(),
        company: 'Aries',
        expected_closing: data.expected_closing ? new Date(data.expected_closing) : null,
        // @ts-expect-error Prisma schema no relation
        opportunityItems: data.items ? {
          create: data.items.map((item, idx) => ({
            name: `OPPITEM-${Date.now()}-${idx}`,
            idx,
            parent: name,
            parentfield: 'items',
            parenttype: 'Opportunity',
            item_code: item.item_code,
            qty: item.qty,
            rate: item.rate,
            amount: item.qty * item.rate,
            base_rate: item.rate,
            base_amount: item.qty * item.rate,
            uom: 'Nos',
          })),
        } : undefined,
      },
      
    });

    revalidatePath('/dashboard/erp/crm/opportunities');
    return {
      success: true,
      opportunity: {
        name: opp.name,
        opportunity_from: opp.opportunity_from,
        party_name: opp.party_name,
        customer_name: opp.customer_name,
        opportunity_type: opp.opportunity_type,
        status: opp.status || 'Open',
        sales_stage: opp.sales_stage,
        opportunity_amount: Number(opp.opportunity_amount || 0),
        probability: opp.probability,
        currency: opp.currency,
        transaction_date: opp.transaction_date,
        company: opp.company,
        creation: opp.creation,
      },
    };
  } catch (error: any) {
    console.error('[opportunities] createOpportunity failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create opportunity' };
  }
}

// ── Update status ──────────────────────────────────────────────────────────────

export async function updateOpportunityStatus(
  id: string,
  status: string,
  lostReason?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Customer", "update");
    await prisma.opportunity.update({
      where: { name: id },
      data: {
        status,
        ...(status === 'Lost' && lostReason ? { order_lost_reason: lostReason } : {}),
      },
    });
    revalidatePath('/dashboard/erp/crm/opportunities');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update status' };
  }
}
