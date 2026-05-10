export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import StockDetailClient from '@/app/dashboard/erp/stock/[id]/stock-detail-client';

export default async function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const item = await prisma.item.findUnique({ where: { name: id } });
    if (!item) throw new Error('Not found');

    const [bins, stockEntryDetails] = await Promise.all([
      prisma.bin.findMany({ where: { item_code: item.item_code } }),
      prisma.stockEntryDetail.findMany({
        where: { item_code: item.item_code },
        orderBy: { idx: 'desc' },
        take: 50,
      }),
    ]);

    const record = {
      id: item.name,
      item_code: item.item_code,
      item_name: item.item_name || item.item_code,
      item_group: item.item_group || 'Products',
      description: item.description || null,
      unit: item.stock_uom || 'Nos',
      has_batch: !!item.has_batch_no,
      has_serial: !!item.has_serial_no,
      valuation_method: item.valuation_method || 'FIFO',
      standard_rate: Number(item.standard_rate || 0),
      min_order_qty: null,
      safety_stock: null,
      bins: bins.map((b) => ({
        id: b.name,
        quantity: b.actual_qty || 0,
        valuation_rate: 0,
        stock_value: 0,
        warehouses: {
          id: b.warehouse,
          warehouse_name: b.warehouse,
          warehouse_code: b.warehouse,
          location: '',
        },
      })),
      stock_entries: stockEntryDetails.map((e) => ({
        id: e.name,
        entry_type: '',
        quantity: e.qty || 0,
        serial_number: null,
        batch_number: null,
        valuation_rate: Number(e.basic_rate || 0),
        reference: e.parent || null,
        posting_date: e.creation?.toISOString() ?? new Date().toISOString(),
        warehouses_stock_entries_source_warehouseTowarehouses: e.s_warehouse ? {
          id: e.s_warehouse,
          warehouse_name: e.s_warehouse,
          warehouse_code: e.s_warehouse,
        } : null,
        warehouses_stock_entries_target_warehouseTowarehouses: e.t_warehouse ? {
          id: e.t_warehouse,
          warehouse_name: e.t_warehouse,
          warehouse_code: e.t_warehouse,
        } : null,
      })),
    };

    return <StockDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Item not found</div>;
  }
}
