import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ContractsPage() {
  redirect('/dashboard/erp/contract');
}
