import { listDeliveryNotes, type ClientSafeDeliveryNote } from '@/app/dashboard/erp/stock/delivery-notes/actions';
import DeliveryNotesClient from './delivery-notes-client';

export default async function DeliveryNotesPage() {
  const result = await listDeliveryNotes();
  const notes = result.success ? result.notes : [];
  return <DeliveryNotesClient initialNotes={JSON.parse(JSON.stringify(notes))} />;
}
