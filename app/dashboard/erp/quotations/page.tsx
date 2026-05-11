import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function QuotationsPage() {
  redirect('/dashboard/erp/quotation');
}
