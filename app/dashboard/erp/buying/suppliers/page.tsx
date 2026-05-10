import { listSuppliers, type ClientSafeSupplier } from './actions';
import SuppliersClient from './suppliers-client';

export default async function SuppliersPage() {
  const result = await listSuppliers();
  const suppliers = result.success ? result.suppliers : [];
  return <SuppliersClient initialSuppliers={suppliers} />;
}
