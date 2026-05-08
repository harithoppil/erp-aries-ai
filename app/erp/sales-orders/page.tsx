import { listSalesOrders, type ClientSafeSalesOrder } from "./actions";
import SalesOrdersClient from "./sales-orders-client";

export default async function SalesOrdersPage() {
  const result = await listSalesOrders();
  const orders = result.success ? result.orders : [];
  return <SalesOrdersClient initialOrders={orders} />;
}
