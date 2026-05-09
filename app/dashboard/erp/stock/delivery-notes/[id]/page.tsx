import { prisma } from '@/lib/prisma';
import DeliveryNoteDetailClient from './delivery-note-detail-client';

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [note, items] = await Promise.all([
      prisma.deliveryNote.findUnique({ where: { name: id } }),
      prisma.deliveryNoteItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!note) throw new Error('Not found');
    const record = {
      name: note.name, customer: note.customer, customer_name: note.customer_name,
      posting_date: note.posting_date, status: note.status || 'Draft',
      grand_total: Number(note.grand_total || 0), net_total: Number(note.net_total || 0),
      total_taxes_and_charges: Number(note.total_taxes_and_charges || 0),
      currency: note.currency || 'AED', is_return: note.is_return, docstatus: note.docstatus || 0,
      company: note.company, project: note.project, po_no: note.po_no,
      transporter_name: note.transporter_name, lr_no: note.lr_no,
      shipping_address: note.shipping_address, instructions: note.instructions,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        qty: i.qty, uom: i.uom, rate: Number(i.rate || 0), amount: Number(i.amount || 0), warehouse: i.warehouse,
      })),
    };
    return <DeliveryNoteDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Delivery Note not found</div>; }
}
