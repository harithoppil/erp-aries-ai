import { prisma } from '@/lib/prisma';
import WorkOrderDetailClient from './work-order-detail-client';

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [order, reqItems, operations] = await Promise.all([
      prisma.workOrder.findUnique({ where: { name: id } }),
      prisma.workOrderItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
      prisma.workOrderOperation.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);
    if (!order) throw new Error('Not found');
    const record = {
      name: order.name, production_item: order.production_item, item_name: order.item_name,
      bom_no: order.bom_no, status: order.status || 'Draft', qty: order.qty,
      produced_qty: order.produced_qty || 0, company: order.company,
      planned_start_date: order.planned_start_date, actual_start_date: order.actual_start_date,
      planned_end_date: order.planned_end_date, fg_warehouse: order.fg_warehouse,
      wip_warehouse: order.wip_warehouse, sales_order: order.sales_order, project: order.project,
      total_operating_cost: Number(order.total_operating_cost || 0), docstatus: order.docstatus || 0,
      description: order.description, stock_uom: order.stock_uom,
      required_items: reqItems.map((i) => ({
        name: i.name, item_code: i.item_code, item_name: i.item_name,
        source_warehouse: i.source_warehouse, required_qty: i.required_qty || 0,
        transferred_qty: i.transferred_qty || 0, consumed_qty: i.consumed_qty || 0,
      })),
      operations: operations.map((o) => ({
        name: o.name, operation: o.operation, workstation: o.workstation,
        time_in_mins: o.time_in_mins, status: o.status, completed_qty: o.completed_qty,
      })),
    };
    return <WorkOrderDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Work Order not found</div>; }
}
