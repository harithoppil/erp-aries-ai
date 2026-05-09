"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listLeads, createLead, type ClientSafeLead } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { UserCircle, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const STATUS: Record<string, { label: string; badge: string }> = {
  Lead: { label: "Lead", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Open: { label: "Open", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Replied: { label: "Replied", badge: "bg-teal-100 text-teal-700 border-teal-200" },
  Opportunity: { label: "Opportunity", badge: "bg-purple-100 text-purple-700 border-purple-200" },
  "Do Not Contact": { label: "DNC", badge: "bg-red-100 text-red-700 border-red-200" },
  Converted: { label: "Converted", badge: "bg-green-100 text-green-700 border-green-200" },
};
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function LeadsClient({ initialLeads }: { initialLeads: ClientSafeLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState<ClientSafeLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ lead_name: "", company_name: "", email_id: "", phone: "", mobile_no: "", type: "", industry: "" });

  usePageContext(`Leads: ${leads.length} leads`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => !q || (l.lead_name || "").toLowerCase().includes(q) || (l.company_name || "").toLowerCase().includes(q) || (l.email_id || "").toLowerCase().includes(q) || (l.name || "").toLowerCase().includes(q));
  }, [leads, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createLead(form);
    if (result.success) { toast.success("Lead created"); setDialogOpen(false); setForm({ lead_name: "", company_name: "", email_id: "", phone: "", mobile_no: "", type: "", industry: "" }); const res = await listLeads(); if (res.success) setLeads(res.leads); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Leads</h2><p className="text-sm text-[#64748b] mt-1">{leads.length} leads</p></div>
          <div className="flex gap-2">
            <ExportButton data={filtered.map(l => ({ name: l.name, lead_name: l.lead_name, company: l.company_name, email: l.email_id, status: l.status }))} filename="leads" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Lead</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by name, company, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><UserCircle size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No leads found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Name</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Email</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Phone</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((l) => { const c = STATUS[l.status] || STATUS.Lead; return (<tr key={l.name} onClick={() => router.push(`/dashboard/erp/crm/leads/${l.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{l.lead_name || l.name}</td><td className="px-4 py-3 text-[#64748b]">{l.company_name || "—"}</td><td className="px-4 py-3 text-[#64748b]">{l.email_id || "—"}</td><td className="px-4 py-3 text-[#64748b]">{l.phone || l.mobile_no || "—"}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${c.badge}`}>{c.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Lead Name</label><Input value={form.lead_name} onChange={(e) => setForm({ ...form, lead_name: e.target.value })} placeholder="Full name" /></div>
          <div><label className="text-sm font-medium">Company Name</label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Email</label><Input type="email" value={form.email_id} onChange={(e) => setForm({ ...form, email_id: e.target.value })} /></div><div><label className="text-sm font-medium">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Type</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="">Select...</option><option>Client</option><option>Channel Partner</option><option>Prospect</option></select></div><div><label className="text-sm font-medium">Industry</label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Industry" /></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
