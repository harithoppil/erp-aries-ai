import { listJournalEntries, type ClientSafeJournalEntry } from "@/app/dashboard/erp/journal-entries/actions";

export const dynamic = 'force-dynamic';
import JournalEntriesClient from "@/app/dashboard/erp/journal-entries/journal-entries-client";

export default async function JournalEntriesPage() {
  const result = await listJournalEntries();
  const entries = result.success ? result.entries : [];
  return <JournalEntriesClient initialEntries={entries} />;
}
