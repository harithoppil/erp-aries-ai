'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeLead {
  name: string;
  lead_name: string | null;
  company_name: string | null;
  email_id: string | null;
  phone: string | null;
  mobile_no: string | null;
  status: string;
  type: string | null;
  industry: string | null;
  territory: string | null;
  source: string | null;
  creation: Date | null;
}

export interface ClientSafeLeadDetail extends ClientSafeLead {
  salutation: string | null;
  gender: string | null;
  website: string | null;
  fax: string | null;
  lead_owner: string | null;
  customer: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  job_title: string | null;
  annual_revenue: number | null;
  no_of_employees: string | null;
  market_segment: string | null;
  request_type: string | null;
  qualification_status: string | null;
  qualified_by: string | null;
  qualified_on: Date | null;
  notes_html: string | null;
}

export interface CreateLeadInput {
  lead_name?: string;
  company_name?: string;
  email_id?: string;
  phone?: string;
  mobile_no?: string;
  type?: string;
  industry?: string;
  territory?: string;
  source?: string;
  website?: string;
  job_title?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listLeads(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; leads: ClientSafeLead[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { lead_name: { contains: search, mode: 'insensitive' as const } },
            { company_name: { contains: search, mode: 'insensitive' as const } },
            { email_id: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      success: true,
      total,
      leads: leads.map((l) => ({
        name: l.name,
        lead_name: l.lead_name,
        company_name: l.company_name,
        email_id: l.email_id,
        phone: l.phone,
        mobile_no: l.mobile_no,
        status: l.status || 'Lead',
        type: l.type,
        industry: l.industry,
        territory: l.territory,
        source: l.utm_source,
        creation: l.creation,
      })),
    };
  } catch (error: any) {
    console.error('[leads] listLeads failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch leads' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getLead(
  id: string
): Promise<{ success: true; lead: ClientSafeLeadDetail } | { success: false; error: string }> {
  try {
    const lead = await prisma.lead.findUnique({ where: { name: id } });
    if (!lead) return { success: false, error: 'Lead not found' };

    return {
      success: true,
      lead: {
        name: lead.name,
        lead_name: lead.lead_name,
        company_name: lead.company_name,
        email_id: lead.email_id,
        phone: lead.phone,
        mobile_no: lead.mobile_no,
        status: lead.status || 'Lead',
        type: lead.type,
        industry: lead.industry,
        territory: lead.territory,
        source: lead.utm_source,
        creation: lead.creation,
        salutation: lead.salutation,
        gender: lead.gender,
        website: lead.website,
        fax: lead.fax,
        lead_owner: lead.lead_owner,
        customer: lead.customer,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        job_title: lead.job_title,
        annual_revenue: lead.annual_revenue ? Number(lead.annual_revenue) : null,
        no_of_employees: lead.no_of_employees,
        market_segment: lead.market_segment,
        request_type: lead.request_type,
        qualification_status: lead.qualification_status,
        qualified_by: lead.qualified_by,
        qualified_on: lead.qualified_on,
        notes_html: lead.notes_html,
      },
    };
  } catch (error: any) {
    console.error('[leads] getLead failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch lead' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createLead(
  data: CreateLeadInput
): Promise<{ success: true; lead: ClientSafeLead } | { success: false; error: string }> {
  try {
    if (!data.lead_name && !data.company_name) {
      return { success: false, error: 'Lead name or company name is required' };
    }

    const lead = await prisma.lead.create({
      data: {
        name: `CRM-LEAD-${Date.now()}`,
        naming_series: 'CRM-LEAD-',
        lead_name: data.lead_name || null,
        company_name: data.company_name || null,
        email_id: data.email_id || null,
        phone: data.phone || null,
        mobile_no: data.mobile_no || null,
        type: data.type || null,
        industry: data.industry || null,
        territory: data.territory || null,
        website: data.website || null,
        job_title: data.job_title || null,
        status: 'Lead',
        company: 'Aries',
      },
    });

    revalidatePath('/dashboard/erp/crm/leads');
    return {
      success: true,
      lead: {
        name: lead.name,
        lead_name: lead.lead_name,
        company_name: lead.company_name,
        email_id: lead.email_id,
        phone: lead.phone,
        mobile_no: lead.mobile_no,
        status: lead.status || 'Lead',
        type: lead.type,
        industry: lead.industry,
        territory: lead.territory,
        source: lead.utm_source,
        creation: lead.creation,
      },
    };
  } catch (error: any) {
    console.error('[leads] createLead failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create lead' };
  }
}

// ── Update status ──────────────────────────────────────────────────────────────

export async function updateLeadStatus(
  id: string,
  status: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.lead.update({ where: { name: id }, data: { status } });
    revalidatePath('/dashboard/erp/crm/leads');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update lead status' };
  }
}

// ── Convert to Customer ─────────────────────────────────────────────────────────

export async function convertLeadToCustomer(
  id: string
): Promise<{ success: true; customer_name: string } | { success: false; error: string }> {
  try {
    const lead = await prisma.lead.findUnique({ where: { name: id } });
    if (!lead) return { success: false, error: 'Lead not found' };
    if (lead.customer) return { success: false, error: 'Lead already converted to customer' };

    const customerName = `CUST-${Date.now()}`;
    await prisma.lead.update({
      where: { name: id },
      data: { status: 'Converted', customer: customerName },
    });

    revalidatePath('/dashboard/erp/crm/leads');
    return { success: true, customer_name: customerName };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to convert lead' };
  }
}
