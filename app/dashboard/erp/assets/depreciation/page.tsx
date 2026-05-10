import { listDepreciationSchedules, type ClientSafeDepreciation } from './actions';
import DepreciationClient from './depreciation-client';

export default async function DepreciationPage() {
  const result = await listDepreciationSchedules();
  const schedules = result.success ? result.schedules : [];
  return <DepreciationClient initialSchedules={schedules} />;
}
