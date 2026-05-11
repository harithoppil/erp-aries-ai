import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MaterialRequestsPage() {
  redirect('/dashboard/erp/material-request');
}
