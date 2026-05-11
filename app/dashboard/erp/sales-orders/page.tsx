import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SalesOrdersPage() {
  redirect('/dashboard/erp/sales-order');
}
