import { listCompanies, type ClientSafeCompany } from './actions';
import CompanyClient from './company-client';

export default async function CompanyPage() {
  const result = await listCompanies();
  const companies = result.success ? result.companies : [];
  return <CompanyClient initialRecords={JSON.parse(JSON.stringify(companies))} />;
}
