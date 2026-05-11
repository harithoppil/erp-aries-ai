import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function TimesheetsPage() {
  redirect('/dashboard/erp/timesheet');
}
