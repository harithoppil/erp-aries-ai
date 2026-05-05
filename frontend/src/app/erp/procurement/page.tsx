"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { ShoppingCart } from "lucide-react";

export default function ProcurementPage() {
  const isMobile = useIsMobile();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, oRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/suppliers`),
          throttledFetch(`${API_BASE}/erp/purchase-orders`),
        ]);
        if (sRes.ok) setSuppliers(unwrapPaginated(await sRes.json()));
        if (oRes.ok) setOrders(unwrapPaginated(await oRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading procurement...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-sonar" />
        <h2 className="text-2xl font-bold">Procurement</h2>
      </div>

      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Suppliers</p>
          <p className="text-xl font-bold text-sonar">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Purchase Orders</p>
          <p className="text-xl font-bold text-primary">{orders.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Material Requests</p>
          <p className="text-xl font-bold text-amber">0</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Suppliers</h3></div>
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No suppliers registered</div>
        ) : (
          <div className="divide-y text-sm">
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{s.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">{s.category || "General"} · {s.supplier_code}</p>
                </div>
                <span className="text-xs text-muted-foreground">{s.email || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
