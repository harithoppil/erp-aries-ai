import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PersonnelListPage() {
  redirect('/dashboard/erp/employee');
}
