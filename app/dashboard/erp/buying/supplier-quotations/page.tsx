import { listSupplierQuotations, type ClientSafeSupplierQuotation } from './actions';
import SupplierQuotationsClient from './supplier-quotations-client';

export default async function SupplierQuotationsPage() {
  const result = await listSupplierQuotations();
  const quotations = result.success ? result.quotations : [];
  return <SupplierQuotationsClient initialQuotations={quotations} />;
}
