import { listCapitalizations, type ClientSafeCapitalization } from './actions';
import CapitalizationClient from './capitalization-client';

export default async function CapitalizationPage() {
  const result = await listCapitalizations();
  const capitalizations = result.success ? result.capitalizations : [];
  return <CapitalizationClient initialCapitalizations={capitalizations} />;
}
