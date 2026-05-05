"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoney, formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { RefreshCw } from "lucide-react";

export default function SalesOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 20;

  useEffect(() => {
    loadItems();
  }, [page, search]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await apiFetch(`/sales/orders?page=${page}&page_size=${pageSize}${search ? `&search=${search}` : ""}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
      setItems([]);
    }
    setLoading(false);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">Manage your Sales Orders. Total: {total}</p>
        </div>
        <a href="/sales/orders/new" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Order
        </a>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Series</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Grand Total</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">% Delivered</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><p className="text-sm text-muted-foreground mb-2">No Sales Orders found</p><button onClick={loadItems} className="text-sm text-primary hover:underline inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh</button></td></tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{item.series}</td><td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(item.date)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(item.status)}`}>{item.status}</span></td><td className="px-4 py-3 text-sm font-medium text-foreground">{formatMoney(item.grand_total)}</td><td className="px-4 py-3 text-sm text-muted-foreground">{item.per_delivered}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Showing {((page-1)*pageSize)+1}-{Math.min(page*pageSize, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-1.5 hover:bg-muted rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 py-1 text-xs">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-1.5 hover:bg-muted rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
