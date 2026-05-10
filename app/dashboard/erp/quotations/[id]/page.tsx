export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import QuotationDetailClient from '@/app/dashboard/erp/quotations/[id]/quotation-detail-client';

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [quotation, items] = await Promise.all([
      prisma.quotation.findUnique({ where: { name: id } }),
      prisma.quotationItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!quotation) {
      return <div className="p-8 text-center text-muted-foreground">Quotation not found</div>;
    }

    const salesOrders = quotation.party_name
      ? await prisma.salesOrder.findMany({
          where: { customer: quotation.party_name },
          orderBy: { creation: 'desc' },
          take: 5,
        })
      : [];

    const record = {
      id: quotation.name,
      quotation_number: quotation.name,
      enquiry_id: null,
      customer_id: quotation.party_name || null,
      customer_name: quotation.customer_name || '',
      project_type: quotation.order_type || null,
      valid_until: quotation.valid_till?.toISOString().slice(0, 10) ?? null,
      status: quotation.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
      subtotal: Number(quotation.net_total || 0),
      tax_rate: 0,
      tax_amount: Number(quotation.total_taxes_and_charges || 0),
      total: Number(quotation.grand_total || 0),
      currency: quotation.currency || 'AED',
      notes: quotation.terms || null,
      created_at: quotation.creation?.toISOString() ?? new Date().toISOString(),
      quotation_items: items.map((item) => ({
        id: item.name,
        quotation_id: id,
        item_code: item.item_code || null,
        description: item.description || '',
        quantity: item.qty || 0,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      })),
      customers: quotation.party_name ? {
        id: quotation.party_name,
        customer_name: quotation.customer_name || quotation.party_name,
      } : null,
      sales_orders: salesOrders.map((o) => ({
        id: o.name,
        order_number: o.name,
        status: o.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
      })),
    };

    return <QuotationDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Quotation not found</div>;
  }
}
