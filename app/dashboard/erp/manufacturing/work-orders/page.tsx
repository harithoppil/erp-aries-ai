import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function WorkOrdersPage() {
  redirect('/dashboard/erp/work-order');
}
