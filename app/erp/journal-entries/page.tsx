import { listJournalEntries, type ClientSafeJournalEntry } from "@/app/erp/journal-entries/actions";
import JournalEntriesClient from "@/app/erp/journal-entries/journal-entries-client";

export default async function JournalEntriesPage() {
  const result = await listJournalEntries();
  const entries = result.success ? result.entries : [];
  return <JournalEntriesClient initialEntries={entries} />;
}
