import { listPurchaseReceipts, type ClientSafePurchaseReceipt } from '@/app/dashboard/erp/stock/purchase-receipts/actions';

export const dynamic = 'force-dynamic';
import PurchaseReceiptsClient from './purchase-receipts-client';

export default async function PurchaseReceiptsPage() {
  const result = await listPurchaseReceipts();
  const receipts = result.success ? result.receipts : [];
  return <PurchaseReceiptsClient initialReceipts={JSON.parse(JSON.stringify(receipts))} />;
}
