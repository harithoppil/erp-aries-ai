import { listIssues, type ClientSafeIssue } from '@/app/dashboard/erp/support/issues/actions';

export const dynamic = 'force-dynamic';
import IssuesClient from './issues-client';

export default async function IssuesPage() {
  const result = await listIssues();
  const issues = result.success ? result.issues : [];
  return <IssuesClient initialIssues={JSON.parse(JSON.stringify(issues))} />;
}
