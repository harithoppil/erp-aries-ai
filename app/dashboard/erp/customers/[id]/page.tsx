export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import CustomerDetailClient from '@/app/dashboard/erp/customers/[id]/customer-detail-client';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const customer = await prisma.customer.findUnique({ where: { name: id } });
    if (!customer) {
      return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
    }

    const [quotations, salesOrders, invoices] = await Promise.all([
      prisma.quotation.findMany({
        where: { party_name: id },
        orderBy: { creation: 'desc' },
        take: 20,
      }),
      prisma.salesOrder.findMany({
        where: { customer: id },
        orderBy: { creation: 'desc' },
        take: 20,
      }),
      prisma.salesInvoice.findMany({
        where: { customer: id },
        orderBy: { creation: 'desc' },
        take: 20,
      }),
    ]);

    const record = {
      id: customer.name,
      customer_name: customer.customer_name,
      customer_code: customer.name,
      contact_person: customer.customer_primary_contact || null,
      email: customer.email_id || null,
      phone: customer.mobile_no || null,
      address: customer.primary_address || null,
      industry: customer.industry || null,
      tax_id: customer.tax_id || null,
      credit_limit: null,
      status: customer.disabled ? 'Inactive' : 'Active',
      created_at: customer.creation?.toISOString() ?? new Date().toISOString(),
      quotations: quotations.map((q) => ({
        id: q.name,
        quotation_number: q.name,
        customer_name: q.customer_name || '',
        total: Number(q.grand_total || 0),
        status: q.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        valid_until: q.valid_till?.toISOString().slice(0, 10) ?? null,
        created_at: q.creation?.toISOString() ?? new Date().toISOString(),
      })),
      sales_orders: salesOrders.map((o) => ({
        id: o.name,
        order_number: o.name,
        customer_name: o.customer_name || '',
        total: Number(o.grand_total || 0),
        status: o.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        created_at: o.creation?.toISOString() ?? new Date().toISOString(),
      })),
      invoices: invoices.map((inv) => ({
        id: inv.name,
        invoice_number: inv.name,
        customer_name: inv.customer_name || '',
        total: Number(inv.grand_total || 0),
        outstanding_amount: Number(inv.outstanding_amount || 0),
        status: inv.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        posting_date: inv.posting_date?.toISOString().slice(0, 10) ?? '',
        due_date: inv.due_date?.toISOString().slice(0, 10) ?? null,
        created_at: inv.creation?.toISOString() ?? new Date().toISOString(),
      })),
    };

    return <CustomerDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
  }
}
