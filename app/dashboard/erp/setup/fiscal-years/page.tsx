import { listFiscalYears, type ClientSafeFiscalYear } from './actions';

export const dynamic = 'force-dynamic';
import FiscalYearsClient from './fiscal-years-client';

export default async function FiscalYearsPage() {
  const result = await listFiscalYears();
  const fiscalYears = result.success ? result.fiscalYears : [];
  return <FiscalYearsClient initialRecords={JSON.parse(JSON.stringify(fiscalYears))} />;
}
