import { prisma } from '@/lib/prisma';
import IssueDetailClient from './issue-detail-client';

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const issue = await prisma.issue.findUnique({ where: { name: id } });
    if (!issue) throw new Error('Not found');
    const record = {
      name: issue.name, subject: issue.subject, customer: issue.customer,
      raised_by: issue.raised_by, status: issue.status || 'Open', priority: issue.priority,
      issue_type: issue.issue_type, opening_date: issue.opening_date,
      resolution_time: issue.resolution_time, company: issue.company, project: issue.project,
      docstatus: issue.docstatus || 0, description: issue.description,
      resolution_details: issue.resolution_details, contact: issue.contact,
      lead: issue.lead, first_responded_on: issue.first_responded_on,
      avg_response_time: issue.avg_response_time, customer_name: issue.customer_name,
      via_customer_portal: issue.via_customer_portal, agreement_status: issue.agreement_status,
    };
    return <IssueDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Issue not found</div>; }
}
