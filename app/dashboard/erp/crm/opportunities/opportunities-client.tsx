"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listOpportunities, createOpportunity, type ClientSafeOpportunity } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { TrendingUp, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const STATUS: Record<string, { label: string; badge: string }> = {
  Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Quoted: { label: "Quoted", badge: "bg-purple-100 text-purple-700 border-purple-200" },
  Won: { label: "Won", badge: "bg-green-100 text-green-700 border-green-200" },
  Lost: { label: "Lost", badge: "bg-red-100 text-red-700 border-red-200" },
};
const STAGE: Record<string, string> = { Prospecting: "bg-amber-100", Qualification: "bg-yellow-100", "Proposal/Price Quote": "bg-purple-100", Negotiation: "bg-blue-100", Closed: "bg-green-100" };
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function OpportunitiesClient({ initialOpportunities }: { initialOpportunities: ClientSafeOpportunity[] }) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<ClientSafeOpportunity[]>(initialOpportunities);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ party_name: "", opportunity_from: "Lead", opportunity_type: "", item_code: "", qty: "1", rate: "" });

  usePageContext(`Opportunities: ${opportunities.length} opportunities, total AED ${opportunities.reduce((s, o) => s + o.opportunity_amount, 0).toLocaleString()}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return opportunities.filter((o) => !q || (o.name || "").toLowerCase().includes(q) || (o.party_name || "").toLowerCase().includes(q) || (o.customer_name || "").toLowerCase().includes(q));
  }, [opportunities, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createOpportunity({ opportunity_from: form.opportunity_from, party_name: form.party_name, opportunity_type: form.opportunity_type || undefined, items: form.item_code ? [{ item_code: form.item_code, qty: parseFloat(form.qty), rate: parseFloat(form.rate) }] : undefined });
    if (result.success) { toast.success("Opportunity created"); setDialogOpen(false); setForm({ party_name: "", opportunity_from: "Lead", opportunity_type: "", item_code: "", qty: "1", rate: "" }); const res = await listOpportunities(); if (res.success) setOpportunities(res.opportunities); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Opportunities</h2><p className="text-sm text-[#64748b] mt-1">{opportunities.length} opportunities</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(o => ({ name: o.name, party: o.party_name, amount: o.opportunity_amount, stage: o.sales_stage, status: o.status })), 'opportunities')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Opportunity</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by name, party..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><TrendingUp size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No opportunities found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Party</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Amount</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Stage</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((o) => { const sc = STATUS[o.status] || STATUS.Open; return (<tr key={o.name} onClick={() => router.push(`/dashboard/erp/crm/opportunities/${o.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{o.name}</td><td className="px-4 py-3 font-medium text-[#0f172a]">{o.customer_name || o.party_name}</td><td className="px-4 py-3 text-right font-semibold">{fmt(o.opportunity_amount)}</td><td className="px-4 py-3 text-[#64748b]">{o.sales_stage}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${sc.badge}`}>{sc.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Opportunity</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Party Name</label><Input required value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} placeholder="Lead or Customer name" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">From</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.opportunity_from} onChange={(e) => setForm({ ...form, opportunity_from: e.target.value })}><option>Lead</option><option>Customer</option></select></div><div><label className="text-sm font-medium">Type</label><Input value={form.opportunity_type} onChange={(e) => setForm({ ...form, opportunity_type: e.target.value })} placeholder="Sales, Services..." /></div></div>
          <div className="border-t pt-3"><p className="text-xs text-[#94a3b8] uppercase mb-2">Item (optional)</p><div className="grid grid-cols-3 gap-3"><div><label className="text-sm font-medium">Item</label><Input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} /></div><div><label className="text-sm font-medium">Qty</label><Input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div><div><label className="text-sm font-medium">Rate</label><Input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
