import { prisma } from '@/lib/prisma';
import PurchaseReceiptDetailClient from './purchase-receipt-detail-client';

export default async function PurchaseReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [receipt, items] = await Promise.all([
      prisma.purchaseReceipt.findUnique({ where: { name: id } }),
      prisma.purchaseReceiptItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!receipt) throw new Error('Not found');
    const record = {
      name: receipt.name, supplier: receipt.supplier, supplier_name: receipt.supplier_name,
      posting_date: receipt.posting_date, status: receipt.status || 'Draft',
      grand_total: Number(receipt.grand_total || 0), net_total: Number(receipt.net_total || 0),
      total_taxes_and_charges: Number(receipt.total_taxes_and_charges || 0),
      currency: receipt.currency || 'AED', is_return: receipt.is_return, docstatus: receipt.docstatus || 0,
      company: receipt.company, project: receipt.project, remarks: receipt.remarks,
      items: items.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        received_qty: i.received_qty, qty: i.qty || 0, uom: i.uom,
        rate: Number(i.rate || 0), amount: Number(i.amount || 0), warehouse: i.warehouse,
      })),
    };
    return <PurchaseReceiptDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Purchase Receipt not found</div>; }
}
