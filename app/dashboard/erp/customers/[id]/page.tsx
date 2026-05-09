import { prisma } from '@/lib/prisma';
import CustomerDetailClient from '@/app/dashboard/erp/customers/[id]/customer-detail-client';

interface QuotationSummary {
  id: string;
  quotation_number: string;
  total: number;
  status: string;
  valid_until: Date | null;
  created_at: Date;
}

interface SalesOrderSummary {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: Date;
}

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  total: number;
  outstanding_amount: number;
  status: string;
  posting_date: Date;
  due_date: Date | null;
  created_at: Date;
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const customer = await prisma.customers.findUnique({ where: { id } });

    if (!customer) {
      return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
    }

    const quotations = await prisma.quotations.findMany({
      where: { customer_id: id },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const salesOrders = await prisma.sales_orders.findMany({
      where: { customer_id: id },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const invoices = await prisma.sales_invoices.findMany({
      where: { customer_name: customer.customer_name },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const record = {
      ...customer,
      id: customer.id,
      customer_name: customer.customer_name,
      customer_code: customer.customer_code,
      contact_person: customer.contact_person || null,
      email: customer.email || null,
      phone: customer.phone || null,
      address: customer.address || null,
      industry: customer.industry || null,
      tax_id: customer.tax_id || null,
      credit_limit: customer.credit_limit || null,
      status: customer.status === 'Inactive' ? 'Inactive' : 'Active',
      quotations: quotations.map((q: QuotationSummary) => ({
        id: q.id,
        quotation_number: q.quotation_number,
        customer_name: customer.customer_name,
        total: q.total || 0,
        status: q.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
        valid_until: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
        created_at: q.created_at ? q.created_at.toISOString() : new Date().toISOString(),
      })),
      sales_orders: salesOrders.map((o: SalesOrderSummary) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: customer.customer_name,
        total: o.total || 0,
        status: o.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
        created_at: o.created_at ? o.created_at.toISOString() : new Date().toISOString(),
      })),
      invoices: invoices.map((inv: InvoiceSummary) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: customer.customer_name,
        total: inv.total || 0,
        outstanding_amount: inv.outstanding_amount || 0,
        status: inv.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
        posting_date: inv.posting_date ? inv.posting_date.toISOString().slice(0, 10) : '',
        due_date: inv.due_date ? inv.due_date.toISOString().slice(0, 10) : null,
        created_at: inv.created_at ? inv.created_at.toISOString() : new Date().toISOString(),
      })),
    };

    return <CustomerDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
  }
}
