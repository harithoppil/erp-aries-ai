import { listInspections, type ClientSafeInspection } from './actions';
import InspectionsClient from './inspections-client';

export default async function InspectionsPage() {
  const result = await listInspections();
  const inspections = result.success ? result.inspections : [];
  return <InspectionsClient initialInspections={inspections} />;
}
