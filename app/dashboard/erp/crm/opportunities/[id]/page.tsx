export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import OpportunityDetailClient from './opportunity-detail-client';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [opp, items] = await Promise.all([
      prisma.opportunity.findUnique({ where: { name: id } }),
      prisma.opportunityItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!opp) throw new Error('Not found');
    const record = {
      name: opp.name, opportunity_from: opp.opportunity_from, party_name: opp.party_name,
      customer_name: opp.customer_name, opportunity_type: opp.opportunity_type,
      status: opp.status || 'Open', sales_stage: opp.sales_stage,
      opportunity_amount: Number(opp.opportunity_amount || 0), probability: opp.probability,
      currency: opp.currency, transaction_date: opp.transaction_date, company: opp.company,
      expected_closing: opp.expected_closing, contact_person: opp.contact_person,
      contact_email: opp.contact_email, contact_mobile: opp.contact_mobile,
      territory: opp.territory, industry: opp.industry, market_segment: opp.market_segment,
      annual_revenue: opp.annual_revenue ? Number(opp.annual_revenue) : null,
      order_lost_reason: opp.order_lost_reason, opportunity_owner: opp.opportunity_owner,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        qty: i.qty || 1, rate: Number(i.rate || 0), amount: Number(i.amount || 0), uom: i.uom,
      })),
    };
    return <OpportunityDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Opportunity not found</div>; }
}
