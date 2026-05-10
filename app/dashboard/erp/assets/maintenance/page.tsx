import { listMaintenance, type ClientSafeMaintenance } from './actions';
import MaintenanceClient from './maintenance-client';

export default async function MaintenancePage() {
  const result = await listMaintenance();
  const maintenance = result.success ? result.maintenance : [];
  return <MaintenanceClient initialMaintenance={maintenance} />;
}
