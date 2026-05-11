import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function JournalEntriesPage() {
  redirect('/dashboard/erp/journal-entry');
}
