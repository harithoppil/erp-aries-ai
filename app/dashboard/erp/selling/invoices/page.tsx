import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SalesInvoicesPage() {
  redirect('/dashboard/erp/sales-invoice');
}
