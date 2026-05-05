"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoney, formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";

export default function SalesInvoicesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    loadItems();
  }, [page, search]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await apiFetch(`/sales/invoices?page=${page}&page_size=${pageSize}&company_id=demo${search ? `&search=${search}` : ""}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
      setItems([]);
      /* old demo: [{"id":"1","series":"SINV-2026-0045","date":"2026-04-28","due_date":"2026-05-28","status":"Submitted","grand_total":450000,"outstanding_amount":450000},{"id":"2","series":"SINV-2026-0044","date":"2026-04-20","due_date":"2026-05-20","status":"Paid","grand_total":1200000,"outstanding_amount":0},{"id":"3","series":"SINV-2026-0042","date":"2026-03-15","due_date":"2026-04-15","status":"Overdue","grand_total":180000,"outstanding_amount":180000}]);
      setTotal([{"id":"1","series":"SINV-2026-0045","date":"2026-04-28","due_date":"2026-05-28","status":"Submitted","grand_total":450000,"outstanding_amount":450000},{"id":"2","series":"SINV-2026-0044","date":"2026-04-20","due_date":"2026-05-20","status":"Paid","grand_total":1200000,"outstanding_amount":0},{"id":"3","series":"SINV-2026-0042","date":"2026-03-15","due_date":"2026-04-15","status":"Overdue","grand_total":180000,"outstanding_amount":180000}].length);
    }
    setLoading(false);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Sales Invoices</h1>
          <p className="text-sm text-gray-500">Manage your Sales Invoices. Total: {total}</p>
        </div>
        <a href="/sales/invoices/new" className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-[#B08D2F] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Invoice
        </a>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Series</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No Sales Invoices found</td></tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-navy">{item.series}</td><td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.date)}</td><td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.due_date)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(item.status)}`}>{item.status}</span></td><td className="px-4 py-3 text-sm font-medium text-navy">{formatMoney(item.grand_total)}</td><td className="px-4 py-3 text-sm text-gray-600">{formatMoney(item.outstanding_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 hover:bg-gray-100 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {((page-1)*pageSize)+1}-{Math.min(page*pageSize, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 py-1 text-xs">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
