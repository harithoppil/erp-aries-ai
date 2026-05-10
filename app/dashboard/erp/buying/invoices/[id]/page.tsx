export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import PurchaseInvoiceDetailClient from './purchase-invoice-detail-client';

export default async function PurchaseInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [invoice, items] = await Promise.all([
      prisma.purchaseInvoice.findUnique({ where: { name: id } }),
      prisma.purchaseInvoiceItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!invoice) throw new Error('Not found');
    const record = {
      name: invoice.name, supplier: invoice.supplier, supplier_name: invoice.supplier_name,
      posting_date: invoice.posting_date, due_date: invoice.due_date,
      status: invoice.status || 'Draft', grand_total: Number(invoice.grand_total || 0),
      net_total: Number(invoice.net_total || 0), total_taxes_and_charges: Number(invoice.total_taxes_and_charges || 0),
      outstanding_amount: Number(invoice.outstanding_amount || 0), paid_amount: Number(invoice.paid_amount || 0),
      currency: invoice.currency || 'AED', is_return: !!invoice.is_return, is_paid: !!invoice.is_paid,
      on_hold: !!invoice.on_hold, docstatus: invoice.docstatus || 0, company: invoice.company,
      project: invoice.project, bill_no: invoice.bill_no, remarks: invoice.remarks,
      credit_to: invoice.credit_to, tax_id: invoice.tax_id,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        qty: i.qty, uom: i.uom, rate: Number(i.rate || 0), amount: Number(i.amount || 0),
        expense_account: i.expense_account, cost_center: i.cost_center,
      })),
    };
    return <PurchaseInvoiceDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Purchase Invoice not found</div>; }
}
