import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DeliveryNotesPage() {
  redirect('/dashboard/erp/delivery-note');
}
