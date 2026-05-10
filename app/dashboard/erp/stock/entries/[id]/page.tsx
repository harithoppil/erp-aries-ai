export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import StockEntryDetailClient from './stock-entry-detail-client';

export default async function StockEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [entry, details] = await Promise.all([
      prisma.stockEntry.findUnique({ where: { name: id } }),
      prisma.stockEntryDetail.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!entry) throw new Error('Not found');
    const record = {
      name: entry.name, stock_entry_type: entry.stock_entry_type, purpose: entry.purpose,
      posting_date: entry.posting_date, from_warehouse: entry.from_warehouse, to_warehouse: entry.to_warehouse,
      total_incoming_value: Number(entry.total_incoming_value || 0), total_outgoing_value: Number(entry.total_outgoing_value || 0),
      value_difference: Number(entry.value_difference || 0), docstatus: entry.docstatus || 0, company: entry.company,
      work_order: entry.work_order, remarks: entry.remarks,
      items: details.map((d) => ({
        name: d.name, item_code: d.item_code, item_name: d.item_name, qty: d.qty, uom: d.uom,
        basic_rate: Number(d.basic_rate || 0), basic_amount: Number(d.basic_amount || 0),
        s_warehouse: d.s_warehouse, t_warehouse: d.t_warehouse, serial_no: d.serial_no, batch_no: d.batch_no,
      })),
    };
    return <StockEntryDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Stock Entry not found</div>; }
}
