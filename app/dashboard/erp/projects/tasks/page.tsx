import { listTasks, type ClientSafeTask } from './actions';

export const dynamic = 'force-dynamic';
import TasksClient from './tasks-client';

export default async function TasksPage() {
  const result = await listTasks();
  const tasks = result.success ? result.tasks : [];
  return <TasksClient initialRecords={JSON.parse(JSON.stringify(tasks))} />;
}
