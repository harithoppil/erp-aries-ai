import { listBOMs, type ClientSafeBOM } from './actions';
import BOMClient from './bom-client';

export default async function BOMPage() {
  const result = await listBOMs();
  const boms = result.success ? result.boms : [];
  return <BOMClient initialBOMs={boms} />;
}
