import { listPurchaseInvoices, type ClientSafePurchaseInvoice } from '@/app/dashboard/erp/buying/invoices/actions';

export const dynamic = 'force-dynamic';
import PurchaseInvoicesClient from './purchase-invoices-client';

export default async function PurchaseInvoicesPage() {
  const result = await listPurchaseInvoices();
  const invoices = result.success ? result.invoices : [];
  return <PurchaseInvoicesClient initialInvoices={JSON.parse(JSON.stringify(invoices))} />;
}
