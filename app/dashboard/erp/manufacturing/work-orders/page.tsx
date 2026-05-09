import { listWorkOrders, type ClientSafeWorkOrder } from '@/app/dashboard/erp/manufacturing/work-orders/actions';
import WorkOrdersClient from './work-orders-client';

export default async function WorkOrdersPage() {
  const result = await listWorkOrders();
  const orders = result.success ? result.orders : [];
  return <WorkOrdersClient initialOrders={JSON.parse(JSON.stringify(orders))} />;
}
