import { listQuotations, type ClientSafeQuotation } from "./actions";
import QuotationsClient from "./quotations-client";

export default async function QuotationsPage() {
  const result = await listQuotations();
  const quotations = result.success ? result.quotations : [];
  return <QuotationsClient initialQuotations={quotations} />;
}
