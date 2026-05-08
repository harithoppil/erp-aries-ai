import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import StockDetailClient from '@/app/dashboard/erp/stock/[id]/stock-detail-client';

export default async function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const item = await frappeGetDoc<any>('Item', id);

    const bins = await frappeGetList<any>('Bin', {
      filters: { item_code: item.item_code || item.name },
      fields: ['name', 'warehouse', 'actual_qty', 'valuation_rate', 'stock_value'],
      limit_page_length: 50,
    });

    const stockEntries = await frappeGetList<any>('Stock Entry Detail', {
      filters: { item_code: item.item_code || item.name },
      fields: ['name', 'parent', 's_warehouse', 't_warehouse', 'qty', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 20,
    });

    const record = {
      ...item,
      id: item.name,
      item_code: item.item_code || item.name,
      item_name: item.item_name || item.item_code,
      item_group: item.item_group || 'Products',
      description: item.description || null,
      unit: item.stock_uom || 'Nos',
      has_batch: !!item.has_batch_no,
      has_serial: !!item.has_serial_no,
      valuation_method: item.valuation_method || 'FIFO',
      standard_rate: item.standard_rate || null,
      min_order_qty: item.min_order_qty || null,
      safety_stock: item.safety_stock || null,
      bins: bins.map((b: any) => ({
        id: b.name,
        item_id: id,
        warehouse_id: b.warehouse,
        quantity: b.actual_qty || 0,
        valuation_rate: b.valuation_rate || 0,
        stock_value: b.stock_value || 0,
        warehouses: { warehouse_name: b.warehouse, warehouse_code: b.warehouse },
      })),
      stock_entries: stockEntries.map((e: any) => ({
        id: e.name,
        entry_type: 'Stock Entry',
        item_id: id,
        quantity: e.qty || 0,
        source_warehouse: e.s_warehouse || null,
        target_warehouse: e.t_warehouse || null,
        reference: e.parent,
        posting_date: e.creation ? new Date(e.creation) : new Date(),
        created_at: e.creation ? new Date(e.creation) : new Date(),
        warehouses_stock_entries_source_warehouseTowarehouses: e.s_warehouse ? { warehouse_name: e.s_warehouse, warehouse_code: e.s_warehouse } : null,
        warehouses_stock_entries_target_warehouseTowarehouses: e.t_warehouse ? { warehouse_name: e.t_warehouse, warehouse_code: e.t_warehouse } : null,
      })),
    };

    return <StockDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Item not found</div>;
  }
}
