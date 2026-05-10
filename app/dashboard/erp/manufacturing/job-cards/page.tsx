import { listJobCards, type ClientSafeJobCard } from './actions';
import JobCardsClient from './job-cards-client';

export default async function JobCardsPage() {
  const result = await listJobCards();
  const jobCards = result.success ? result.jobCards : [];
  return <JobCardsClient initialJobCards={jobCards} />;
}
