import { listQuotations, type ClientSafeQuotation } from "@/app/dashboard/erp/quotations/actions";

export const dynamic = 'force-dynamic';
import QuotationsClient from "@/app/dashboard/erp/quotations/quotations-client";

export default async function QuotationsPage() {
  const result = await listQuotations();
  const quotations = result.success ? result.quotations : [];
  return <QuotationsClient initialQuotations={quotations} />;
}
