import { prisma } from '@/lib/prisma';
import LeadDetailClient from './lead-detail-client';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const lead = await prisma.lead.findUnique({ where: { name: id } });
    if (!lead) throw new Error('Not found');
    const record = {
      name: lead.name, lead_name: lead.lead_name, company_name: lead.company_name,
      email_id: lead.email_id, phone: lead.phone, mobile_no: lead.mobile_no,
      status: lead.status || 'Lead', type: lead.type, industry: lead.industry,
      territory: lead.territory, salutation: lead.salutation, gender: lead.gender,
      website: lead.website, lead_owner: lead.lead_owner, customer: lead.customer,
      city: lead.city, state: lead.state, country: lead.country, job_title: lead.job_title,
      annual_revenue: lead.annual_revenue ? Number(lead.annual_revenue) : null,
      no_of_employees: lead.no_of_employees, market_segment: lead.market_segment,
      request_type: lead.request_type, qualification_status: lead.qualification_status,
      qualified_by: lead.qualified_by, qualified_on: lead.qualified_on,
    };
    return <LeadDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Lead not found</div>; }
}
