import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CustomersPage() {
  redirect('/dashboard/erp/customer');
}
