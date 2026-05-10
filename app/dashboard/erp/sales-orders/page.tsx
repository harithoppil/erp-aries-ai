import { listSalesOrders, type ClientSafeSalesOrder } from "@/app/dashboard/erp/sales-orders/actions";

export const dynamic = 'force-dynamic';
import SalesOrdersClient from "@/app/dashboard/erp/sales-orders/sales-orders-client";

export default async function SalesOrdersPage() {
  const result = await listSalesOrders();
  const orders = result.success ? result.orders : [];
  return <SalesOrdersClient initialOrders={orders} />;
}
