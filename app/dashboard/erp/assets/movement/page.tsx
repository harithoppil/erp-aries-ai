import { listMovements, type ClientSafeMovement } from './actions';
import MovementClient from './movement-client';

export default async function MovementPage() {
  const result = await listMovements();
  const movements = result.success ? result.movements : [];
  return <MovementClient initialMovements={movements} />;
}
