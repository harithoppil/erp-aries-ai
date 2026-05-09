"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listPurchaseInvoices, createPurchaseInvoice, type ClientSafePurchaseInvoice } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { FileInput, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const STATUS: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  Unpaid: { label: "Unpaid", badge: "bg-red-100 text-red-700 border-red-200" },
  Paid: { label: "Paid", badge: "bg-green-100 text-green-700 border-green-200" },
  "Partly Paid": { label: "Partly Paid", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Cancelled: { label: "Cancelled", badge: "bg-gray-200 text-gray-600 border-gray-300" },
};
const fmt = (v: number, c = "AED") => v.toLocaleString("en-AE", { style: "currency", currency: c || "AED" });
const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PurchaseInvoicesClient({ initialInvoices }: { initialInvoices: ClientSafePurchaseInvoice[] }) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<ClientSafePurchaseInvoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier: "", posting_date: "", due_date: "", item_code: "", qty: "1", rate: "", bill_no: "", remarks: "" });

  usePageContext(`Purchase Invoices: ${invoices.length} invoices, outstanding AED ${invoices.reduce((s, i) => s + i.outstanding_amount, 0).toLocaleString()}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((i) => !q || (i.name || "").toLowerCase().includes(q) || (i.supplier || "").toLowerCase().includes(q) || (i.supplier_name || "").toLowerCase().includes(q) || (i.bill_no || "").toLowerCase().includes(q));
  }, [invoices, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createPurchaseInvoice({ supplier: form.supplier, posting_date: form.posting_date || undefined, due_date: form.due_date || undefined, items: [{ item_code: form.item_code, qty: parseFloat(form.qty), rate: parseFloat(form.rate) }], bill_no: form.bill_no || undefined, remarks: form.remarks || undefined });
    if (result.success) { toast.success("Purchase Invoice created"); setDialogOpen(false); setForm({ supplier: "", posting_date: "", due_date: "", item_code: "", qty: "1", rate: "", bill_no: "", remarks: "" }); const res = await listPurchaseInvoices(); if (res.success) setInvoices(res.invoices); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Purchase Invoices</h2><p className="text-sm text-[#64748b] mt-1">{invoices.length} invoices</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(i => ({ name: i.name, supplier: i.supplier_name, bill_no: i.bill_no, date: dt(i.posting_date), total: i.grand_total, outstanding: i.outstanding_amount, status: i.status })), 'purchase-invoices')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Invoice</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by supplier, bill no, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><FileInput size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No purchase invoices found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Bill No</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Grand Total</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((i) => { const c = STATUS[i.status] || STATUS.Draft; return (<tr key={i.name} onClick={() => router.push(`/dashboard/erp/buying/invoices/${i.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{i.name}</td><td className="px-4 py-3 font-medium text-[#0f172a]">{i.supplier_name || i.supplier}</td><td className="px-4 py-3 text-[#64748b]">{i.bill_no || "—"}</td><td className="px-4 py-3 text-[#64748b]">{dt(i.posting_date)}</td><td className="px-4 py-3 text-right font-semibold">{fmt(i.grand_total, i.currency || undefined)}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${c.badge}`}>{c.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Purchase Invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Supplier</label><Input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Posting Date</label><Input type="date" value={form.posting_date} onChange={(e) => setForm({ ...form, posting_date: e.target.value })} /></div><div><label className="text-sm font-medium">Due Date</label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div></div>
          <div><label className="text-sm font-medium">Item Code</label><Input required value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Qty</label><Input type="number" required min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div><div><label className="text-sm font-medium">Rate</label><Input type="number" required min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div></div>
          <div><label className="text-sm font-medium">Bill No</label><Input value={form.bill_no} onChange={(e) => setForm({ ...form, bill_no: e.target.value })} placeholder="Supplier bill reference" /></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
