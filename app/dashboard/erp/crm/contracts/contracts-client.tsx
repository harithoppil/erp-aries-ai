"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listContracts, createContract, type ClientSafeContract } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { FileText, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const STATUS: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  Active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200" },
  Expired: { label: "Expired", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
  Terminated: { label: "Terminated", badge: "bg-gray-200 text-gray-600 border-gray-300" },
};
const DOCTYPE: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-green-100 text-green-700 border-green-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ContractsClient({ initialRecords }: { initialRecords: ClientSafeContract[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeContract[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ party_type: "Customer", party_name: "", start_date: "", end_date: "", contract_terms: "", is_signed: false });

  usePageContext(`Contracts: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((c) => !q || (c.party_name || "").toLowerCase().includes(q) || (c.status || "").toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createContract(form);
    if (result.success) { toast.success("Contract created"); setDialogOpen(false); setForm({ party_type: "Customer", party_name: "", start_date: "", end_date: "", contract_terms: "", is_signed: false }); const res = await listContracts(); if (res.success) setRecords(res.contracts); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Contracts</h2><p className="text-sm text-[#64748b] mt-1">{records.length} contracts</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(c => ({ name: c.name, party: c.party_name, type: c.party_type, status: c.status, signed: c.is_signed })), 'contracts')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Contract</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by party name, status..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><FileText size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No contracts found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Party</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Party Type</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Start Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">End Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Signed</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((c) => { const sc = STATUS[c.status] || STATUS.Draft; return (<tr key={c.name} onClick={() => router.push(`/dashboard/erp/crm/contracts/${c.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{c.party_name}</td><td className="px-4 py-3 text-[#64748b]">{c.party_type}</td><td className="px-4 py-3 text-[#64748b]">{dt(c.start_date)}</td><td className="px-4 py-3 text-[#64748b]">{dt(c.end_date)}</td><td className="px-4 py-3">{c.is_signed ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 border border-green-200">Signed</span> : <span className="text-xs text-[#64748b]">Unsigned</span>}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${sc.badge}`}>{sc.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Party Type</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.party_type} onChange={(e) => setForm({ ...form, party_type: e.target.value })}><option>Customer</option><option>Supplier</option><option>Employee</option></select></div><div><label className="text-sm font-medium">Party Name</label><Input required value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} placeholder="Party name" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Start Date</label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div><div><label className="text-sm font-medium">End Date</label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div></div>
          <div><label className="text-sm font-medium">Contract Terms</label><textarea className="w-full min-h-[80px] rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.contract_terms} onChange={(e) => setForm({ ...form, contract_terms: e.target.value })} placeholder="Contract terms..." /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="is_signed" checked={form.is_signed} onChange={(e) => setForm({ ...form, is_signed: e.target.checked })} className="rounded" /><label htmlFor="is_signed" className="text-sm font-medium">Is Signed</label></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
