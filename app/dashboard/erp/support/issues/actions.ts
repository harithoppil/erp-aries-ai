'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeIssue {
  name: string;
  subject: string;
  customer: string | null;
  raised_by: string | null;
  status: string;
  priority: string | null;
  issue_type: string | null;
  opening_date: Date | null;
  resolution_time: number | null;
  company: string | null;
  project: string | null;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeIssueDetail extends ClientSafeIssue {
  description: string | null;
  resolution_details: string | null;
  contact: string | null;
  lead: string | null;
  service_level_agreement: string | null;
  first_responded_on: Date | null;
  response_by: Date | null;
  avg_response_time: number | null;
  user_resolution_time: number | null;
  customer_name: string | null;
  opening_time: string | null;
  content_type: string | null;
  via_customer_portal: boolean;
  issue_split_from: string | null;
  agreement_status: string | null;
}

export interface CreateIssueInput {
  subject: string;
  customer?: string;
  raised_by?: string;
  priority?: string;
  issue_type?: string;
  description?: string;
  project?: string;
  company?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listIssues(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; issues: ClientSafeIssue[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { subject: { contains: search, mode: 'insensitive' as const } },
            { customer: { contains: search, mode: 'insensitive' as const } },
            { raised_by: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.issue.count({ where }),
    ]);

    return {
      success: true,
      total,
      issues: issues.map((i) => ({
        name: i.name,
        subject: i.subject,
        customer: i.customer,
        raised_by: i.raised_by,
        status: i.status || 'Open',
        priority: i.priority,
        issue_type: i.issue_type,
        opening_date: i.opening_date,
        resolution_time: i.resolution_time,
        company: i.company,
        project: i.project,
        docstatus: i.docstatus || 0,
        creation: i.creation,
      })),
    };
  } catch (error: any) {
    console.error('[issues] listIssues failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch issues' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getIssue(
  id: string
): Promise<{ success: true; issue: ClientSafeIssueDetail } | { success: false; error: string }> {
  try {
    const issue = await prisma.issue.findUnique({ where: { name: id } });
    if (!issue) return { success: false, error: 'Issue not found' };

    return {
      success: true,
      issue: {
        name: issue.name,
        subject: issue.subject,
        customer: issue.customer,
        raised_by: issue.raised_by,
        status: issue.status || 'Open',
        priority: issue.priority,
        issue_type: issue.issue_type,
        opening_date: issue.opening_date,
        resolution_time: issue.resolution_time,
        company: issue.company,
        project: issue.project,
        docstatus: issue.docstatus || 0,
        creation: issue.creation,
        description: issue.description,
        resolution_details: issue.resolution_details,
        contact: issue.contact,
        lead: issue.lead,
        service_level_agreement: issue.service_level_agreement,
        first_responded_on: issue.first_responded_on,
        response_by: issue.response_by,
        avg_response_time: issue.avg_response_time,
        user_resolution_time: issue.user_resolution_time,
        customer_name: issue.customer_name,
        opening_time: issue.opening_time,
        content_type: issue.content_type,
        via_customer_portal: !!issue.via_customer_portal,
        issue_split_from: issue.issue_split_from,
        agreement_status: issue.agreement_status,
      },
    };
  } catch (error: any) {
    console.error('[issues] getIssue failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch issue' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createIssue(
  data: CreateIssueInput
): Promise<{ success: true; issue: ClientSafeIssue } | { success: false; error: string }> {
  try {
    if (!data.subject) return { success: false, error: 'Subject is required' };

    const issue = await prisma.issue.create({
      data: {
        name: `ISS-${Date.now()}`,
        naming_series: 'ISS-',
        subject: data.subject,
        customer: data.customer || null,
        raised_by: data.raised_by || null,
        status: 'Open',
        priority: data.priority || 'Medium',
        issue_type: data.issue_type || null,
        description: data.description || null,
        project: data.project || null,
        company: data.company || 'Aries',
        opening_date: new Date(),
        opening_time: new Date().toTimeString().slice(0, 8),
        agreement_status: 'First Response Due',
      },
    });

    revalidatePath('/dashboard/erp/support/issues');
    return {
      success: true,
      issue: {
        name: issue.name,
        subject: issue.subject,
        customer: issue.customer,
        raised_by: issue.raised_by,
        status: issue.status || 'Open',
        priority: issue.priority,
        issue_type: issue.issue_type,
        opening_date: issue.opening_date,
        resolution_time: issue.resolution_time,
        company: issue.company,
        project: issue.project,
        docstatus: issue.docstatus || 0,
        creation: issue.creation,
      },
    };
  } catch (error: any) {
    console.error('[issues] createIssue failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create issue' };
  }
}

// ── Update status ──────────────────────────────────────────────────────────────

export async function updateIssueStatus(
  id: string,
  status: string,
  resolutionDetails?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.issue.update({
      where: { name: id },
      data: {
        status,
        ...(status === 'Closed' || status === 'Resolved' ? {
          resolution_details: resolutionDetails || null,
          resolution_time: Date.now() / 1000,
          user_resolution_time: Date.now() / 1000,
        } : {}),
      },
    });
    revalidatePath('/dashboard/erp/support/issues');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update issue status' };
  }
}
