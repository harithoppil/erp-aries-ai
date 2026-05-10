export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import SalesInvoiceDetailClient from './sales-invoice-detail-client';

export default async function SalesInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [invoice, items] = await Promise.all([
      prisma.salesInvoice.findUnique({ where: { name: id } }),
      prisma.salesInvoiceItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!invoice) throw new Error('Not found');
    const record = {
      name: invoice.name, customer: invoice.customer, customer_name: invoice.customer_name,
      posting_date: invoice.posting_date, due_date: invoice.due_date,
      status: invoice.status || 'Draft', grand_total: Number(invoice.grand_total || 0),
      net_total: Number(invoice.net_total || 0), total_taxes_and_charges: Number(invoice.total_taxes_and_charges || 0),
      outstanding_amount: Number(invoice.outstanding_amount || 0), paid_amount: Number(invoice.paid_amount || 0),
      currency: invoice.currency || 'AED', is_return: invoice.is_return, is_pos: invoice.is_pos,
      docstatus: invoice.docstatus || 0, company: invoice.company, project: invoice.project,
      po_no: invoice.po_no, remarks: invoice.remarks, territory: invoice.territory,
      customer_group: invoice.customer_group, debit_to: invoice.debit_to,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        qty: i.qty, uom: i.uom, rate: Number(i.rate || 0), amount: Number(i.amount || 0),
        income_account: i.income_account, cost_center: i.cost_center,
      })),
    };
    return <SalesInvoiceDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Sales Invoice not found</div>; }
}
