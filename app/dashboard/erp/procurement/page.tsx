import { listSuppliers, listPurchaseOrders, type ClientSafeSupplier, type ClientSafePurchaseOrder } from "@/app/dashboard/erp/procurement/actions";

export const dynamic = 'force-dynamic';
import ProcurementClient from "@/app/dashboard/erp/procurement/procurement-client";

export default async function ProcurementPage() {
  const [sRes, poRes] = await Promise.all([listSuppliers(), listPurchaseOrders()]);
  const suppliers = sRes.success ? sRes.suppliers : [];
  const purchaseOrders = poRes.success ? poRes.orders : [];
  return <ProcurementClient initialSuppliers={suppliers} initialPurchaseOrders={purchaseOrders} />;
}
