import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function StockEntriesPage() {
  redirect('/dashboard/erp/stock-entry');
}
