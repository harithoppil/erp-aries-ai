export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import RfqDetailClient from './rfq-detail-client';

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [rfq, items, suppliers] = await Promise.all([
      prisma.requestForQuotation.findUnique({ where: { name: id } }),
      prisma.requestForQuotationItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
      prisma.requestForQuotationSupplier.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!rfq) throw new Error('Not found');
    const record = {
      name: rfq.name, company: rfq.company, transaction_date: rfq.transaction_date,
      status: rfq.status || 'Draft', schedule_date: rfq.schedule_date,
      message_for_supplier: rfq.message_for_supplier, opportunity: rfq.opportunity,
      docstatus: rfq.docstatus || 0,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        qty: i.qty, uom: i.uom, schedule_date: i.schedule_date, warehouse: i.warehouse,
      })),
      suppliers: suppliers.map((s) => ({
        name: s.name, supplier: s.supplier, supplier_name: s.supplier_name,
        quote_status: s.quote_status, email_id: s.email_id,
      })),
    };
    return <RfqDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">RFQ not found</div>; }
}
