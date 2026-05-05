"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Package } from "lucide-react";

export default function StockPage() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [iRes, wRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/items`),
          throttledFetch(`${API_BASE}/erp/warehouses`),
        ]);
        if (iRes.ok) setItems(unwrapPaginated(await iRes.json()));
        if (wRes.ok) setWarehouses(unwrapPaginated(await wRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading stock...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Stock & Inventory</h2>
      </div>

      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="text-xl font-bold text-primary">{items.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Warehouses</p>
          <p className="text-xl font-bold text-sonar">{warehouses.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valuation</p>
          <p className="text-xl font-bold text-primary">FIFO / Avg</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Items</h3></div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No items registered</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Group</th><th className="px-4 py-2">UOM</th></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-foreground">{i.item_group}</td>
                  <td className="px-4 py-3 text-foreground">{i.uom || "Nos"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
