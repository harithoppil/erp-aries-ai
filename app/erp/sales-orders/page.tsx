import { listSalesOrders, type ClientSafeSalesOrder } from "@/app/erp/sales-orders/actions";
import SalesOrdersClient from "@/app/erp/sales-orders/sales-orders-client";

export default async function SalesOrdersPage() {
  const result = await listSalesOrders();
  const orders = result.success ? result.orders : [];
  return <SalesOrdersClient initialOrders={orders} />;
}
