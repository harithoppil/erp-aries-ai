import { listSuppliers, listPurchaseOrders, type ClientSafeSupplier, type ClientSafePurchaseOrder } from "./actions";
import ProcurementClient from "./procurement-client";

export default async function ProcurementPage() {
  const [sRes, poRes] = await Promise.all([listSuppliers(), listPurchaseOrders()]);
  const suppliers = sRes.success ? sRes.suppliers : [];
  const purchaseOrders = poRes.success ? poRes.orders : [];
  return <ProcurementClient initialSuppliers={suppliers} initialPurchaseOrders={purchaseOrders} />;
}
