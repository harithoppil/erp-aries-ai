import { prisma } from '@/lib/prisma';
import WarehouseDetailClient from './warehouse-detail-client';

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const w = await prisma.warehouse.findUnique({ where: { name: id } });
    if (!w) throw new Error('Not found');
    const record = {
      name: w.name, warehouse_name: w.warehouse_name, warehouse_type: w.warehouse_type,
      is_group: w.is_group || false, parent_warehouse: w.parent_warehouse,
      company: w.company, disabled: w.disabled || false, docstatus: w.docstatus || 0,
      account: w.account, email_id: w.email_id, phone_no: w.phone_no,
      address_line_1: w.address_line_1, city: w.city, state: w.state, pin: w.pin,
      is_rejected_warehouse: w.is_rejected_warehouse || false,
    };
    return <WarehouseDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Warehouse not found</div>; }
}
