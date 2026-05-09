import { listWarehouses, type ClientSafeWarehouse } from './actions';
import WarehousesClient from './warehouses-client';

export default async function WarehousesPage() {
  const result = await listWarehouses();
  const warehouses = result.success ? result.warehouses : [];
  return <WarehousesClient initialRecords={JSON.parse(JSON.stringify(warehouses))} />;
}
