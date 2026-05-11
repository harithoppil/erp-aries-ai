import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PurchaseReceiptsPage() {
  redirect('/dashboard/erp/purchase-receipt');
}
