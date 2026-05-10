import { listSalesInvoices, type ClientSafeSalesInvoice } from '@/app/dashboard/erp/selling/invoices/actions';

export const dynamic = 'force-dynamic';
import SalesInvoicesClient from './sales-invoices-client';

export default async function SalesInvoicesPage() {
  const result = await listSalesInvoices();
  const invoices = result.success ? result.invoices : [];
  return <SalesInvoicesClient initialInvoices={JSON.parse(JSON.stringify(invoices))} />;
}
