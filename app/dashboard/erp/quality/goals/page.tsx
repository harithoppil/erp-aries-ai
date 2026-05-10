import { listGoals, type ClientSafeGoal } from './actions';
import GoalsClient from './goals-client';

export default async function GoalsPage() {
  const result = await listGoals();
  const goals = result.success ? result.goals : [];
  return <GoalsClient initialGoals={goals} />;
}
