import { prisma } from '@/lib/prisma';
import QuotationDetailClient from '@/app/dashboard/erp/quotations/[id]/quotation-detail-client';

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await prisma.quotations.findUnique({
    where: { id },
    include: {
      quotation_items: true,
      customers: true,
      sales_orders: true,
    },
  });

  if (!quotation) {
    return <div className="p-8 text-center text-muted-foreground">Quotation not found</div>;
  }

  const record = {
    ...quotation,
    status: String(quotation.status),
    valid_until: quotation.valid_until?.toISOString() ?? null,
    created_at: quotation.created_at.toISOString(),
    quotation_items: quotation.quotation_items,
    customers: quotation.customers ? { id: quotation.customers.id, customer_name: quotation.customers.customer_name } : null,
    sales_orders: quotation.sales_orders.map(o => ({ ...o, status: String(o.status) })),
  };

  return <QuotationDetailClient record={record} />;
}
