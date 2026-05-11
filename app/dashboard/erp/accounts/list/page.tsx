import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AccountsListPage() {
  redirect('/dashboard/erp/account');
}
