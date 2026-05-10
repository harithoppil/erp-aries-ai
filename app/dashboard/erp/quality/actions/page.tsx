import { listActions, type ClientSafeAction } from './actions';
import ActionsClient from './actions-client';

export default async function ActionsPage() {
  const result = await listActions();
  const actions = result.success ? result.actions : [];
  return <ActionsClient initialActions={actions} />;
}
