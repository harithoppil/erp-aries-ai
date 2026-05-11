import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BankAccountsPage() {
  redirect('/dashboard/erp/bank-account');
}
