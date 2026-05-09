import { listStockEntries, type ClientSafeStockEntry } from '@/app/dashboard/erp/stock/entries/actions';
import StockEntriesClient from './stock-entries-client';

export default async function StockEntriesPage() {
  const result = await listStockEntries();
  const entries = result.success ? result.entries : [];
  return <StockEntriesClient initialEntries={JSON.parse(JSON.stringify(entries))} />;
}
