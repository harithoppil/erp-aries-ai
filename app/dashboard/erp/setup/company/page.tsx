import { listCompanies, type ClientSafeCompany } from '@/app/dashboard/erp/setup/company/actions';

export const dynamic = 'force-dynamic';
import CompanyClient from '@/app/dashboard/erp/setup/company/company-client';

export default async function CompanyPage() {
  const result = await listCompanies();
  const companies = result.success ? result.companies : [];
  return <CompanyClient initialRecords={JSON.parse(JSON.stringify(companies))} />;
}
