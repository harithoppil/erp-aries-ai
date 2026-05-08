import { listJournalEntries, type ClientSafeJournalEntry } from "./actions";
import JournalEntriesClient from "./journal-entries-client";

export default async function JournalEntriesPage() {
  const result = await listJournalEntries();
  const entries = result.success ? result.entries : [];
  return <JournalEntriesClient initialEntries={entries} />;
}
