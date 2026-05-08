import { prisma } from '@/lib/prisma';
import CustomerDetailClient from '@/app/dashboard/erp/customers/[id]/customer-detail-client';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customers.findUnique({
    where: { id },
    include: {
      quotations: { orderBy: { created_at: 'desc' } },
      sales_orders: { orderBy: { created_at: 'desc' } },
    },
  });

  if (!customer) {
    return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
  }

  // Fetch related invoices by customer_name
  const invoices = await prisma.sales_invoices.findMany({
    where: { customer_name: customer.customer_name },
    orderBy: { created_at: 'desc' },
  });

  const record = {
    ...customer,
    status: String(customer.status),
    quotations: customer.quotations.map(q => ({ ...q, status: String(q.status) })),
    sales_orders: customer.sales_orders.map(o => ({ ...o, status: String(o.status) })),
    invoices: invoices.map(inv => ({
      ...inv,
      status: String(inv.status),
      posting_date: inv.posting_date?.toISOString() ?? '',
      due_date: inv.due_date?.toISOString() ?? null,
    })),
  };

  return <CustomerDetailClient record={record} />;
}
