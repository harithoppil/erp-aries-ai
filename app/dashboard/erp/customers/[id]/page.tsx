import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import CustomerDetailClient from '@/app/dashboard/erp/customers/[id]/customer-detail-client';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const customer = await frappeGetDoc<any>('Customer', id);

    const quotations = await frappeGetList<any>('Quotation', {
      filters: { party_name: customer.customer_name },
      fields: ['name', 'status', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 20,
    });

    const salesOrders = await frappeGetList<any>('Sales Order', {
      filters: { customer: customer.customer_name },
      fields: ['name', 'status', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 20,
    });

    const invoices = await frappeGetList<any>('Sales Invoice', {
      filters: { customer: customer.customer_name },
      fields: ['name', 'status', 'docstatus', 'posting_date', 'due_date', 'base_grand_total', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 20,
    });

    const record = {
      ...customer,
      id: customer.name,
      customer_name: customer.customer_name || customer.name,
      customer_code: customer.name,
      contact_person: customer.customer_primary_contact || null,
      email: customer.email_id || null,
      phone: customer.mobile_no || null,
      address: customer.primary_address || null,
      industry: customer.industry || null,
      tax_id: customer.tax_id || null,
      credit_limit: customer.credit_limit || null,
      status: customer.disabled ? 'Inactive' : 'Active',
      quotations: quotations.map((q: any) => ({
        id: q.name,
        quotation_number: q.name,
        status: q.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        created_at: q.creation || new Date().toISOString(),
      })),
      sales_orders: salesOrders.map((o: any) => ({
        id: o.name,
        order_number: o.name,
        status: o.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        created_at: o.creation || new Date().toISOString(),
      })),
      invoices: invoices.map((inv: any) => ({
        id: inv.name,
        invoice_number: inv.name,
        status: inv.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        posting_date: inv.posting_date || '',
        due_date: inv.due_date || null,
        total: inv.base_grand_total || 0,
        created_at: inv.creation || new Date().toISOString(),
      })),
    };

    return <CustomerDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
  }
}
