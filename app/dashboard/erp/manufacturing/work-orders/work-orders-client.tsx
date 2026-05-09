"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listWorkOrders, createWorkOrder, type ClientSafeWorkOrder } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { Factory, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const STATUS: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  "Not Started": { label: "Not Started", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  "In Process": { label: "In Process", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Completed: { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200" },
  Stopped: { label: "Stopped", badge: "bg-red-100 text-red-700 border-red-200" },
  Cancelled: { label: "Cancelled", badge: "bg-gray-200 text-gray-600 border-gray-300" },
};
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function WorkOrdersClient({ initialOrders }: { initialOrders: ClientSafeWorkOrder[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<ClientSafeWorkOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ production_item: "", bom_no: "", qty: "1", fg_warehouse: "", wip_warehouse: "" });

  usePageContext(`Work Orders: ${orders.length} orders`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => !q || (o.name || "").toLowerCase().includes(q) || (o.production_item || "").toLowerCase().includes(q) || (o.item_name || "").toLowerCase().includes(q));
  }, [orders, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createWorkOrder({ production_item: form.production_item, bom_no: form.bom_no, qty: parseFloat(form.qty), fg_warehouse: form.fg_warehouse || undefined, wip_warehouse: form.wip_warehouse || undefined });
    if (result.success) { toast.success("Work Order created"); setDialogOpen(false); setForm({ production_item: "", bom_no: "", qty: "1", fg_warehouse: "", wip_warehouse: "" }); const res = await listWorkOrders(); if (res.success) setOrders(res.orders); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Work Orders</h2><p className="text-sm text-[#64748b] mt-1">{orders.length} work orders</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(o => ({ name: o.name, item: o.production_item, qty: o.qty, produced: o.produced_qty, status: o.status })), 'work-orders')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Work Order</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by item, BOM..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><Factory size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No work orders found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Item</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Qty</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Produced</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Start Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((o) => { const c = STATUS[o.status] || STATUS.Draft; return (<tr key={o.name} onClick={() => router.push(`/dashboard/erp/manufacturing/work-orders/${o.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{o.name}</td><td className="px-4 py-3"><p className="font-medium text-[#0f172a]">{o.item_name || o.production_item}</p><p className="text-xs text-[#94a3b8]">BOM: {o.bom_no}</p></td><td className="px-4 py-3 text-right">{o.qty}</td><td className="px-4 py-3 text-right">{o.produced_qty}</td><td className="px-4 py-3 text-[#64748b]">{dt(o.planned_start_date)}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${c.badge}`}>{c.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Production Item</label><Input required value={form.production_item} onChange={(e) => setForm({ ...form, production_item: e.target.value })} placeholder="Item code" /></div>
          <div><label className="text-sm font-medium">BOM No</label><Input required value={form.bom_no} onChange={(e) => setForm({ ...form, bom_no: e.target.value })} placeholder="BOM-00001" /></div>
          <div><label className="text-sm font-medium">Qty</label><Input type="number" required min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">FG Warehouse</label><Input value={form.fg_warehouse} onChange={(e) => setForm({ ...form, fg_warehouse: e.target.value })} placeholder="Finished goods" /></div><div><label className="text-sm font-medium">WIP Warehouse</label><Input value={form.wip_warehouse} onChange={(e) => setForm({ ...form, wip_warehouse: e.target.value })} placeholder="Work in progress" /></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
