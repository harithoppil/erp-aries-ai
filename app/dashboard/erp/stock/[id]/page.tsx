import { prisma } from '@/lib/prisma';
import StockDetailClient from '@/app/dashboard/erp/stock/[id]/stock-detail-client';

export default async function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const item = await prisma.items.findUnique({
      where: { id },
      include: { bins: { include: { warehouses: true } } },
    });

    if (!item) throw new Error('Not found');

    const stockEntries = await prisma.stock_entry_items.findMany({
      where: { item_id: id },
      include: {
        stock_entries: {
          include: {
            from_warehouse: true,
            to_warehouse: true,
          },
        },
      },
    });

    const record = {
      ...item,
      id: item.id,
      item_code: item.item_code || item.id,
      item_name: item.item_name || item.item_code,
      item_group: item.item_group || 'Products',
      description: item.description || null,
      unit: item.unit || 'Nos',
      has_batch: !!item.has_batch,
      has_serial: !!item.has_serial,
      valuation_method: item.valuation_method || 'FIFO',
      standard_rate: item.standard_rate || null,
      min_order_qty: item.min_order_qty || null,
      safety_stock: item.safety_stock || null,
      bins: item.bins.map((b) => ({
        id: b.id,
        item_id: id,
        warehouse_id: b.warehouse_id,
        quantity: b.quantity || 0,
        valuation_rate: b.valuation_rate || 0,
        stock_value: b.stock_value || 0,
        warehouses: b.warehouses
          ? { warehouse_name: b.warehouses.warehouse_name, warehouse_code: b.warehouses.warehouse_code }
          : null,
      })),
      stock_entries: stockEntries.map((e) => ({
        id: e.id,
        entry_type: e.stock_entries?.entry_type || 'Stock Entry',
        item_id: id,
        quantity: e.qty || 0,
        source_warehouse: e.stock_entries?.from_warehouse?.warehouse_name || null,
        target_warehouse: e.stock_entries?.to_warehouse?.warehouse_name || null,
        reference: e.stock_entries?.entry_number || e.stock_entries?.id || null,
        posting_date: e.stock_entries?.posting_date ? new Date(e.stock_entries.posting_date) : new Date(),
        created_at: e.stock_entries?.created_at ? new Date(e.stock_entries.created_at) : new Date(),
        warehouses_stock_entries_source_warehouseTowarehouses: e.stock_entries?.from_warehouse
          ? { warehouse_name: e.stock_entries.from_warehouse.warehouse_name, warehouse_code: e.stock_entries.from_warehouse.warehouse_code }
          : null,
        warehouses_stock_entries_target_warehouseTowarehouses: e.stock_entries?.to_warehouse
          ? { warehouse_name: e.stock_entries.to_warehouse.warehouse_name, warehouse_code: e.stock_entries.to_warehouse.warehouse_code }
          : null,
      })),
    };

    return <StockDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Item not found</div>;
  }
}
