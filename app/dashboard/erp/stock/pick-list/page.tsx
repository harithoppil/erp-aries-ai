import { listPickLists, type ClientSafePickList } from './actions';
import PickListClient from './pick-list-client';

export default async function PickListPage() {
  const result = await listPickLists();
  const pickLists = result.success ? result.pickLists : [];
  return <PickListClient initialPickLists={pickLists} />;
}
