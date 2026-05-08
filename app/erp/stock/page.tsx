import { listItems, listWarehouses, listStockEntries, type ClientSafeItem } from "@/app/erp/stock/actions";
import StockClient from "@/app/erp/stock/stock-client";

export default async function StockPage() {
  const [iRes, wRes, eRes] = await Promise.all([
    listItems(),
    listWarehouses(),
    listStockEntries(),
  ]);
  const items = iRes.success ? iRes.items : [];
  const warehouses = wRes.success ? wRes.warehouses : [];
  const entries = eRes.success ? eRes.entries : [];

  return <StockClient initialItems={items} initialWarehouses={warehouses} initialEntries={entries} />;
}
