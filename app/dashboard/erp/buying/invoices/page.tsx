import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PurchaseInvoicesPage() {
  redirect('/dashboard/erp/purchase-invoice');
}
