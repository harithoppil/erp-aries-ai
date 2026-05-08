import { listQuotations, type ClientSafeQuotation } from "@/app/erp/quotations/actions";
import QuotationsClient from "@/app/erp/quotations/quotations-client";

export default async function QuotationsPage() {
  const result = await listQuotations();
  const quotations = result.success ? result.quotations : [];
  return <QuotationsClient initialQuotations={quotations} />;
}
