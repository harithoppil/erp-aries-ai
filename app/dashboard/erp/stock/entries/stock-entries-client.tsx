"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listStockEntries, createStockEntry, type ClientSafeStockEntry } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { ArrowRightLeft, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const TYPE_COLORS: Record<string, string> = {
  "Material Receipt": "bg-green-100 text-green-700 border-green-200",
  "Material Issue": "bg-red-100 text-red-700 border-red-200",
  "Material Transfer": "bg-blue-100 text-blue-700 border-blue-200",
  "Manufacture": "bg-purple-100 text-purple-700 border-purple-200",
  "Repack": "bg-amber-100 text-amber-700 border-amber-200",
};
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function StockEntriesClient({ initialEntries }: { initialEntries: ClientSafeStockEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<ClientSafeStockEntry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ stock_entry_type: "Material Receipt", item_code: "", qty: "1", from_warehouse: "", to_warehouse: "" });

  usePageContext(`Stock Entries: ${entries.length} entries`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => !q || (e.name || "").toLowerCase().includes(q) || (e.stock_entry_type || "").toLowerCase().includes(q) || (e.from_warehouse || "").toLowerCase().includes(q) || (e.to_warehouse || "").toLowerCase().includes(q));
  }, [entries, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createStockEntry({ stock_entry_type: form.stock_entry_type, from_warehouse: form.from_warehouse || undefined, to_warehouse: form.to_warehouse || undefined, items: [{ item_code: form.item_code, qty: parseFloat(form.qty) }] });
    if (result.success) { toast.success("Stock Entry created"); setDialogOpen(false); setForm({ stock_entry_type: "Material Receipt", item_code: "", qty: "1", from_warehouse: "", to_warehouse: "" }); const res = await listStockEntries(); if (res.success) setEntries(res.entries); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Stock Entries</h2><p className="text-sm text-[#64748b] mt-1">{entries.length} entries</p></div>
          <div className="flex gap-2">
            <ExportButton data={filtered.map(e => ({ name: e.name, type: e.stock_entry_type, date: dt(e.posting_date), from: e.from_warehouse, to: e.to_warehouse, value: e.value_difference }))} filename="stock-entries" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Entry</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by name, type, warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><ArrowRightLeft size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No stock entries found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">From → To</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Value Diff</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((e) => { const tc = TYPE_COLORS[e.stock_entry_type] || "bg-gray-100 text-gray-700 border-gray-200"; return (<tr key={e.name} onClick={() => router.push(`/dashboard/erp/stock/entries/${e.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{e.name}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${tc}`}>{e.stock_entry_type}</span></td><td className="px-4 py-3 text-[#64748b]">{dt(e.posting_date)}</td><td className="px-4 py-3 text-xs text-[#64748b]">{e.from_warehouse || "—"} → {e.to_warehouse || "—"}</td><td className={`px-4 py-3 text-right font-semibold ${e.value_difference >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(Math.abs(e.value_difference))}</td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Stock Entry</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Entry Type</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.stock_entry_type} onChange={(e) => setForm({ ...form, stock_entry_type: e.target.value })}><option>Material Receipt</option><option>Material Issue</option><option>Material Transfer</option><option>Manufacture</option><option>Repack</option></select></div>
          <div><label className="text-sm font-medium">Item Code</label><Input required value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} /></div>
          <div><label className="text-sm font-medium">Qty</label><Input type="number" required min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">From Warehouse</label><Input value={form.from_warehouse} onChange={(e) => setForm({ ...form, from_warehouse: e.target.value })} placeholder="Source" /></div><div><label className="text-sm font-medium">To Warehouse</label><Input value={form.to_warehouse} onChange={(e) => setForm({ ...form, to_warehouse: e.target.value })} placeholder="Target" /></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
