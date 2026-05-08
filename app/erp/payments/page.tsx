import { listPayments, type ClientSafePayment } from "@/app/erp/payments/actions";
import { listInvoices, type ClientSafeInvoice } from "@/app/erp/accounts/actions";
import PaymentsClient from "@/app/erp/payments/payments-client";

export default async function PaymentsPage() {
  const [pRes, iRes] = await Promise.all([listPayments(), listInvoices()]);
  const payments = pRes.success ? pRes.payments : [];
  const invoices = iRes.success ? iRes.invoices : [];

  return <PaymentsClient initialPayments={payments} initialInvoices={invoices} />;
}
