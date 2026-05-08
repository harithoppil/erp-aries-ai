import { listSuppliers, listPurchaseOrders, type ClientSafeSupplier, type ClientSafePurchaseOrder } from "@/app/erp/procurement/actions";
import ProcurementClient from "@/app/erp/procurement/procurement-client";

export default async function ProcurementPage() {
  const [sRes, poRes] = await Promise.all([listSuppliers(), listPurchaseOrders()]);
  const suppliers = sRes.success ? sRes.suppliers : [];
  const purchaseOrders = poRes.success ? poRes.orders : [];
  return <ProcurementClient initialSuppliers={suppliers} initialPurchaseOrders={purchaseOrders} />;
}
