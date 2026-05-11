import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LeadsPage() {
  redirect('/dashboard/erp/lead');
}
